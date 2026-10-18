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
export const DEF_C = 'respect et ponctualité';
export const DEF_T = 'matériel et mise au travail';
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
