// Questionnaires CPS remplis dans Microsoft Forms (élève, titulaire, parents).
//
// - Chaque Forms enregistre ses réponses dans un classeur Excel du dossier d'échange (sous-dossier CPS).
// - Le site lit ces classeurs, rapproche chaque réponse d'une inscription par son code, recalcule
//   les 5 scores (items inversés : 6 − x) et ne garde que ces scores dans RS_CPS.
// - Les 30 réponses brutes restent dans le classeur ; la fiche imprimable les relit à la demande.

import { CONFIG } from './config.js';
import { S, eleve, nomEleve } from './state.js';
import { dossierEchange } from './sync.js';
import { lireXlsx, serieVersISO } from './xlsx-lite.js';
import { cpsKey, normalise, sortBy } from './domain.js';

export const SOURCES = [
  { key: 'Eleve', label: 'Élève', fichier: 'CPS_Eleve.xlsx' },
  { key: 'Titulaire', label: 'Titulaire', fichier: 'CPS_Titulaire.xlsx' },
  { key: 'Parents', label: 'Parents', fichier: 'CPS_Parents.xlsx' },
];
export const source = key => SOURCES.find(s => s.key === key);
export const MOMENTS = ['Entrée', 'Sortie', 'Autre'];

/** Domaine (1–5, ordre de DOMAINES) et sens de chaque item, repris du classeur EvalCPS (identiques pour les 3 sources). */
export const ITEMS = [
  [1, 0], [2, 0], [2, 0], [3, 0], [4, 1], [3, 0], [5, 0], [5, 0], [4, 0], [3, 1],
  [2, 0], [3, 1], [2, 0], [3, 0], [4, 0], [1, 0], [1, 0], [4, 0], [5, 0], [1, 1],
  [1, 0], [5, 1], [5, 0], [2, 1], [4, 1], [5, 1], [4, 0], [1, 1], [2, 1], [3, 0],
].map(([d, inv], k) => ({ n: k + 1, d, inv: !!inv }));

export const ECHELLE = ['Jamais ou presque jamais', 'Rarement', 'Parfois', 'Souvent', 'Toujours ou presque toujours'];
/** Libellé Forms → valeur 1–5 (tolère majuscules, accents et petites variantes). */
export function valeurEchelle(label) {
  const t = normalise(label);
  if (!t) return null;
  if (t.startsWith('jamais')) return 1;
  if (t.startsWith('rarement')) return 2;
  if (t.startsWith('parfois')) return 3;
  if (t.startsWith('souvent')) return 4;
  if (t.startsWith('toujours')) return 5;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

/* ---------- Liens préremplis et codes ---------- */
const BASE = 'https://forms.cloud.microsoft/Pages/ResponsePage.aspx';
export function formsConfig(key) { return CONFIG.CPS_FORMS?.[key] || null; }
export function lienForms(key, code, moment) {
  const f = formsConfig(key);
  if (!f?.id) return null;
  return `${BASE}?id=${encodeURIComponent(f.id)}&${f.qCode}=${encodeURIComponent(code)}&${f.qMoment}=${encodeURIComponent(`"${moment}"`)}`;
}
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O, 1/I : lisible si on doit le taper
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function nouveauCode() {
  const pris = new Set(S.store.all('RS_Inscriptions').map(i => normCode(i.CodeCPS)).filter(Boolean));
  for (;;) {
    const r = crypto.getRandomValues(new Uint8Array(6));
    const c = [...r].map(x => ALPHABET[x % ALPHABET.length]).join('');
    if (!pris.has(c)) return c;
  }
}
/** Code CPS de l'inscription (créé à la première demande, puis partagé avec l'équipe comme le reste). */
export async function codeInscription(i) {
  if (i.CodeCPS) return i.CodeCPS;
  const code = nouveauCode();
  await S.store.update('RS_Inscriptions', i.ID, { CodeCPS: code });
  return code;
}
export const inscriptionParCode = code => {
  const c = normCode(code);
  return c ? S.store.all('RS_Inscriptions').find(i => normCode(i.CodeCPS) === c) || null : null;
};

/* ---------- Lecture des classeurs ---------- */
const cache = { reponses: null, erreurs: [], lu: null, origine: null };
export const derniereLecture = () => cache;

function analyserFeuille(rows, key) {
  const head = (rows[0] || []).map(x => String(x ?? '').trim());
  const col = name => head.findIndex(x => normalise(x) === normalise(name));
  const cId = col('Id'), cFin = col('Heure de fin'), cCode = col('Code'), cMoment = col('Moment');
  if (cCode < 0 || cMoment < 0) throw new Error(`colonnes « Code » ou « Moment » introuvables`);
  const items = new Array(30).fill(-1), textes = new Array(30).fill('');
  head.forEach((x, k) => {
    const m = x.match(/:\.(\d{1,2})\.\s*([\s\S]*)$/) || x.match(/^(\d{1,2})\.\s*([\s\S]*)$/);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 30) { items[Number(m[1]) - 1] = k; textes[Number(m[1]) - 1] = m[2].trim(); }
  });
  const manquants = items.map((c, k) => (c < 0 ? k + 1 : null)).filter(Boolean);
  if (manquants.length) throw new Error(`items introuvables : ${manquants.join(', ')} (le numéro « N. » doit rester au début de chaque énoncé)`);
  return rows.slice(1).filter(r => r.some(v => v != null && v !== '')).map(r => ({
    src: key,
    id: Number(r[cId]),
    date: serieVersISO(r[cFin]),
    code: normCode(r[cCode]),
    moment: MOMENTS.find(m => normalise(m) === normalise(r[cMoment])) || String(r[cMoment] ?? ''),
    libelles: items.map(c => (r[c] == null ? null : String(r[c]))),
    valeurs: items.map(c => valeurEchelle(r[c])),
    textes,
  }));
}

async function lireFichier(file, key) {
  return analyserFeuille(await lireXlsx(await file.arrayBuffer()), key);
}

/**
 * Lit les 3 classeurs dans le dossier d'échange (sous-dossier « CPS », ou à la racine).
 * interactive : peut demander l'autorisation d'accès au dossier (clic de l'utilisateur).
 * Renvoie false si le dossier n'est pas disponible (il faut alors choisir les fichiers à la main).
 */
export async function lireDossier(interactive = false) {
  const racine = await dossierEchange(interactive);
  if (!racine) return false;
  let dir = racine;
  try { dir = await racine.getDirectoryHandle('CPS'); } catch { /* pas de sous-dossier : on cherche à la racine */ }
  const reponses = [], erreurs = [];
  for (const s of SOURCES) {
    try {
      const fh = await dir.getFileHandle(s.fichier);
      reponses.push(...await lireFichier(await fh.getFile(), s.key));
    } catch (e) {
      erreurs.push(e?.name === 'NotFoundError' ? `${s.fichier} absent du dossier « ${dir.name} ».` : `${s.fichier} : ${e.message}`);
    }
  }
  Object.assign(cache, { reponses, erreurs, lu: new Date(), origine: `dossier « ${dir.name} »` });
  return true;
}

/** Fichiers choisis à la main (Safari, téléphone…) : la source est reconnue par le nom du fichier. */
export async function lireFichiers(files) {
  const reponses = [], erreurs = [];
  for (const f of files) {
    const n = normalise(f.name);
    const s = SOURCES.find(x => n.includes(normalise(x.key)) || n.includes(normalise(x.label)));
    if (!s) { erreurs.push(`${f.name} : source non reconnue (le nom doit contenir Eleve, Titulaire ou Parents).`); continue; }
    try { reponses.push(...await lireFichier(f, s.key)); } catch (e) { erreurs.push(`${f.name} : ${e.message}`); }
  }
  Object.assign(cache, { reponses, erreurs, lu: new Date(), origine: 'fichiers choisis' });
}

/* ---------- Scores ---------- */
/** Score par domaine : moyenne des 6 items, items inversés comptés 6 − x, arrondi à 2 décimales (comme le classeur). */
export function scores(rep) {
  const out = {};
  for (let d = 1; d <= 5; d++) {
    const xs = ITEMS.filter(it => it.d === d).map(it => {
      const v = rep.valeurs[it.n - 1];
      return v == null ? null : it.inv ? 6 - v : v;
    });
    out[d] = xs.some(v => v == null) ? null : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 100) / 100;
  }
  return out;
}

/* ---------- Rapprochement et état de chaque réponse ---------- */
const champForms = key => `Forms_${key}`;

/** Passation où ranger la réponse (existante ou à créer). */
function passationCible(rep, i) {
  const list = sortBy(S.store.where('RS_CPS', c => c.InscriptionID === i.ID && c.Moment === rep.moment), 'DatePassation');
  if (rep.moment !== 'Autre') return list[0] || null;
  return list.reverse().find(c => c[cpsKey(1, rep.src)] == null) || null;
}

/**
 * États :
 *  integree  : déjà dans une passation ;
 *  nouvelle  : prête à intégrer ;
 *  remplace  : la passation a déjà ce regard (autre réponse Forms ou saisie à la main) ;
 *  doublon   : plusieurs réponses non intégrées pour le même élève, la même source et le même moment ;
 *  inconnu   : code sans inscription ; incomplete : item vide ou libellé non reconnu.
 */
export function analyser(reponses = cache.reponses || []) {
  const parPassation = new Map();
  for (const c of S.store.all('RS_CPS')) for (const s of SOURCES) if (c[champForms(s.key)] != null) parPassation.set(`${s.key}#${c[champForms(s.key)]}`, c);
  const out = reponses.map(rep => {
    const i = inscriptionParCode(rep.code);
    const e = i && eleve(i.EleveID);
    const base = { ...rep, insc: i, eleve: e, nom: e ? nomEleve(e) : null, scores: scores(rep) };
    const deja = parPassation.get(`${rep.src}#${rep.id}`);
    if (deja) return { ...base, etat: 'integree', passation: deja };
    if (!i) return { ...base, etat: 'inconnu' };
    if (rep.valeurs.some(v => v == null) || !MOMENTS.includes(rep.moment)) return { ...base, etat: 'incomplete' };
    const cible = passationCible(rep, i);
    if (cible && cible[cpsKey(1, rep.src)] != null) return { ...base, etat: 'remplace', passation: cible };
    return { ...base, etat: 'nouvelle', passation: cible };
  });
  // Doublons : plusieurs réponses en attente pour le même élève / source / moment (hors « Autre »).
  const groupes = new Map();
  for (const r of out) {
    if (!['nouvelle', 'remplace'].includes(r.etat) || r.moment === 'Autre') continue;
    const k = `${r.src}|${r.insc.ID}|${r.moment}`;
    if (!groupes.has(k)) groupes.set(k, []);
    groupes.get(k).push(r);
  }
  for (const g of groupes.values()) if (g.length > 1) g.forEach(r => { r.etat = 'doublon'; r.nbDoublons = g.length; });
  return sortBy(out, '-date', 'src');
}

/** Intègre une réponse : complète la passation existante ou en crée une. Renvoie la passation. */
export async function integrer(r) {
  const sc = r.scores;
  const patch = { [champForms(r.src)]: r.id, [`FormsDate_${r.src}`]: r.date };
  for (let d = 1; d <= 5; d++) patch[cpsKey(d, r.src)] = sc[d];
  const cible = r.etat === 'doublon' ? passationCible(r, r.insc) : r.passation;
  if (cible) return S.store.update('RS_CPS', cible.ID, patch);
  return S.store.add('RS_CPS', {
    Title: `${r.nom} – ${r.moment}`, EleveID: r.insc.EleveID, InscriptionID: r.insc.ID,
    DatePassation: r.date, Moment: r.moment, ...patch,
  });
}

/** Retrouve une réponse lue (pour la fiche imprimable). */
export function reponse(src, id) {
  return analyser().find(r => r.src === src && r.id === Number(id)) || null;
}
