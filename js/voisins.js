// Navigation d'un élève à l'autre depuis un écran du dossier (dossier, orientation, coaching, CPS, bilans).
import { S, nav, eleve, nomEleve, volee, inscriptionsEleve, inscriptionsEnCours } from './state.js';
import { h, btn, modal } from './ui.js';
import { sortBy } from './domain.js';

/** Élèves de la volée de `inscId` (sinon de l'inscription la plus récente de l'élève), par ordre alphabétique, avec leur inscription. */
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
  const titre = liste[0] ? volee(liste[0].i.VoleeID)?.Title : '';
  if (k < 0) return { prev: null, next: null, rang: 0, total: liste.length, titre, horsListe: liste.length > 0 };
  return { prev: liste[k - 1] || null, next: liste[k + 1] || null, rang: k + 1, total: liste.length, titre, horsListe: false };
}

/* ---------- Saisie en cours : on ne quitte pas un formulaire modifié sans le dire ---------- */
let modifie = false;      // un champ d'un formulaire de la page a changé depuis l'affichage
let enregistrer = null;   // enregistre la saisie de l'écran affiché (donné par l'écran), sinon null
let courante = null;      // { prev, next, aller } de l'écran affiché, pour les raccourcis clavier

/** Un formulaire de l'écran affiché a été modifié et pas encore enregistré. */
export const saisieEnCours = () => modifie;

const AIDE_TRI = 'Élèves de la volée en cours, par ordre alphabétique du nom';

if (typeof window !== 'undefined' && document.addEventListener) {
  const marque = ev => { if (ev.target.closest?.('.form') && !ev.target.closest('.modal')) modifie = true; };
  document.addEventListener('input', marque);
  document.addEventListener('change', marque);
  // un nouvel affichage reconstruit l'écran à partir des données enregistrées : plus rien de non enregistré
  const remise = () => { modifie = false; courante = null; };
  window.addEventListener('hashchange', remise);
  window.addEventListener('rs:refresh', remise);
  // Alt+Maj+flèches (Alt+flèche seul est « page précédente » dans Chrome et Edge) ; ignoré dans un champ de saisie
  document.addEventListener('keydown', ev => {
    if (!courante || !ev.altKey || !ev.shiftKey || ev.ctrlKey || ev.metaKey) return;
    if (ev.target.closest?.('input, textarea, select, [contenteditable="true"], .modal')) return;
    const cible = ev.key === 'ArrowLeft' ? courante.prev : ev.key === 'ArrowRight' ? courante.next : null;
    if (!cible) return;
    ev.preventDefault();
    courante.aller(cible);
  });
}

function allerAvecGarde(cible, vers) {
  if (!modifie) { vers(cible); return; }
  const sauver = enregistrer;
  modal('Saisie non enregistrée', h('p', null, `Vous avez modifié ce formulaire sans l'enregistrer. Passer à ${nomEleve(cible.e)} sans enregistrer fera perdre ces changements.`), [
    { label: 'Rester ici', variant: 'secondary' },
    { label: 'Passer sans enregistrer', variant: 'danger secondary', onClick: () => { modifie = false; vers(cible); } },
    sauver && {
      label: 'Enregistrer et passer', onClick: async () => {
        if ((await sauver()) === false) return false; // contrôle de saisie refusé : l'écran affiche le message
        modifie = false; vers(cible);
      },
    },
  ].filter(Boolean));
}

/**
 * En-tête de navigation de l'élève, identique sur tous les écrans du dossier : « Retour » à gauche,
 * élève précédent / rang / élève suivant à droite. Collant sur grand écran.
 *  - `params(e, i)` : adresse de l'écran pour l'élève `e` et son inscription `i`
 *  - `retour` : { label, onClick }
 *  - `enregistrer` : (facultatif) enregistre la saisie de l'écran ; renvoie false si elle est refusée
 */
export function enteteEleve({ route, eleveId, inscId, params, retour, enregistrer: sauver = null }) {
  enregistrer = sauver;
  modifie = false;
  const { prev, next, rang, total, titre, horsListe } = voisins(eleveId, inscId);
  const aller = x => nav(route, params(x.e, x.i));
  courante = prev || next ? { prev, next, aller: x => allerAvecGarde(x, aller) } : null;

  const bouton = (x, sens) => x ? h('button', {
    type: 'button', class: 'btn secondary voisin', 'aria-label': `${nomEleve(x.e)}, ${sens < 0 ? 'élève précédent' : 'élève suivant'}`,
    title: `${sens < 0 ? 'Élève précédent' : 'Élève suivant'} · Alt+Maj+${sens < 0 ? '←' : '→'}`, 'aria-keyshortcuts': `Alt+Shift+Arrow${sens < 0 ? 'Left' : 'Right'}`,
    onClick: () => allerAvecGarde(x, aller),
  }, sens < 0 ? h('span', { 'aria-hidden': 'true' }, '‹ ') : null, nomEleve(x.e), sens > 0 ? h('span', { 'aria-hidden': 'true' }, ' ›') : null)
    : h('span', { class: 'voisin-vide', 'aria-hidden': 'true' });

  const barre = prev || next
    ? h('nav', { class: 'voisins', 'aria-label': 'Passer à un autre élève' },
      bouton(prev, -1), h('span', { class: 'voisins-rang', title: `${AIDE_TRI}. Raccourcis : Alt+Maj+← et Alt+Maj+→` }, `${rang} sur ${total}`, titre && h('span', { class: 'voisins-volee' }, ` · ${titre}`)), bouton(next, 1))
    : horsListe ? h('span', { class: 'muted voisins-rang' }, 'Inscription hors volée en cours : pas d\'élève voisin') : null;

  return h('div', { class: 'eleve-nav no-print' },
    retour && h('button', { type: 'button', class: 'back', onClick: retour.onClick }, retour.label), barre);
}
