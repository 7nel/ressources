// Règles métier du dispositif (cahier des charges, Phase 2).
// Aucune dépendance à l'affichage : ces fonctions resteront valables avec SharePoint.

export const PHASES = ['Décompression', 'Remobilisation', 'Ré-exposition'];
export const PHASE_CLASS = { 'Décompression': 'ph1', 'Remobilisation': 'ph2', 'Ré-exposition': 'ph3' };
export const DEGRES = ['9CO', '10CO', '10CO libérable', '11CO'];
export const STATUTS_ELEVE = ['Actif', 'Ancien', 'Archivé'];
export const STATUTS_INSCRIPTION = ['En cours', 'Terminée', 'Interrompue'];
export const DOMAINES = [
  'Résoudre un problème / prendre une décision',
  'Communiquer / relations avec les autres',
  'Gestion du stress et des émotions',
  'Conscience de soi / empathie',
  'Pensée critique / créative',
];
export const DOMAINES_COURTS = ['Problème / décision', 'Communication', 'Stress / émotions', 'Conscience de soi', 'Pensée critique'];
export const REGARDS = [
  { key: 'Eleve', label: 'Élève', max: 5, color: '#2F6F63' },
  { key: 'Titulaire', label: 'Titulaire', max: 5, color: '#B5651D' },
  { key: 'Parents', label: 'Parents', max: 5, color: '#5B6FB0' },
  { key: 'Boussole', label: 'Coach (boussole)', max: 4, color: '#8E3B5E' },
];
export const FORMATIF = ['Réussi seul', 'Avec aide', 'Pas encore'];
export const TYPES_BILAN = [
  { key: 'MR', label: 'Mise en route' },
  { key: 'INT', label: 'Intermédiaire' },
  { key: 'FIN', label: 'Final' },
];
export const STATUTS_ACTION = ['À faire', 'En cours', 'Fait', 'Abandonnée'];
export const STATUTS_TACHE = ['À faire', 'En cours', 'Terminée'];
export const STATUTS_STAGE = ['Demandé', 'Prévu', 'Effectué', 'Annulé'];
export const TYPES_DOC = ['CV', 'Lettre de motivation', 'Autre'];
export const STATUTS_DOC = ['À faire', 'En cours', 'Terminé'];
/* ---------- Familles de cours (moyennes hebdomadaires C/T) ---------- */
export const GROUPES = ['Branches', 'Projet', 'Méthodo / Orientation'];
const PROJET = ['acm', 'arts visuels', 'artv', 'musique', 'sport', 'theatre', 'education physique'];
const METHODO = ['methodo', 'orientation'];
/** Famille d'un cours : champ Groupe s'il existe, sinon déduite du nom. Le coaching n'a aucune cotation. */
export function groupeCours(c) {
  if (!c) return null;
  if (c.EstCoaching) return 'Coaching';
  if (c.Groupe && (GROUPES.includes(c.Groupe))) return c.Groupe;
  const t = String(c.Title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (METHODO.some(k => t.includes(k))) return 'Méthodo / Orientation';
  if (PROJET.some(k => t.includes(k))) return 'Projet';
  return 'Branches';
}
export const estCote = s => typeof s.Comportement === 'number' && typeof s.Travail === 'number';
export function moyenne(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }

export const DEF_C = 'respect';
export const DEF_T = 'mise au travail';
/** Ponctualité et matériel : constats cochés à part, hors cotation C/T. */
export const REPERES = [['Retard', 'en retard'], ['MaterielManquant', 'matériel manquant']];
export const DEFAULT_LEVEL_LABELS = ['désengagé', 'engagement fragile', 'globalement engagé', 'engagé'];

/* ---------- Dates (chaînes ISO AAAA-MM-JJ, calculs en UTC pour éviter les décalages) ---------- */
export function parseDate(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function toISO(d) { return d.toISOString().slice(0, 10); }
export function addDays(s, n) { const d = parseDate(s); d.setUTCDate(d.getUTCDate() + n); return toISO(d); }
export function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
export function mondayOf(s) { const d = parseDate(s); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return toISO(d); }
export function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Semaine ISO 8601 : clé AAAA × 100 + semaine (ex. 202641). */
export function semaineCle(s) {
  const d = parseDate(s);
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const year = thu.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const firstThu = new Date(jan4);
  firstThu.setUTCDate(4 - ((jan4.getUTCDay() + 6) % 7) + 3);
  const week = 1 + Math.round((thu - firstThu) / 604800000);
  return year * 100 + week;
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function fmtDate(s, { day = false, year = true } = {}) {
  if (!s) return '—';
  const d = parseDate(s);
  const base = `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}${year ? '.' + d.getUTCFullYear() : ''}`;
  return day ? `${JOURS[d.getUTCDay()]} ${base}` : base;
}
export function fmtDateLong(s) {
  const d = parseDate(s);
  return `${JOURS[d.getUTCDay()].replace('.', '')} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/* ---------- Volées et phases (R4 : la phase est calculée, jamais saisie) ---------- */
export function phaseOf(date, volee) {
  if (!volee || !date) return null;
  if (date < volee.DateDebutRemob) return 'Décompression';
  if (date < volee.DateDebutReexpo) return 'Remobilisation';
  return 'Ré-exposition';
}
export function voleeOf(date, volees) {
  return volees.find(v => v.DateDebut <= date && date <= v.DateFin) || null;
}
export function nextVolee(date, volees) {
  return [...volees].filter(v => v.DateDebut > date).sort((a, b) => a.DateDebut.localeCompare(b.DateDebut))[0] || null;
}
export function lastVolee(date, volees) {
  return [...volees].filter(v => v.DateFin < date).sort((a, b) => b.DateFin.localeCompare(a.DateFin))[0] || null;
}
/** Lundis des semaines couvertes par la volée. */
export function weeksOfVolee(v) {
  const out = [];
  for (let m = mondayOf(v.DateDebut); m <= v.DateFin; m = addDays(m, 7)) out.push(m);
  return out;
}

/* ---------- Absences : décompte en heures ---------- */
// Matin 4 h, après-midi 3 h ; le mercredi n'a pas d'après-midi d'école (4 h au plus).
// Une absence : Duree 'Heure' | 'Demi-journée' | 'Journée' ; Moment 'Matin' | 'Après-midi' pour l'heure et la demi-journée.
export const HEURES_MATIN = 4;
export const HEURES_APREM = 3;
export const DUREES_ABSENCE = ['Heure', 'Demi-journée', 'Journée'];
export const MOMENTS = ['Matin', 'Après-midi'];
export const estMercredi = date => parseDate(date).getUTCDay() === 3;
export const heuresMaxJour = date => estMercredi(date) ? HEURES_MATIN : HEURES_MATIN + HEURES_APREM;
const heuresMoment = (moment, date) => moment === 'Matin' ? HEURES_MATIN : estMercredi(date) ? 0 : HEURES_APREM;
/**
 * Heures d'absence d'un élève sur un jour, à partir de toutes ses absences de ce jour (plusieurs cours) :
 * une journée couvre tout ; par demi-journée, une demi-journée couvre ses heures, sinon les heures s'ajoutent
 * jusqu'à la durée de la demi-journée (4 h le matin, 3 h l'après-midi, rien le mercredi après-midi).
 */
export function heuresJour(absences) {
  if (!absences.length) return 0;
  const date = absences[0].DateAbsence;
  if (absences.some(a => a.Duree === 'Journée')) return heuresMaxJour(date);
  let n = 0;
  for (const m of MOMENTS) {
    const max = heuresMoment(m, date);
    const l = absences.filter(a => a.Moment === m);
    n += l.some(a => a.Duree === 'Demi-journée') ? max : Math.min(max, l.filter(a => a.Duree === 'Heure').length);
  }
  return n;
}
/** Total d'heures d'absence, jour par jour (les absences peuvent mêler plusieurs élèves). */
export function totalHeuresAbsence(absences) {
  let n = 0;
  for (const l of groupBy(absences, a => `${a.EleveID}|${a.DateAbsence}`).values()) n += heuresJour(l);
  return n;
}
export function libelleAbsence(a) {
  const m = a.Moment === 'Matin' ? 'le matin' : 'l\'après-midi';
  if (a.Duree === 'Journée') return `journée${estMercredi(a.DateAbsence) ? ' (mercredi)' : ''}`;
  if (a.Duree === 'Demi-journée') return a.Moment === 'Matin' ? 'matin' : 'après-midi';
  return `1 heure ${m}`;
}
export const fmtHeures = n => `${n}\u00a0h`;

/* ---------- Grille horaire de la classe ressource ---------- */
// Grille de l'ann\u00e9e (classe RessourceS) : une case = une p\u00e9riode, matin 4, apr\u00e8s-midi 3, mercredi matin seul. L'\u00e9tude n'est pas compt\u00e9e.
// \u00ab Cours normaux \u00bb : l'\u00e9l\u00e8ve est dans sa classe d'origine. Une branche est reli\u00e9e \u00e0 un cours de l'app par mots-cl\u00e9s dans son titre.
const N = 'Cours normaux';
export const GRILLE = [
  /* lundi    */ { Matin: ['Allemand', 'Maths', 'Fran\u00e7ais', 'M\u00e9thodo / Orientation'], 'Apr\u00e8s-midi': ['ACM', 'ACM', 'ACM'] },
  /* mardi    */ { Matin: [N, 'Maths', 'Fran\u00e7ais', 'Sciences'], 'Apr\u00e8s-midi': ['Musique', 'Musique', 'Musique'] },
  /* mercredi */ { Matin: [N, 'Maths', 'Dessin', 'Dessin'], 'Apr\u00e8s-midi': [] },
  /* jeudi    */ { Matin: [N, 'Maths', 'Anglais', 'Fran\u00e7ais'], 'Apr\u00e8s-midi': ['Sport', 'Sport', 'Sport'] },
  /* vendredi */ { Matin: [N, N, 'Sciences', 'Fran\u00e7ais'], 'Apr\u00e8s-midi': ['Th\u00e9\u00e2tre', 'Th\u00e9\u00e2tre', 'Bilan'] },
];
export const BRANCHE_NON_PRECISEE = 'Non pr\u00e9cis\u00e9';
const MOTS_BRANCHE = {
  Allemand: ['allemand'], Maths: ['math'], Fran\u00e7ais: ['francais'], 'M\u00e9thodo / Orientation': ['methodo', 'orientation'],
  Sciences: ['science'], Anglais: ['anglais'], Dessin: ['dessin', 'arts visuels', 'artv'], ACM: ['acm'], Musique: ['musique'],
  Sport: ['sport', 'education physique'], Th\u00e9\u00e2tre: ['theatre'], Bilan: ['bilan'],
};
/** Branche de la grille qui correspond \u00e0 un titre de cours (null : cours absent de la grille, coaching par exemple). */
export function brancheDuCours(titre) {
  const t = normalise(titre);
  if (!t) return null;
  return Object.keys(MOTS_BRANCHE).find(b => MOTS_BRANCHE[b].some(k => t.includes(k))) || null;
}
/** P\u00e9riodes d'un jour et d'un moment selon la grille (vide le week-end). */
export function periodes(date, moment) {
  const j = (parseDate(date).getUTCDay() + 6) % 7;
  return GRILLE[j]?.[moment] || [];
}
/**
 * Heures d'absence d'un \u00e9l\u00e8ve sur un jour, r\u00e9parties par branche selon la grille : { branche: heures }.
 * Une journ\u00e9e ou une demi-journ\u00e9e couvre ses p\u00e9riodes. Une heure va \u00e0 une p\u00e9riode du cours o\u00f9 elle a \u00e9t\u00e9 saisie,
 * sinon (coaching, cours hors grille) en \u00ab Non pr\u00e9cis\u00e9 \u00bb, sans d\u00e9passer la demi-journ\u00e9e. Le total \u00e9gale heuresJour.
 * `titreCours(a)` donne le titre du cours de l'absence.
 */
export function branchesJour(absences, titreCours) {
  const out = {};
  const plus = (b, n = 1) => { out[b] = (out[b] || 0) + n; };
  if (!absences.length) return out;
  const date = absences[0].DateAbsence;
  const journee = absences.some(a => a.Duree === 'Journ\u00e9e');
  for (const m of MOMENTS) {
    const slots = periodes(date, m);
    const max = heuresMoment(m, date);
    const l = absences.filter(a => a.Moment === m);
    if (journee || l.some(a => a.Duree === 'Demi-journ\u00e9e')) {
      slots.slice(0, max).forEach(b => plus(b));
      if (slots.length < max) plus(BRANCHE_NON_PRECISEE, max - slots.length);
      continue;
    }
    const libres = slots.slice(0, max);
    let n = 0;
    for (const a of l.filter(x => x.Duree === 'Heure')) {
      if (n >= max) break;
      const b = brancheDuCours(titreCours(a));
      const k = b ? libres.indexOf(b) : -1;
      if (k >= 0) { libres.splice(k, 1); plus(b); } else plus(BRANCHE_NON_PRECISEE);
      n++;
    }
  }
  return out;
}
/** Heures d'absence par branche, jour par jour et \u00e9l\u00e8ve par \u00e9l\u00e8ve, tri\u00e9es par heures d\u00e9croissantes : [[branche, heures]]. */
export function heuresParBranche(absences, titreCours) {
  const tot = {};
  for (const l of groupBy(absences, a => `${a.EleveID}|${a.DateAbsence}`).values()) {
    for (const [b, n] of Object.entries(branchesJour(l, titreCours))) tot[b] = (tot[b] || 0) + n;
  }
  return Object.entries(tot).sort((a, b) => b[1] - a[1] || (a[0] === BRANCHE_NON_PRECISEE) - (b[0] === BRANCHE_NON_PRECISEE) || a[0].localeCompare(b[0], 'fr'));
}
/**
 * P\u00e9riodes de la grille couvertes par les absences d'un \u00e9l\u00e8ve sur un jour : un tableau de bool\u00e9ens par moment
 * ({ Matin: [...], 'Apr\u00e8s-midi': [...] }), pour savoir s'il a manqu\u00e9 tout un cours.
 */
export function periodesManquees(absences, titreCours) {
  const out = {};
  if (!absences.length) return out;
  const date = absences[0].DateAbsence;
  const journee = absences.some(a => a.Duree === 'Journ\u00e9e');
  for (const m of MOMENTS) {
    const slots = periodes(date, m);
    const l = absences.filter(a => a.Moment === m);
    if (journee || l.some(a => a.Duree === 'Demi-journ\u00e9e')) { out[m] = slots.map(() => true); continue; }
    const pris = slots.map(() => false);
    for (const a of l.filter(x => x.Duree === 'Heure')) {
      const b = brancheDuCours(titreCours(a));
      const k = slots.findIndex((s, i) => !pris[i] && s === b);
      if (k >= 0) pris[k] = true;
    }
    out[m] = pris;
  }
  return out;
}

/* ---------- Retenue du vendredi (R9) ---------- */
export function retenueMinutes(n) { return n >= 1 ? Math.min(60, 15 + 5 * (n - 1)) : 0; }

/* ---------- Doublons (R2) ---------- */
export function normalise(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
export function cleDoublon(nom, prenom) { return `${normalise(nom)}|${normalise(prenom)}`; }

/* ---------- Notes ---------- */
export function parseNote(str) {
  if (str == null || String(str).trim() === '') return null;
  const n = Number(String(str).replace(',', '.').trim());
  if (!Number.isFinite(n) || n < 1 || n > 6) return NaN;
  return Math.round(n * 10) / 10;
}
export function fmtNote(n) { return n == null ? '—' : Number(n).toFixed(1).replace('.', ','); }
export function weightedAvg(evals) {
  const withNotes = evals.filter(e => typeof e.Note === 'number');
  const sumC = withNotes.reduce((a, e) => a + (e.Coefficient || 1), 0);
  if (!sumC) return null;
  return withNotes.reduce((a, e) => a + e.Note * (e.Coefficient || 1), 0) / sumC;
}
/** R5 : ce que l'évaluation demande selon la phase. */
export function evalMode(phase) {
  if (phase === 'Décompression') return 'formatif';
  if (phase === 'Remobilisation') return 'etayee';
  return 'normale';
}

/* ---------- CPS ---------- */
export function cpsKey(d, regard) { return `D${d}_${regard}`; }
/** Boussole 1–4 ramenée sur 1–5 pour le tracé. */
export function scaleBoussole(v) { return v == null ? null : 1 + (v - 1) * 4 / 3; }
export const SEUIL_ECART = 1.5;

/* ---------- Divers ---------- */
export function sortBy(arr, ...keys) {
  return [...arr].sort((a, b) => {
    for (const k of keys) {
      const desc = k.startsWith('-');
      const f = desc ? k.slice(1) : k;
      const va = a[f] ?? '', vb = b[f] ?? '';
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'fr');
      if (c) return desc ? -c : c;
    }
    return 0;
  });
}
export function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}
