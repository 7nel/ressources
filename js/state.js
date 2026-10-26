// État partagé : magasin de données, réglages de l'utilisateur, petites requêtes communes.
import { CONFIG } from './config.js';
import { DEFAULT_LEVEL_LABELS, todayISO, voleeOf, phaseOf, sortBy } from './domain.js';

const SETTINGS_KEY = 'ressources_reglages_v3';

export const S = {
  store: null,
  settings: { moiId: null, labels: [...DEFAULT_LEVEL_LABELS], vueTout: false, theme: 'auto', sansCopie: true },
  route: { name: 'accueil', params: {} },
  dateCourante: null, // date choisie pour la session (null = aujourd'hui) ; jamais enregistrée
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(S.settings, JSON.parse(raw));
  } catch { /* réglages par défaut */ }
  delete S.settings.dateSimulee; // ancienne date simulée enregistrée : on revient à la date du jour
  if (!Array.isArray(S.settings.labels) || S.settings.labels.length !== 4) S.settings.labels = [...DEFAULT_LEVEL_LABELS];
}
export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S.settings)); } catch { /* ignoré */ }
}

export const isSandbox = () => CONFIG.MODE !== 'sharepoint';
/** Date de référence : la date du jour, sauf si on en a choisi une autre pour cette session (clic sur la date de l'accueil). */
export function refDate() { return S.dateCourante || todayISO(); }
export function setDateCourante(d) { S.dateCourante = d && d !== todayISO() ? d : null; }
export const labels = () => S.settings.labels;

/* ---------- Accès aux listes ---------- */
const st = () => S.store;
export const eleve = id => st().get('RS_Eleves', id);
export const cours = id => st().get('RS_Cours', id);
export const ens = id => st().get('RS_Enseignants', id);
export const insc = id => st().get('RS_Inscriptions', id);
export const volee = id => st().get('RS_Volees', id);
export const volees = () => sortBy(st().all('RS_Volees'), 'DateDebut');
export const voleeAt = date => voleeOf(date, st().all('RS_Volees'));
export const coursActifs = () => sortBy(st().all('RS_Cours'), 'Title');
export const enseignantsActifs = () => sortBy(st().where('RS_Enseignants', e => e.Actif !== false), 'Title');

export function nomEleve(e) { return e ? `${e.Prenom} ${e.Nom}` : '(élève inconnu)'; }
export function nomEleveId(id) { return nomEleve(eleve(id)); }

/**
 * Élèves de la volée affichée : en cours, ou ayant terminé la volée (pour revoir une volée passée
 * telle qu'elle était). Les inscriptions interrompues sont exclues.
 */
export function inscriptionsEnCours(voleeId) {
  return st().where('RS_Inscriptions', i => i.VoleeID === voleeId && i.StatutInscription !== 'Interrompue');
}
export function inscriptionsEleve(eleveId) {
  const list = st().where('RS_Inscriptions', i => i.EleveID === eleveId);
  return list.sort((a, b) => (volee(b.VoleeID)?.DateDebut || '').localeCompare(volee(a.VoleeID)?.DateDebut || ''));
}
/** Inscription à afficher par défaut : celle en cours, sinon la plus récente. */
export function inscriptionCourante(eleveId) {
  const list = inscriptionsEleve(eleveId);
  return list.find(i => i.StatutInscription === 'En cours') || list[0] || null;
}
export function phaseInscription(i, date = refDate()) {
  const v = i && volee(i.VoleeID);
  if (!v) return null;
  if (date < v.DateDebut || date > v.DateFin) return null;
  return phaseOf(date, v);
}

/** Libellé quand l'inscription n'est pas dans sa volée à la date affichée : « volée terminée » ou « volée à venir ». */
export function etatVolee(i, date = refDate()) {
  const v = i && volee(i.VoleeID);
  if (!v) return null;
  return date > v.DateFin ? 'volée terminée' : date < v.DateDebut ? 'volée à venir' : null;
}

/* ---------- Identité (simulée en mode test) ---------- */
export function moi() { return S.settings.moiId ? ens(S.settings.moiId) : null; }
/** Coordination, ou personne non reconnue : voit tout (comme dans l'app Power Apps). */
export function isCoord() { const m = moi(); return !m || m.Role === 'Coordination'; }
export function mesCours() { const m = moi(); return m ? coursActifs().filter(c => c.EnseignantID === m.ID) : []; }
/** Vue restreinte à mes cours ? (ergonomie, pas sécurité) */
export function vueRestreinte() { return !isCoord() && !S.settings.vueTout && mesCours().length > 0; }

/* ---------- Navigation ---------- */
export function nav(name, params = {}) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  const hash = `#/${name}${q ? '?' + q : ''}`;
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}
export function back(fallback = 'accueil', params) {
  if (history.length > 1 && S.cameFromApp) history.back();
  else nav(fallback, params);
}
export function refresh() { window.dispatchEvent(new Event('rs:refresh')); }

export function applyTheme() {
  const t = S.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

/** Volée par défaut des écrans de notes : celle de la date, sinon la plus récente qui a des évaluations. */
export function voleeParDefaut(date = refDate()) {
  const withEvals = new Set(S.store.all('RS_Evaluations').map(e => insc(e.InscriptionID)?.VoleeID));
  const v = voleeAt(date);
  if (v && withEvals.has(v.ID)) return v;
  return [...volees()].filter(x => withEvals.has(x.ID) && x.DateDebut <= date).at(-1) || v || volees().filter(x => x.DateDebut <= date).at(-1) || null;
}
