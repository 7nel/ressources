// Suivi : cotations de comportement et de travail de la semaine, et actions en cours, pour tous les élèves de la volée.
import { S, nav, voleeAt, inscriptionsEnCours, eleve, nomEleve, cours, refDate, vueRestreinte, mesCours, moi, labels } from '../state.js';
import { h, card, btn, empty, notice, badge, ctPair, levelLegend, phaseBadge } from '../ui.js';
import { fmtDate, fmtDateLong, mondayOf, addDays, semaineCle, phaseOf, sortBy, weeksOfVolee } from '../domain.js';
import { suivisDeSemaine } from '../queries.js';

const state = { date: null, ref: null }; // semaine affichée ; revient à la date de référence quand celle-ci change

const ouverte = a => !['Fait', 'Abandonnée'].includes(a.Statut);

export function render() {
  if (state.ref !== refDate()) { state.ref = refDate(); state.date = null; }
  const date = state.date || refDate();
  const v = voleeAt(date);
  if (!v) return h('div', { class: 'page' }, h('h1', null, 'Suivi'), notice('Aucune volée en cours à cette date.', 'info'));

  const lundi = mondayOf(date);
  const sk = semaineCle(date);
  const restreint = vueRestreinte();
  const coursIds = restreint ? new Set(mesCours().map(c => c.ID)) : null;
  const m = moi();
  const L = labels();
  const aller = d => { state.date = d; nav('suivi'); };
  const semaines = weeksOfVolee(v);
  const rang = semaines.indexOf(lundi) + 1;

  const inscs = inscriptionsEnCours(v.ID);
  const suivis = suivisDeSemaine(sk, inscs.map(i => i.ID)).filter(s => !coursIds || coursIds.has(s.CoursID));
  const actions = S.store.where('RS_Actions', a => ouverte(a) && inscs.some(i => i.ID === a.InscriptionID) && (!restreint || a.Responsable === m?.Title));

  const lignes = sortBy(inscs.map(i => {
    const e = eleve(i.EleveID);
    return { Nom: e?.Nom || '', Prenom: e?.Prenom || '', i, e };
  }), 'Nom', 'Prenom');

  const cellSuivi = list => list.length
    ? h('div', { class: 'suivi-cell' }, sortBy(list, 'DateSuivi').map(s => h('span', { class: 'suivi-it' },
      h('span', { class: 'suivi-cours' }, `${cours(s.CoursID)?.Title || '?'} · ${fmtDate(s.DateSuivi, { day: true, year: false })}`),
      ctPair(s.Comportement, s.Travail, L))))
    : h('span', { class: 'muted' }, 'pas de cotation');

  const cellActions = list => list.length
    ? h('ul', { class: 'suivi-actions' }, sortBy(list, 'Echeance').map(a => {
      const retard = a.Echeance && a.Echeance < refDate();
      return h('li', null, h('button', { type: 'button', class: 'back', onClick: () => nav('action', { id: a.ID }) },
        a.Description || '(sans description)'),
      h('span', { class: 'muted small' }, ` · ${a.Responsable || '—'}${a.Echeance ? ` · pour le ${fmtDate(a.Echeance, { day: true, year: false })}` : ''} `),
      retard && badge('en retard', 'danger'));
    }))
    : h('span', { class: 'muted' }, 'aucune');

  const corps = lignes.map(({ i, e }) => h('tr', null,
    h('th', { scope: 'row' }, h('button', { type: 'button', class: 'back', onClick: () => nav('dossier', { eleve: i.EleveID }) }, nomEleve(e))),
    h('td', null, cellSuivi(suivis.filter(s => s.InscriptionID === i.ID))),
    h('td', null, cellActions(actions.filter(a => a.InscriptionID === i.ID)))));

  const tableau = h('div', { class: 'scroll-x' }, h('table', { class: 'tbl' },
    h('caption', { class: 'sr-only' }, `Cotations de comportement et de travail de la semaine ${sk % 100} et actions en cours, par élève`),
    h('thead', null, h('tr', null,
      h('th', { scope: 'col' }, 'Élève'),
      h('th', { scope: 'col' }, 'Comportement (C) et travail (T) cette semaine'),
      h('th', { scope: 'col' }, 'Actions en cours'))),
    h('tbody', null, corps)));

  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', null,
        h('h1', null, 'Suivi'),
        h('div', { class: 'sub' }, `${v.Title} · semaine ${rang} sur ${semaines.length} · du ${fmtDateLong(lundi)}`)),
      h('div', { class: 'btn-row' },
        phaseBadge(phaseOf(date, v)),
        btn('‹ Semaine précédente', () => aller(addDays(lundi, -7)), 'secondary', { disabled: lundi <= mondayOf(v.DateDebut) }),
        btn('Semaine suivante ›', () => aller(addDays(lundi, 7)), 'secondary', { disabled: addDays(lundi, 7) > v.DateFin }),
        lundi !== mondayOf(refDate()) && btn('Cette semaine', () => aller(null), 'secondary'))),
    card('Cotations et actions', { hint: restreint ? 'Vue limitée à vos cours et aux actions qui vous sont attribuées.' : 'Toutes les cotations de la semaine et toutes les actions ouvertes. Indicateur de tendance, à discuter.' },
      levelLegend(L, { compact: true }),
      lignes.length ? tableau : empty('Aucun élève inscrit dans cette volée.')));
}
