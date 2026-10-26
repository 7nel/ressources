// Navigation d'un élève à l'autre depuis un écran du dossier (dossier, orientation, coaching, CPS, bilans).
import { S, nav, eleve, nomEleve, inscriptionsEleve, inscriptionsEnCours } from './state.js';
import { h } from './ui.js';
import { sortBy } from './domain.js';

/** Élèves de la volée de `inscId` (sinon de l'inscription en cours de l'élève), par ordre alphabétique, avec leur inscription. */
export function listeVolee(eleveId, inscId) {
  const mienne = (inscId && S.store.get('RS_Inscriptions', inscId)) || inscriptionsEleve(eleveId)[0];
  if (!mienne) return [];
  const rows = inscriptionsEnCours(mienne.VoleeID).map(i => ({ i, e: eleve(i.EleveID) })).filter(x => x.e)
    .map(x => ({ ...x, Nom: x.e.Nom, Prenom: x.e.Prenom }));
  return sortBy(rows, 'Nom', 'Prenom');
}

/** Élève précédent et suivant dans la liste, sans retour au début ni à la fin. */
export function voisins(eleveId, inscId) {
  const liste = listeVolee(eleveId, inscId);
  const k = liste.findIndex(x => x.e.ID === eleveId);
  if (k < 0) return { prev: null, next: null, rang: 0, total: liste.length };
  return { prev: liste[k - 1] || null, next: liste[k + 1] || null, rang: k + 1, total: liste.length };
}

/**
 * Boutons « ‹ Nom » / « Nom › » pour passer à l'élève voisin en restant sur le même écran.
 * `params(e, i)` donne l'adresse de l'écran pour l'élève `e` et son inscription `i`.
 */
export function barreEleves(route, eleveId, inscId, params) {
  const { prev, next, rang, total } = voisins(eleveId, inscId);
  if (!prev && !next) return null;
  const bouton = (x, sens) => x ? h('button', {
    type: 'button', class: 'btn ghost small voisin', 'aria-label': `${sens === -1 ? 'Élève précédent' : 'Élève suivant'} : ${nomEleve(x.e)}`,
    title: nomEleve(x.e), onClick: () => nav(route, params(x.e, x.i)),
  }, sens === -1 ? `‹ ${x.e.Prenom}` : `${x.e.Prenom} ›`) : h('span', { class: 'voisin-vide', 'aria-hidden': 'true' });
  return h('nav', { class: 'voisins', 'aria-label': 'Passer à un autre élève' },
    bouton(prev, -1), h('span', { class: 'muted voisins-rang' }, `${rang} / ${total}`), bouton(next, 1));
}
