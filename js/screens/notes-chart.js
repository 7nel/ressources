// Graphique de la page Notes : tous les élèves à la fois, couleur au choix, mise en avant au clic.
//  - Évolution : un point par note (date × note), couleur par élève, par branche ou par résultat.
//  - Moyennes : une barre par élève ou par branche (moyenne pondérée), ligne du 4.
// Couleurs d'élève : palette catégorielle validée (8 teintes), attribuée par élève et non par rang,
// pour qu'un filtre ne repeigne jamais les élèves restants.
import { S, eleve, cours, nomEleve } from '../state.js';
import { h, esc, seg, empty } from '../ui.js';
import { fmtDate, fmtNote, weightedAvg, groupBy, parseDate } from '../domain.js';

const CAT = 8;
export const chartState = { vue: 'evolution', couleur: 'eleve', groupe: 'eleve', focus: null, lignes: true };

/** Couleur stable d'un élève : rang de son ID parmi tous les élèves du dossier. */
function eleveSlot(id) {
  const ids = S.store.all('RS_Eleves').map(e => e.ID).sort((a, b) => a - b);
  const k = ids.indexOf(id);
  return k >= 0 && k < CAT ? `var(--cat${k + 1})` : 'var(--muted)';
}
const OK = 'var(--l4)', BAS = 'var(--danger)';

function seriesOf(ev, mode) {
  if (mode === 'eleve') return [...groupBy(ev, e => e.EleveID)].map(([id, l]) => ({ key: `e${id}`, label: nomEleve(eleve(id)), color: eleveSlot(id), items: l }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  if (mode === 'branche') return [...groupBy(ev, e => e.CoursID)].map(([id, l]) => ({ key: `c${id}`, label: cours(id)?.Title || '?', color: cours(id)?.Couleur || 'var(--muted)', items: l }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  return [
    { key: 'ok', label: '4 et plus', color: OK, items: ev.filter(e => e.Note >= 4) },
    { key: 'bas', label: 'sous 4 (signal)', color: BAS, items: ev.filter(e => e.Note < 4) },
  ].filter(s => s.items.length);
}

function tooltip() {
  let tip = document.querySelector('.chart-tip');
  if (!tip) { tip = h('div', { class: 'chart-tip', role: 'status', hidden: true }); document.body.appendChild(tip); }
  return tip;
}
function wireTooltips(root, lookup) {
  const tip = tooltip();
  const show = (target, x, y) => {
    const d = lookup[target.dataset.k];
    if (!d) return;
    tip.replaceChildren(...d.map((line, i) => h(i ? 'div' : 'strong', null, line)));
    tip.style.left = `${Math.min(x + 14, window.innerWidth - tip.offsetWidth - 8)}px`;
    tip.style.top = `${y + 14}px`;
    tip.hidden = false;
  };
  root.addEventListener('pointermove', e => { const t = e.target.closest('[data-k]'); if (t) show(t, e.clientX, e.clientY); else tip.hidden = true; });
  root.addEventListener('pointerleave', () => { tip.hidden = true; });
  root.addEventListener('focusin', e => { const t = e.target.closest('[data-k]'); if (t) { const r = t.getBoundingClientRect(); show(t, r.right, r.top); } });
  root.addEventListener('focusout', () => { tip.hidden = true; });
}

function legend(series, redraw) {
  return h('div', { class: 'legend', role: 'group', 'aria-label': 'Légende : cliquer pour mettre en avant' },
    series.map(s => h('button', {
      type: 'button', class: 'legend-item', 'aria-pressed': String(chartState.focus === s.key),
      onClick: () => { chartState.focus = chartState.focus === s.key ? null : s.key; redraw(); },
    }, h('span', { class: 'swatch', style: { background: s.color } }), s.label, h('span', { class: 'muted' }, ` ${s.items.length}`))),
    chartState.focus && h('button', { type: 'button', class: 'legend-item ghost', onClick: () => { chartState.focus = null; redraw(); } }, 'Tout afficher'));
}

function evolutionSVG(series, lookup) {
  const pts = series.flatMap(s => s.items);
  const W = 760, H = 300, pl = 40, pr = 16, pt = 14, pb = 34;
  const t = d => parseDate(d).getTime();
  let t0 = Math.min(...pts.map(e => t(e.DateEval))), t1 = Math.max(...pts.map(e => t(e.DateEval)));
  if (t1 - t0 < 7 * 864e5) { t0 -= 3.5 * 864e5; t1 += 3.5 * 864e5; }
  const pad = (t1 - t0) * 0.04;
  const x = d => pl + (W - pl - pr) * ((t(d) - t0 + pad) / (t1 - t0 + 2 * pad));
  const y = n => pt + (H - pt - pb) * (1 - (n - 1) / 5);
  // Décalage horizontal par élève : les notes d'une même évaluation ne se superposent pas.
  const eleveIds = [...new Set(pts.map(e => e.EleveID))].sort((a, b) => a - b);
  const step = Math.min(7, 40 / Math.max(1, eleveIds.length));
  const dx = e => (eleveIds.indexOf(e.EleveID) - (eleveIds.length - 1) / 2) * step;
  const px = e => x(e.DateEval) + dx(e);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Notes dans le temps : un point par évaluation, ligne de suffisance à 4">`;
  for (let n = 1; n <= 6; n++) s += `<line x1="${pl}" x2="${W - pr}" y1="${y(n)}" y2="${y(n)}" stroke="var(--line)"/><text x="${pl - 10}" y="${y(n) + 4}" text-anchor="end" font-size="12" fill="var(--muted)">${n}</text>`;
  // graduations : premier jour de chaque mois couvert, ou chaque lundi si la période est courte
  const weekly = (t1 - t0) < 70 * 864e5;
  const d = new Date(t0); d.setUTCHours(0, 0, 0, 0);
  if (weekly) d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); else d.setUTCDate(1);
  for (; d.getTime() <= t1 + pad; weekly ? d.setUTCDate(d.getUTCDate() + 7) : d.setUTCMonth(d.getUTCMonth() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const xx = x(iso);
    if (xx < pl || xx > W - pr) continue;
    s += `<line x1="${xx}" x2="${xx}" y1="${H - pb}" y2="${H - pb + 5}" stroke="var(--line-strong)"/><text x="${xx}" y="${H - pb + 19}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(fmtDate(iso, { year: false }))}</text>`;
  }
  s += `<line x1="${pl}" x2="${W - pr}" y1="${y(4)}" y2="${y(4)}" stroke="var(--danger)" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  s += `<text x="${W - pr}" y="${y(4) - 6}" text-anchor="end" font-size="11" fill="var(--danger)">4</text>`;
  const order = [...series].sort((a, b) => (a.key === chartState.focus) - (b.key === chartState.focus)); // la série mise en avant passe devant
  for (const se of order) {
    const dim = chartState.focus && chartState.focus !== se.key;
    const op = dim ? 0.13 : 1;
    if (chartState.couleur === 'eleve' && chartState.lignes) {
      // une ligne par élève et par branche (relier des branches différentes n'aurait pas de sens)
      for (const [, l] of groupBy(se.items, e => e.CoursID)) {
        if (l.length < 2) continue;
        const sorted = [...l].sort((a, b) => a.DateEval.localeCompare(b.DateEval));
        s += `<polyline points="${sorted.map(e => `${px(e).toFixed(1)},${y(e.Note).toFixed(1)}`).join(' ')}" fill="none" stroke="${se.color}" stroke-width="2" stroke-opacity="${op * 0.55}"/>`;
      }
    }
    for (const e of se.items) {
      const k = `n${e.ID}`;
      lookup[k] = [`${nomEleve(eleve(e.EleveID))} · ${fmtNote(e.Note)}`, `${cours(e.CoursID)?.Title} · ${e.Sujet}`, `${fmtDate(e.DateEval)}${e.Coefficient && e.Coefficient !== 1 ? ` · coef. ${String(e.Coefficient).replace('.', ',')}` : ''}`];
      const low = e.Note < 4;
      s += `<circle data-k="${k}"${dim ? ' pointer-events="none"' : ' tabindex="0"'} cx="${px(e).toFixed(1)}" cy="${y(e.Note).toFixed(1)}" r="${low && !dim ? 6.5 : 5.5}" fill="${se.color}" fill-opacity="${op}" stroke="var(--card)" stroke-width="2"/>`;
      if (low && !dim && chartState.couleur !== 'resultat') s += `<circle cx="${px(e).toFixed(1)}" cy="${y(e.Note).toFixed(1)}" r="10" fill="none" stroke="var(--danger)" stroke-width="1.5" pointer-events="none"/>`;
    }
  }
  return s + '</svg>';
}

function moyennesSVG(ev, lookup) {
  const groups = chartState.groupe === 'eleve'
    ? [...groupBy(ev, e => e.EleveID)].map(([id, l]) => ({ key: `e${id}`, label: nomEleve(eleve(id)), color: eleveSlot(id), items: l }))
    : [...groupBy(ev, e => e.CoursID)].map(([id, l]) => ({ key: `c${id}`, label: cours(id)?.Title || '?', color: cours(id)?.Couleur || 'var(--muted)', items: l }));
  const rows = groups.map(g => ({ ...g, avg: weightedAvg(g.items) })).filter(g => g.avg != null).sort((a, b) => a.avg - b.avg);
  const rowH = 34, pl = 150, pr = 46, pt = 8, W = 760, H = pt + rows.length * rowH + 26;
  const x = n => pl + (W - pl - pr) * ((n - 1) / 5);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Moyennes pondérées, de la plus basse à la plus haute">`;
  for (let n = 1; n <= 6; n++) s += `<line x1="${x(n)}" x2="${x(n)}" y1="${pt}" y2="${H - 22}" stroke="var(--line)"/><text x="${x(n)}" y="${H - 6}" text-anchor="middle" font-size="12" fill="var(--muted)">${n}</text>`;
  rows.forEach((r, i) => {
    const yy = pt + i * rowH + 7, bh = rowH - 14;
    const dim = chartState.focus && chartState.focus !== r.key;
    const low = r.avg < 4;
    const k = `m${r.key}`;
    lookup[k] = [`${r.label} · ${fmtNote(Math.round(r.avg * 10) / 10)}`, `${r.items.length} note${r.items.length > 1 ? 's' : ''}, moyenne pondérée`];
    s += `<text x="${pl - 10}" y="${yy + bh / 2 + 4}" text-anchor="end" font-size="13" fill="var(--ink)">${esc(r.label.length > 20 ? r.label.slice(0, 19) + '…' : r.label)}</text>`;
    s += `<rect data-k="${k}" tabindex="0" x="${x(1)}" y="${yy}" width="${Math.max(2, x(r.avg) - x(1))}" height="${bh}" rx="4" fill="${r.color}" fill-opacity="${dim ? 0.15 : 1}"/>`;
    s += `<text x="${x(r.avg) + 6}" y="${yy + bh / 2 + 4}" font-size="12.5" font-weight="700" fill="${low ? 'var(--danger)' : 'var(--ink)'}" fill-opacity="${dim ? 0.4 : 1}">${low ? '▼ ' : ''}${fmtNote(Math.round(r.avg * 10) / 10)}</text>`;
  });
  s += `<line x1="${x(4)}" x2="${x(4)}" y1="${pt}" y2="${H - 22}" stroke="var(--danger)" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  return { svg: s + '</svg>', series: rows.map(r => ({ ...r })), minWidth: 520 };
}

/** Carte complète : réglages, légende cliquable, graphique. */
export function notesChartCard(evAll) {
  const ev = evAll.filter(e => typeof e.Note === 'number');
  const box = h('div');
  const redraw = () => {
    if (!ev.length) { box.replaceChildren(empty('Aucune note pour ces filtres (le formatif n\'apparaît pas dans le graphique).')); return; }
    const lookup = {};
    const controls = h('div', { class: 'btn-row', style: { marginBottom: '10px' } },
      seg([{ value: 'evolution', label: 'Évolution' }, { value: 'moyennes', label: 'Moyennes' }], chartState.vue, v => { chartState.vue = v; chartState.focus = null; redraw(); }, 'Vue'),
      chartState.vue === 'evolution'
        ? [h('span', { class: 'small muted' }, 'Couleur :'),
          seg([{ value: 'eleve', label: 'Élève' }, { value: 'branche', label: 'Branche' }, { value: 'resultat', label: 'Résultat' }], chartState.couleur, v => { chartState.couleur = v; chartState.focus = null; redraw(); }, 'Couleur')]
        : [h('span', { class: 'small muted' }, 'Par :'),
          seg([{ value: 'eleve', label: 'Élève' }, { value: 'branche', label: 'Branche' }], chartState.groupe, v => { chartState.groupe = v; chartState.focus = null; redraw(); }, 'Grouper par')]);
    let svg, series, minWidth = 560, extra = null;
    if (chartState.vue === 'evolution') {
      series = seriesOf(ev, chartState.couleur);
      svg = evolutionSVG(series, lookup);
      extra = h('p', { class: 'hint' },
        chartState.couleur === 'resultat' ? 'Rouge : note sous 4. Survoler un point pour le détail.' : 'Cercle rouge : note sous 4. Cliquer un nom dans la légende pour le mettre en avant. Survoler un point pour le détail.',
        chartState.couleur === 'eleve' ? [' ', h('label', { class: 'check', style: { minHeight: 0 } }, h('input', { type: 'checkbox', checked: chartState.lignes, onChange: e => { chartState.lignes = e.target.checked; redraw(); } }), 'relier les notes d\'un élève dans une même branche')] : null);
    } else {
      const m = moyennesSVG(ev, lookup);
      svg = m.svg; series = m.series; minWidth = m.minWidth;
      extra = h('p', { class: 'hint' }, 'Moyennes pondérées des notes filtrées, de la plus basse à la plus haute. ▼ : sous 4.');
    }
    const plot = h('div', { class: 'chart scroll-x' }, h('div', { style: { minWidth: `${minWidth}px` }, svg }));
    wireTooltips(plot, lookup);
    box.replaceChildren(controls, legend(series, redraw), plot, extra);
  };
  redraw();
  return box;
}
