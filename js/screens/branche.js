import { S, nav, eleve, cours, volees, refDate, voleeAt, nomEleve, coursActifs, mesCours } from '../state.js';
import { h, card, btn, field, select, empty, badge } from '../ui.js';
import { fmtDate, fmtNote, weightedAvg, sortBy, lastVolee } from '../domain.js';

const state = { coursId: null, voleeId: null };

export function render() {
  const mine = mesCours().filter(c => !c.EstCoaching);
  const ref = refDate();
  if (!state.coursId) state.coursId = mine[0]?.ID || coursActifs().find(c => !c.EstCoaching)?.ID;
  if (!state.voleeId) state.voleeId = (voleeAt(ref) || lastVolee(ref, volees()))?.ID;
  const c = cours(state.coursId);
  const inscs = S.store.where('RS_Inscriptions', i => i.VoleeID === state.voleeId && i.StatutInscription !== 'Interrompue')
    .map(i => ({ i, e: eleve(i.EleveID) })).sort((a, b) => a.e.Nom.localeCompare(b.e.Nom, 'fr'));

  const rows = inscs.map(({ i, e }) => {
    const ev = sortBy(S.store.where('RS_Evaluations', x => x.InscriptionID === i.ID && x.CoursID === state.coursId), 'DateEval');
    const avg = weightedAvg(ev);
    return h('li', null, h('div', { class: 'item' },
      h('div', { class: 'main' },
        h('button', { type: 'button', class: 'back', style: { fontWeight: 700, color: 'var(--ink)' }, onClick: () => nav('dossier', { eleve: e.ID }) }, nomEleve(e)),
        h('div', { class: 'chips', style: { marginTop: '4px' } }, ev.length ? ev.map(x => h('span', {
          class: `badge ${typeof x.Note === 'number' ? (x.Note < 4 ? 'danger' : 'ok') : x.ResultatFormatif === 'Pas encore' ? 'warn' : 'neutral'}`,
          title: `${fmtDate(x.DateEval)} · ${x.Sujet}${x.Coefficient && x.Coefficient !== 1 ? ` · coef. ${x.Coefficient}` : ''}`,
        }, typeof x.Note === 'number' ? fmtNote(x.Note) : x.ResultatFormatif)) : h('span', { class: 'muted small' }, 'aucune évaluation'))),
      h('div', { class: 'end' },
        avg != null ? h('div', { style: { textAlign: 'right' } }, h('div', { class: 'small muted' }, 'moyenne'), h('strong', { class: avg < 4 ? 'danger-text' : null, style: { fontSize: '1.2rem' } }, fmtNote(Math.round(avg * 10) / 10))) : badge('—'),
        i.StatutInscription === 'En cours' && btn('+ Éval', () => nav('evaluation', { eleve: e.ID, cours: state.coursId }), 'secondary small'))));
  });

  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, 'Ma branche'), h('div', { class: 'sub' }, 'Les élèves de la volée, leurs notes dans la branche et la moyenne pondérée.')),
      h('div', { class: 'btn-row' }, btn('Toutes les notes', () => nav('notes'), 'secondary'))),
    card(null, {}, h('div', { class: 'row' },
      field('Branche', select(coursActifs().filter(x => !x.EstCoaching).map(x => ({ value: x.ID, label: x.Title + (mine.includes(x) ? ' (mon cours)' : '') })), state.coursId, { onChange: e => { state.coursId = Number(e.target.value); nav('branche'); } })),
      field('Volée', select(volees().map(v => ({ value: v.ID, label: v.Title })), state.voleeId, { onChange: e => { state.voleeId = Number(e.target.value); nav('branche'); } }))),
    h('div', { class: 'btn-row', style: { marginTop: '12px' } },
      btn('Évaluation de groupe', () => nav('groupe', { cours: state.coursId, mode: 'eval' })),
      btn('Cotations de groupe', () => nav('groupe', { cours: state.coursId, mode: 'cot' }), 'secondary'))),
    card(c ? `${c.Title} · ${inscs.length} élève${inscs.length > 1 ? 's' : ''}` : 'Branche', {},
      rows.length ? h('ul', { class: 'list' }, rows) : empty('Aucun élève dans cette volée.')));
}
