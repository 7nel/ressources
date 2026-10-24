// Validation d'un fichier de données avant tout remplacement de la base active.
// Fonctions pures : elles ne touchent ni à la base ni au navigateur. Elles lèvent une ImportError
// dont le message est destiné à l'utilisateur·trice.

import { LISTS } from './store.js';

/** Listes sans lesquelles l'app ne peut pas fonctionner : un fichier qui en manque est incomplet. */
export const CORE_LISTS = ['RS_Enseignants', 'RS_Cours', 'RS_Volees', 'RS_Eleves', 'RS_Inscriptions'];
const FORMATS = ['RessourceS-bac-a-sable', 'RessourceS-version'];
const LABELS = {
  RS_Enseignants: 'Enseignant·es', RS_Cours: 'Cours', RS_Eleves: 'Élèves', RS_Volees: 'Volées', RS_Inscriptions: 'Inscriptions',
  RS_Suivis: 'Suivis', RS_Devoirs: 'Devoirs', RS_Evaluations: 'Évaluations', RS_Bilans: 'Bilans', RS_Actions: 'Actions',
  RS_CPS: 'CPS', RS_Stages: 'Stages', RS_DocsOrientation: 'Documents d\'orientation', RS_Taches: 'Tâches', RS_Travaux: 'Travaux',
};
export const listLabel = l => LABELS[l] || l;

export class ImportError extends Error {
  constructor(message, code) { super(message); this.name = 'ImportError'; this.code = code; }
}

const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Nombre d'enregistrements par liste connue. */
export function countLists(lists) {
  const out = {};
  for (const l of LISTS) out[l] = Array.isArray(lists?.[l]) ? lists[l].length : 0;
  return out;
}
export const totalOf = counts => Object.values(counts).reduce((a, b) => a + b, 0);

/**
 * Analyse un fichier JSON en entier. Retourne { lists, counts, total, absentes } ou lève une ImportError.
 * `lists` contient aussi les listes inconnues du fichier (elles sont conservées telles quelles).
 */
export function validateImport(text) {
  let data;
  try { data = JSON.parse(text); }
  catch { throw new ImportError('Ce fichier n\'est pas un fichier JSON lisible. Choisissez un fichier exporté par RessourceS.', 'json'); }
  if (!isObj(data) || !isObj(data.lists)) {
    throw new ImportError('Ce fichier ne ressemble pas à une sauvegarde de RessourceS : la liste des données est introuvable.', 'structure');
  }
  if (data.format != null && !FORMATS.includes(data.format)) {
    throw new ImportError(`Format de fichier inconnu (« ${String(data.format).slice(0, 40)} »).`, 'format');
  }
  const lists = data.lists;
  for (const l of LISTS) {
    if (!(l in lists)) continue;
    if (!Array.isArray(lists[l])) throw new ImportError(`La liste « ${listLabel(l)} » est mal formée : une suite d'éléments était attendue.`, 'liste');
    const seen = new Set();
    for (let i = 0; i < lists[l].length; i++) {
      const r = lists[l][i];
      if (!isObj(r) || !Number.isInteger(r.ID) || r.ID < 1) {
        throw new ImportError(`La liste « ${listLabel(l)} » contient un élément invalide (n° ${i + 1}).`, 'element');
      }
      if (seen.has(r.ID)) throw new ImportError(`La liste « ${listLabel(l)} » contient deux éléments avec le même numéro (${r.ID}).`, 'element');
      seen.add(r.ID);
    }
  }
  const manquantes = CORE_LISTS.filter(l => !Array.isArray(lists[l]));
  if (manquantes.length) {
    throw new ImportError(`Fichier incomplet : il manque ${manquantes.map(l => `« ${listLabel(l)} »`).join(', ')}.`, 'incomplet');
  }
  const counts = countLists(lists);
  return { lists, counts, total: totalOf(counts), absentes: LISTS.filter(l => !Array.isArray(lists[l])) };
}

/** Pour la fusion (« Charger ») : seule la forme des listes est vérifiée, les éléments sont déjà tolérés par la fusion. */
export function checkMergeShape(lists) {
  if (!isObj(lists)) throw new ImportError('Fichier non reconnu', 'structure');
  for (const l of LISTS) {
    if (l in lists && !Array.isArray(lists[l])) throw new ImportError(`La liste « ${listLabel(l)} » est mal formée.`, 'liste');
  }
}

/** Résumé lisible : « 6 élèves, 330 évaluations… ». */
export function summarize(counts) {
  const main = [['RS_Eleves', 'élève', 'élèves'], ['RS_Suivis', 'suivi', 'suivis'], ['RS_Evaluations', 'évaluation', 'évaluations'], ['RS_Bilans', 'bilan', 'bilans'], ['RS_Taches', 'tâche', 'tâches']];
  const parts = main.map(([l, one, many]) => `${counts[l] || 0} ${(counts[l] || 0) > 1 ? many : one}`);
  return `${parts.join(', ')} (${totalOf(counts)} enregistrements au total)`;
}
