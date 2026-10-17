import { S, nav, eleve, cours, volee, volees, refDate, voleeAt, nomEleve, coursActifs } from '../state.js';
import { h, card, btn, field, select, badge, empty, esc, phaseBadge } from '../ui.js';
import { fmtDate, fmtNote, weightedAvg, sortBy, groupBy, lastVolee } from '../domain.js';

const state = { eleveId: '', voleeId: null, coursId: '', tri: 'date' };

export function noteChart(evals, { height = 220 } = {}) {
  const pts = sortBy(evals.filter(e => typeof e.Note === 'number'), 'DateEval');
  if (!pts.length) return empty('Aucune note à afficher.');
  const W = Math.max(320, pts.length * 34 + 60), H = height, pl = 34, pr = 10, pt = 12, pb = 26;
  const y = n => pt + (H - pt - pb) * (1 - (n - 1) / 5);
  const bw = Math.min(26, (W - pl - pr) / pts.length - 6);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution des notes, une barre par évaluation, ligne de suffisance à 4">`;
  for (let n = 1; n <= 6; n++) s += `<line x1="${pl}" x2="${W - pr}" y1="${y(n)}" y2="${y(n)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 8}" y="${y(n) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${n}</text>`;
  pts.forEach((e, k) => {
    const x = pl + 6 + k * ((W - pl - pr) / pts.length);
    const col = cours(e.CoursID)?.Couleur || '#888';
    s += `<rect x="${x}" y="${y(e.Note)}" width="${bw}" height="${y(1) - y(e.Note)}" rx="3" fill="${esc(col)}"><title>${esc(fmtDate(e.DateEval))} · ${esc(cours(e.CoursID)?.Title)} · ${esc(e.Sujet)} : ${fmtNote(e.Note)}</title></rect>`;
    s += `<text x="${x + bw / 2}" y="${y(e.Note) - 4}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)">${fmtNote(e.Note)}</text>`;
    s += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(fmtDate(e.DateEval, { year: false }))}</text>`;
  });
  s += `<line x1="${pl}" x2="${W - pr}" y1="${y(4)}" y2="${y(4)}" stroke="var(--danger)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  s += '</svg>';
  return h('div', { class: 'chart scroll-x' }, h('div', { style: { minWidth: `${Math.min(W, 900)}px` }, svg: s }));
}

export function render() {
  const ref = refDate();
  if (state.voleeId == null) state.voleeId = String((voleeAt(ref) || lastVolee(ref, volees()))?.ID || '');
  let ev = S.store.all('RS_Evaluations');
  if (state.voleeId) ev = ev.filter(e => S.store.get('RS_Inscriptions', e.InscriptionID)?.VoleeID === Number(state.voleeId));
  if (state.eleveId) ev = ev.filter(e => e.EleveID === Number(state.eleveId));
  if (state.coursId) ev = ev.filter(e => e.CoursID === Number(state.coursId));
  const sorted = {
    date: () => sortBy(ev, '-DateEval'),
    branche: () => [...ev].sort((a, b) => (cours(a.CoursID)?.Title || '').localeCompare(cours(b.CoursID)?.Title || '', 'fr') || b.DateEval.localeCompare(a.DateEval)),
    eleve: () => [...ev].sort((a, b) => nomEleve(eleve(a.EleveID)).localeCompare(nomEleve(eleve(b.EleveID)), 'fr')),
    note: () => [...ev].sort((a, b) => (a.Note ?? 99) - (b.Note ?? 99)),
  }[state.tri]();

  const elevesOpts = sortBy(S.store.all('RS_Eleves'), 'Nom').map(e => ({ value: e.ID, label: nomEleve(e) }));
  const set = (k) => e => { state[k] = e.target.value; nav('notes'); };

  const filters = card(null, {}, h('div', { class: 'row' },
    field('Élève', select([{ value: '', label: 'Tous les élèves' }, ...elevesOpts], state.eleveId, { onChange: set('eleveId') })),
    field('Volée', select([{ value: '', label: 'Toutes' }, ...volees().map(v => ({ value: v.ID, label: v.Title }))], state.voleeId, { onChange: set('voleeId') })),
    field('Branche', select([{ value: '', label: 'Toutes' }, ...coursActifs().map(c => ({ value: c.ID, label: c.Title }))], state.coursId, { onChange: set('coursId') })),
    field('Tri', select([{ value: 'date', label: 'Date' }, { value: 'branche', label: 'Branche' }, { value: 'eleve', label: 'Élève' }, { value: 'note', label: 'Note' }], state.tri, { onChange: set('tri') }))));

  let moyennes;
  if (state.eleveId) {
    const byC = groupBy(ev.filter(e => typeof e.Note === 'number'), e => e.CoursID);
    const avgs = [...byC].map(([cid, list]) => ({ c: cours(cid), avg: weightedAvg(list), n: list.length })).sort((a, b) => a.c.Title.localeCompare(b.c.Title, 'fr'));
    const gen = avgs.length ? avgs.reduce((a, x) => a + x.avg, 0) / avgs.length : null;
    moyennes = card(`Moyennes pondérées · ${nomEleve(eleve(Number(state.eleveId)))}`, { hint: 'Notes uniquement (le formatif n\'entre pas dans les moyennes). La moyenne générale est la moyenne des branches : indicative.' },
      avgs.length ? h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' } },
        avgs.map(a => h('div', { class: 'tile', style: { borderTop: `5px solid ${a.c.Couleur || 'var(--muted)'}` } },
          h('div', { class: 'num', style: a.avg < 4 ? { color: 'var(--danger)' } : null }, fmtNote(Math.round(a.avg * 10) / 10)),
          h('div', { class: 'lab' }, `${a.c.Title} · ${a.n} note${a.n > 1 ? 's' : ''}`))),
        h('div', { class: 'tile' }, h('div', { class: 'num' }, fmtNote(Math.round(gen * 10) / 10)), h('div', { class: 'lab' }, 'générale (indicative)'))) : empty('Aucune note.'),
      h('h3', { style: { margin: '16px 0 6px' } }, 'Évolution'),
      noteChart(ev));
  } else {
    moyennes = card('Moyennes', {}, h('p', { class: 'muted' }, 'Choisissez un élève pour voir ses moyennes par branche et l\'évolution de ses notes. Pour une vue par classe : ', h('a', { href: '#/branche' }, 'Ma branche'), '.'));
  }

  const list = card(`Évaluations (${ev.length})`, {},
    sorted.length ? h('div', { class: 'scroll-x' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, ['Date', 'Élève', 'Branche', 'Sujet', 'Phase', 'Coef.', 'Résultat'].map((t, k) => h('th', { class: k >= 5 ? 'num' : null }, t)))),
      h('tbody', null, sorted.map(e => h('tr', { style: { cursor: 'pointer' }, onClick: () => nav('evaluation', { id: e.ID }) },
        h('td', { class: 'nowrap' }, fmtDate(e.DateEval)),
        h('td', null, nomEleve(eleve(e.EleveID))),
        h('td', null, h('span', { class: 'dot', style: { background: cours(e.CoursID)?.Couleur, marginRight: '6px' } }), cours(e.CoursID)?.Title),
        h('td', null, e.Sujet, e.Etayage ? h('div', { class: 'small muted' }, `étayage : ${e.Etayage}`) : null),
        h('td', null, phaseBadge(e.Phase)),
        h('td', { class: 'num' }, String(e.Coefficient ?? 1).replace('.', ',')),
        h('td', { class: 'num' }, typeof e.Note === 'number' ? h('strong', { class: e.Note < 4 ? 'danger-text' : null }, fmtNote(e.Note)) : badge(e.ResultatFormatif || '—', e.ResultatFormatif === 'Pas encore' ? 'warn' : 'ok'))))))) : empty('Aucune évaluation pour ces filtres.'));

  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, 'Notes'), h('div', { class: 'sub' }, 'Notes calibrées sur le niveau de la classe d\'origine. Une note sous 4 est un signal.')),
      h('div', { class: 'btn-row' }, btn('Ma branche', () => nav('branche'), 'secondary'), btn('+ Évaluation', () => nav('evaluation')))),
    filters, moyennes, list);
  void volee;
}
