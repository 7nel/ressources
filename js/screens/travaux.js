import { S, nav, back, cours, refDate, voleeAt, vueRestreinte, mesCours } from '../state.js';
import { h, card, btn, badge, empty } from '../ui.js';
import { mondayOf, fmtDate, sortBy, weeksOfVolee, phaseOf } from '../domain.js';
import { travauxAControler } from '../queries.js';

function labelSemaine(mon, ref) {
  const v = voleeAt(ref);
  const base = `semaine du ${fmtDate(mon, { year: false })}`;
  if (!v) return base[0].toUpperCase() + base.slice(1);
  const n = weeksOfVolee(v).indexOf(mon) + 1;
  return n > 0 ? `S${n} (${phaseOf(ref, v).toLowerCase()}) · ${base}` : base[0].toUpperCase() + base.slice(1);
}

function ligne(t, controle = false) {
  const ouvre = controle ? () => nav('groupe', { cours: t.CoursID, travail: t.ID }) : () => nav('travail', { id: t.ID });
  return h('li', null, h('button', { type: 'button', class: 'item', onClick: ouvre },
    h('div', { class: 'main' },
      h('div', { class: 'title' }, t.Title),
      h('div', { class: 'meta' }, `${cours(t.CoursID)?.Title} · ${fmtDate(t.Echeance, { day: true, year: false })}`)),
    h('div', { class: 'end' }, badge(t.Type === 'Devoir' ? 'Devoir à rendre' : 'Évaluation', t.Type === 'Devoir' ? 'neutral' : 'warn'))));
}

export function render() {
  const date = refDate();
  const restreint = vueRestreinte();
  const coursIds = restreint ? mesCours().map(c => c.ID) : null;
  const cset = coursIds && new Set(coursIds);
  const aControler = travauxAControler(date, coursIds);
  const dejaListes = new Set(aControler.map(t => t.ID));
  const aVenir = sortBy(S.store.where('RS_Travaux', t => t.Statut !== 'Annulé' && t.Echeance >= mondayOf(date) && !dejaListes.has(t.ID) && (!cset || cset.has(t.CoursID))), 'Echeance');

  const parSemaine = new Map();
  for (const t of aVenir) {
    const mon = mondayOf(t.Echeance);
    if (!parSemaine.has(mon)) parSemaine.set(mon, []);
    parSemaine.get(mon).push(t);
  }

  return h('div', { class: 'page' },
    h('button', { type: 'button', class: 'back', onClick: () => back('accueil') }, '‹ Retour'),
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, 'Devoirs et évaluations à venir'), h('div', { class: 'sub' }, restreint ? 'Limité à vos cours.' : 'Tous les cours.')),
      h('div', { class: 'btn-row' },
        btn('+ Évaluation', () => nav('travail', { type: 'Évaluation' }), 'secondary'),
        btn('+ Devoir à rendre', () => nav('travail', { type: 'Devoir' })))),
    aControler.length > 0 && card('À contrôler', { hint: 'Échéance passée : un clic ouvre le contrôle du devoir ou la saisie de l\'évaluation.' },
      h('ul', { class: 'list' }, aControler.map(t => ligne(t, true)))),
    [...parSemaine].map(([mon, list]) => card(labelSemaine(mon, list[0].Echeance), {}, h('ul', { class: 'list' }, list.map(ligne)))),
    !aControler.length && !parSemaine.size ? card(null, {}, empty('Rien de prévu pour l\'instant.')) : null);
}
