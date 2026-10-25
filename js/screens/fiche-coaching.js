// Fiche de suivi coaching : reprend le document papier « Suivi dossier » (bilans + tableau hebdomadaire).
import { S, back, insc, eleve, volee, cours, nomEleve } from '../state.js';
import { h, btn, notice, card } from '../ui.js';
import { bilanDe } from '../queries.js';
import { modeleFiche } from '../fiche-coaching-modele.js';

const LIB_TRAVAILLE = 'Ce qui a été travaillé / notion ciblée', LIB_PROGRES = 'Progrès · point de vigilance';

export function render(params) {
  const i = insc(params.insc);
  if (!i) return h('div', { class: 'page' }, notice('Inscription introuvable.', 'danger'));
  const e = eleve(i.EleveID), v = volee(i.VoleeID);
  const mr = bilanDe(i.ID, 'Mise en route'), it = bilanDe(i.ID, 'Intermédiaire'), fin = bilanDe(i.ID, 'Final');
  const coachingIds = new Set(S.store.where('RS_Cours', c => c.EstCoaching).map(c => c.ID));
  const sv = S.store.where('RS_Suivis', s => s.InscriptionID === i.ID && coachingIds.has(s.CoursID));
  const { bilans, semaines } = modeleFiche(v, { mr, it, fin }, sv);

  // Les deux présentations (tableau, et par entrée sous 560 px) ne font que mettre en page ce modèle.
  const tableauBilans = h('table', { class: 'print-tbl' },
    h('tbody', null, bilans.map((b, k) => [
      h('tr', null,
        h('th', { rowspan: 2, style: k === 0 ? { width: '18%' } : null }, b.titre),
        h('th', { style: k === 0 ? { width: '22%' } : null }, b.lignes[0].libelle),
        h('td', null, b.lignes[0].valeur),
        h('td', { rowspan: 2, style: k === 0 ? { width: '20%' } : null }, b.signature)),
      h('tr', null, h('th', null, b.lignes[1].libelle), h('td', null, b.lignes[1].valeur))])));

  const tableauHebdo = h('table', { class: 'print-tbl' },
    h('thead', null, h('tr', null, h('th', null, 'N°'), h('th', null, 'Semaine'), h('th', null, 'Phase'), h('th', null, LIB_TRAVAILLE), h('th', null, LIB_PROGRES))),
    h('tbody', null, semaines.map(w => h('tr', null,
      h('td', null, w.numero),
      h('td', { class: 'nowrap' }, w.dates),
      h('td', null, w.phase),
      h('td', null, w.travaille.map(t => h('div', null, t))),
      h('td', null, w.progres.map(t => h('div', null, t)))))));

  // Petits écrans : une section par bilan et par semaine. Une valeur absente est annoncée « Non renseigné » (le tiret seul ne dit rien).
  const valeur = x => (x && String(x).trim()) ? x : h('span', { class: 'coach-vide' }, h('span', { 'aria-hidden': 'true' }, '–'), h('span', { class: 'sr-only' }, 'Non renseigné'));
  const section = (titre, dl, note) => h('section', { class: 'coach-groupe' }, h('h3', null, titre), h('dl', null, dl), note ? h('p', { class: 'coach-sig' }, note) : null);
  const entrees = bilans.map(b => section(b.titre, b.lignes.map(l => [h('dt', null, l.libelle), h('dd', null, valeur(l.valeur))]), b.signature));
  const parEntreeBilans = h('div', { class: 'coach-mobile' }, entrees);
  const parEntreeHebdo = h('div', { class: 'coach-mobile' }, semaines.map(w => section(
    `Semaine ${w.numero} · ${w.dates} · ${w.phase}`,
    [[LIB_TRAVAILLE, w.travaille], [LIB_PROGRES, w.progres]].map(([lib, textes]) => [h('dt', null, lib), h('dd', null, textes.length ? textes.map(t => h('div', null, t)) : valeur(''))]))));

  return h('div', { class: 'page' },
    h('div', { class: 'btn-row no-print' },
      h('button', { type: 'button', class: 'back', onClick: () => back('dossier', { eleve: e.ID }) }, '‹ Retour au dossier'),
      btn('Imprimer', () => window.print(), 'secondary')),
    h('div', null, h('h1', null, `Coaching · ${nomEleve(e)}`), h('div', { class: 'sub muted' }, `${v.Title} · ${i.Degre} · classe ${i.ClasseOrigine} · titulaire ${i.Titulaire}`)),
    card('Bilans de coordination', {}, h('div', { class: 'scroll-x coach-tableau' }, tableauBilans), parEntreeBilans),
    card('Suivi hebdomadaire', { hint: `Tiré des suivis du cours ${[...coachingIds].map(id => cours(id)?.Title).join(', ')}.` }, h('div', { class: 'scroll-x coach-tableau' }, tableauHebdo), parEntreeHebdo));
}
