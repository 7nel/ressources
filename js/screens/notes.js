import { S, voleeParDefaut, nav, eleve, cours, volee, volees, refDate, voleeAt, nomEleve, coursActifs } from '../state.js';
import { h, card, btn, field, select, badge, empty, esc, phaseBadge } from '../ui.js';
import { fmtDate, fmtNote, weightedAvg, sortBy, groupBy, lastVolee } from '../domain.js';
import { notesChartCard, eleveSlot } from './notes-chart.js';

// Filtres cumulables : plusieurs élèves × plusieurs branches (liste vide = tous).
const state = { eleves: [], voleeId: null, cours: [], tri: 'date' };
const toggle = (arr, id) => (arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

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
  if (state.voleeId == null) state.voleeId = String(voleeParDefaut(ref)?.ID || '');
  let ev = S.store.all('RS_Evaluations');
  if (state.voleeId) ev = ev.filter(e => S.store.get('RS_Inscriptions', e.InscriptionID)?.VoleeID === Number(state.voleeId));
  const evVolee = ev;
  if (state.eleves.length) ev = ev.filter(e => state.eleves.includes(e.EleveID));
  if (state.cours.length) ev = ev.filter(e => state.cours.includes(e.CoursID));
  const sorted = {
    date: () => sortBy(ev, '-DateEval'),
    branche: () => [...ev].sort((a, b) => (cours(a.CoursID)?.Title || '').localeCompare(cours(b.CoursID)?.Title || '', 'fr') || b.DateEval.localeCompare(a.DateEval)),
    eleve: () => [...ev].sort((a, b) => nomEleve(eleve(a.EleveID)).localeCompare(nomEleve(eleve(b.EleveID)), 'fr')),
    note: () => [...ev].sort((a, b) => (a.Note ?? 99) - (b.Note ?? 99)),
  }[state.tri]();

  const set = (k) => e => { state[k] = e.target.value; nav('notes'); };
  // Élèves proposés : ceux qui ont une évaluation dans la volée choisie (sinon tous).
  const avecNotes = new Set(evVolee.map(e => e.EleveID));
  const elevesDispo = sortBy(S.store.all('RS_Eleves').filter(e => !state.voleeId || avecNotes.has(e.ID) || state.eleves.includes(e.ID)), 'Nom');
  const branchesDispo = coursActifs().filter(c => !c.EstCoaching);
  const puces = (titre, items, choisis, cle, couleur, label) => h('div', { class: 'filtre-puces' },
    h('div', { class: 'filtre-titre' }, h('span', { class: 'label' }, titre),
      h('button', { type: 'button', class: 'btn ghost sm', 'aria-pressed': String(!choisis.length), onClick: () => { state[cle] = []; nav('notes'); } }, choisis.length ? `Tout afficher (${choisis.length} choisi${choisis.length > 1 ? 's' : ''})` : 'Tous')),
    h('div', { class: 'chips', role: 'group', 'aria-label': titre }, items.map(it => h('button', {
      type: 'button', class: 'chip puce', 'aria-pressed': String(choisis.includes(it.ID)),
      onClick: () => { state[cle] = toggle(state[cle], it.ID); nav('notes'); },
    }, h('span', { class: 'dot', style: { background: couleur(it) } }), label(it)))));

  const filters = card(null, { hint: 'Cliquez pour choisir un ou plusieurs élèves et une ou plusieurs branches ; les filtres se cumulent. Rien de choisi = tous.' },
    h('div', { class: 'row' },
      field('Volée', select([{ value: '', label: 'Toutes' }, ...volees().map(v => ({ value: v.ID, label: v.Title }))], state.voleeId, { onChange: set('voleeId') })),
      field('Tri de la liste', select([{ value: 'date', label: 'Date' }, { value: 'branche', label: 'Branche' }, { value: 'eleve', label: 'Élève' }, { value: 'note', label: 'Note' }], state.tri, { onChange: set('tri') }))),
    puces('Élèves', elevesDispo, state.eleves, 'eleves', e => eleveSlot(e.ID), nomEleve),
    puces('Branches', branchesDispo, state.cours, 'cours', c => c.Couleur || 'var(--muted)', c => c.Title));

  let moyennes;
  const seulEleve = state.eleves.length === 1 ? state.eleves[0] : null;
  if (seulEleve) {
    const byC = groupBy(ev.filter(e => typeof e.Note === 'number'), e => e.CoursID);
    const avgs = [...byC].map(([cid, list]) => ({ c: cours(cid), avg: weightedAvg(list), n: list.length })).sort((a, b) => a.c.Title.localeCompare(b.c.Title, 'fr'));
    const gen = avgs.length ? avgs.reduce((a, x) => a + x.avg, 0) / avgs.length : null;
    moyennes = card(`Moyennes pondérées · ${nomEleve(eleve(seulEleve))}`, { hint: 'Notes uniquement (le formatif n\'entre pas dans les moyennes). La moyenne générale est la moyenne des branches : indicative.' },
      avgs.length ? h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' } },
        avgs.map(a => h('div', { class: 'tile', style: { borderTop: `5px solid ${a.c.Couleur || 'var(--muted)'}` } },
          h('div', { class: 'num', style: a.avg < 4 ? { color: 'var(--danger)' } : null }, fmtNote(Math.round(a.avg * 10) / 10)),
          h('div', { class: 'lab' }, `${a.c.Title} · ${a.n} note${a.n > 1 ? 's' : ''}`))),
        h('div', { class: 'tile' }, h('div', { class: 'num' }, fmtNote(Math.round(gen * 10) / 10)), h('div', { class: 'lab' }, 'générale (indicative)'))) : empty('Aucune note.'));
  } else moyennes = null;
  const graph = card('Graphique', { hint: 'Élèves et branches choisis ci-dessus.' }, notesChartCard(ev));

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
    filters, graph, moyennes, list);
  void volee;
}
