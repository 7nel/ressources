import { S, nav, inscriptionCourante, volee, phaseInscription, nomEleve, refDate } from '../state.js';
import { h, card, btn, phaseBadge, badge, empty, seg } from '../ui.js';
import { normalise, sortBy, semaineCle } from '../domain.js';

const state = { q: '', statut: 'Actif' };

export function render() {
  const listBox = h('div');
  const sk = semaineCle(refDate());

  const drawList = () => {
    const q = normalise(state.q);
    let els = S.store.all('RS_Eleves').filter(e => state.statut === 'Tous' || e.Statut === state.statut);
    if (q) els = els.filter(e => normalise(`${e.Prenom} ${e.Nom} ${e.Nom} ${e.Prenom}`).includes(q));
    els = sortBy(els, 'Nom', 'Prenom');
    listBox.replaceChildren(els.length
      ? h('ul', { class: 'list' }, els.map(e => {
        const i = inscriptionCourante(e.ID);
        const v = i && volee(i.VoleeID);
        const alerte = S.store.all('RS_Suivis').some(s => s.EleveID === e.ID && s.SemaineCle === sk && (s.Comportement === 1 || s.Travail === 1));
        return h('li', null, h('button', { type: 'button', class: 'item', onClick: () => nav('dossier', { eleve: e.ID }) },
          h('div', { class: 'main' },
            h('div', { class: 'title' }, nomEleve(e)),
            h('div', { class: 'meta' }, i ? `${v?.Title} · ${i.Degre} · classe ${i.ClasseOrigine} · ${i.StatutInscription}` : 'Aucune inscription')),
          h('div', { class: 'end' },
            alerte && badge('niveau 1', 'danger'),
            i && i.StatutInscription === 'En cours' && phaseBadge(phaseInscription(i)),
            e.Statut !== 'Actif' && badge(e.Statut))));
      }))
      : h('div', null,
        empty(state.q ? 'Aucun élève ne correspond à la recherche.' : `Aucun élève au statut « ${state.statut} ».`),
        !state.q && state.statut !== 'Tous' && S.store.all('RS_Eleves').length
          ? btn('Voir tous les dossiers', () => { state.statut = 'Tous'; nav('eleves'); }, 'secondary') : null));
  };

  const search = h('input', {
    type: 'search', placeholder: 'Rechercher un nom ou un prénom', value: state.q, 'aria-label': 'Rechercher un élève',
    onInput: e => { state.q = e.target.value; drawList(); },
  });
  drawList();

  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, 'Élèves'), h('div', { class: 'sub' }, 'Un seul dossier par élève, jamais supprimé (R1).')),
      btn('+ Nouvel élève', () => nav('inscription'))),
    card(null, {},
      h('div', { class: 'row', style: { alignItems: 'center', marginBottom: '8px' } },
        h('div', { style: { flex: '1 1 260px' } }, search),
        seg(['Actif', 'Ancien', 'Archivé', 'Tous'], state.statut, v => { state.statut = v; nav('eleves'); }, 'Statut')),
      listBox));
}
