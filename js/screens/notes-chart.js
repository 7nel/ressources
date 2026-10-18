// Graphique de la page Notes. Il suit les filtres cumulables (élèves × branches) de la page.
//  - Évolution : une courbe par élève (moyenne de la semaine sur les branches choisies) ;
//    si un seul élève est choisi, une courbe par branche. Les notes une à une sont en option.
//  - Moyennes : une barre par élève ; si un seul élève est choisi, une barre par branche.
// Couleurs d'élève : palette catégorielle validée (8 teintes), attribuée par élève et non par rang,
// pour qu'un filtre ne repeigne jamais les élèves restants. Couleurs de branche : celles des cours.
import { S, eleve, cours, nomEleve } from '../state.js';
import { h, esc, seg, empty } from '../ui.js';
import { fmtDate, fmtNote, weightedAvg, groupBy, parseDate, mondayOf, addDays } from '../domain.js';

const CAT = 8;
export const chartState = { vue: 'evolution', focus: null, points: false };

/** Couleur stable d'un élève : rang de son ID parmi tous les élèves du dossier. */
export function eleveSlot(id) {
  const ids = S.store.all('RS_Eleves').map(e => e.ID).sort((a, b) => a - b);
  const k = ids.indexOf(id);
  return k >= 0 && k < CAT ? `var(--cat${k + 1})` : 'var(--muted)';
}

/** Séries : par élève, ou par branche quand un seul élève est affiché. */
function seriesOf(ev) {
  const unSeul = new Set(ev.map(e => e.EleveID)).size === 1;
  const list = unSeul
    ? [...groupBy(ev, e => e.CoursID)].map(([id, l]) => ({ key: `c${id}`, label: cours(id)?.Title || '?', color: cours(id)?.Couleur || 'var(--muted)', items: l }))
    : [...groupBy(ev, e => e.EleveID)].map(([id, l]) => ({ key: `e${id}`, label: nomEleve(eleve(id)), color: eleveSlot(id), items: l }));
  return { par: unSeul ? 'branche' : 'eleve', series: list.sort((a, b) => a.label.localeCompare(b.label, 'fr')) };
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
  if (series.length < 2) return null;
  return h('div', { class: 'legend', role: 'group', 'aria-label': 'Légende : cliquer pour mettre en avant' },
    series.map(s => h('button', {
      type: 'button', class: 'legend-item', 'aria-pressed': String(chartState.focus === s.key),
      onClick: () => { chartState.focus = chartState.focus === s.key ? null : s.key; redraw(); },
    }, h('span', { class: 'swatch', style: { background: s.color } }), s.label, h('span', { class: 'muted' }, ` ${s.items.length}`))),
    chartState.focus && h('button', { type: 'button', class: 'legend-item ghost', onClick: () => { chartState.focus = null; redraw(); } }, 'Tout afficher'));
}

const moyenne = l => l.reduce((m, e) => m + e.Note, 0) / l.length;
const arrondi = v => fmtNote(Math.round(v * 10) / 10);

function evolutionSVG(series, lookup) {
  const pts = series.flatMap(s => s.items);
  const W = 760, H = 320, pl = 40, pr = 16, pt = 14, pb = 34;
  const t = d => parseDate(d).getTime();
  let t0 = Math.min(...pts.map(e => t(e.DateEval))), t1 = Math.max(...pts.map(e => t(e.DateEval)));
  if (t1 - t0 < 7 * 864e5) { t0 -= 3.5 * 864e5; t1 += 3.5 * 864e5; }
  const pad = (t1 - t0) * 0.04;
  const x = d => pl + (W - pl - pr) * ((t(d) - t0 + pad) / (t1 - t0 + 2 * pad));
  // Axe des notes : jusqu'à 6, à partir d'un demi-point sous la plus basse (courbes : pas besoin de partir de 1).
  const nMin = Math.max(1, Math.min(3, Math.floor(Math.min(...pts.map(e => e.Note)) - 0.5)));
  const y = n => pt + (H - pt - pb) * (1 - (n - nMin) / (6 - nMin));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution des notes, moyenne de la semaine, ligne de suffisance à 4">`;
  for (let n = nMin; n <= 6; n += 0.5) {
    const entier = Number.isInteger(n);
    s += `<line x1="${pl}" x2="${W - pr}" y1="${y(n)}" y2="${y(n)}" stroke="var(--line)" stroke-opacity="${entier ? 1 : 0.5}"/>`;
    if (entier) s += `<text x="${pl - 10}" y="${y(n) + 4}" text-anchor="end" font-size="12" fill="var(--muted)">${n}</text>`;
  }
  const weekly = (t1 - t0) < 70 * 864e5;
  const d = new Date(t0); d.setUTCHours(0, 0, 0, 0);
  if (weekly) d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); else d.setUTCDate(1);
  for (; d.getTime() <= t1 + pad; weekly ? d.setUTCDate(d.getUTCDate() + 7) : d.setUTCMonth(d.getUTCMonth() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const xx = x(weekly ? addDays(iso, 2) : iso); // semaine : graduation au milieu, là où est posée la moyenne
    if (xx < pl || xx > W - pr) continue;
    s += `<line x1="${xx}" x2="${xx}" y1="${H - pb}" y2="${H - pb + 5}" stroke="var(--line-strong)"/><text x="${xx}" y="${H - pb + 19}" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(weekly ? `sem. ${fmtDate(iso, { year: false })}` : fmtDate(iso, { year: false }))}</text>`;
  }
  s += `<line x1="${pl}" x2="${W - pr}" y1="${y(4)}" y2="${y(4)}" stroke="var(--danger)" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  s += `<text x="${W - pr}" y="${y(4) - 6}" text-anchor="end" font-size="11" fill="var(--danger)">4</text>`;

  const order = [...series].sort((a, b) => (a.key === chartState.focus) - (b.key === chartState.focus)); // la série mise en avant passe devant
  for (const se of order) {
    const dim = chartState.focus && chartState.focus !== se.key;
    const weeks = [...groupBy(se.items, e => mondayOf(e.DateEval))].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mon, l]) => ({ mon, x: x(addDays(mon, 2)), v: moyenne(l), n: l.length }));
    if (chartState.points) {
      for (const e of se.items) {
        const k = `n${e.ID}`;
        lookup[k] = [`${nomEleve(eleve(e.EleveID))} · ${fmtNote(e.Note)}`, `${cours(e.CoursID)?.Title} · ${e.Sujet}`, `${fmtDate(e.DateEval)}${e.Coefficient && e.Coefficient !== 1 ? ` · coef. ${String(e.Coefficient).replace('.', ',')}` : ''}`];
        s += `<circle data-k="${k}"${dim ? ' pointer-events="none"' : ' tabindex="0"'} cx="${x(e.DateEval).toFixed(1)}" cy="${y(e.Note).toFixed(1)}" r="4" fill="${se.color}" fill-opacity="${dim ? 0.08 : 0.45}" stroke="var(--card)" stroke-width="1"/>`;
      }
    }
    if (weeks.length > 1) s += `<polyline points="${weeks.map(w => `${w.x.toFixed(1)},${y(w.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${se.color}" stroke-width="${dim ? 2 : 3}" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="${dim ? 0.15 : 1}"/>`;
    for (const w of weeks) {
      const k = `w${se.key}${w.mon}`;
      lookup[k] = [`${se.label} · ${arrondi(w.v)}`, `semaine du ${fmtDate(w.mon)}`, `moyenne de ${w.n} note${w.n > 1 ? 's' : ''}`];
      const low = w.v < 4;
      s += `<circle data-k="${k}"${dim ? ' pointer-events="none"' : ' tabindex="0"'} cx="${w.x.toFixed(1)}" cy="${y(w.v).toFixed(1)}" r="${low && !dim ? 6 : 5}" fill="${se.color}" fill-opacity="${dim ? 0.15 : 1}" stroke="${low && !dim ? 'var(--danger)' : 'var(--card)'}" stroke-width="${low && !dim ? 2.5 : 2}"/>`;
    }
  }
  return s + '</svg>';
}

function moyennesSVG(series, lookup) {
  const rows = series.map(g => ({ ...g, avg: weightedAvg(g.items) })).filter(g => g.avg != null).sort((a, b) => a.avg - b.avg);
  const rowH = 34, pl = 160, pr = 46, pt = 8, W = 760, H = pt + rows.length * rowH + 26;
  const x = n => pl + (W - pl - pr) * ((n - 1) / 5);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Moyennes pondérées, de la plus basse à la plus haute">`;
  for (let n = 1; n <= 6; n++) s += `<line x1="${x(n)}" x2="${x(n)}" y1="${pt}" y2="${H - 22}" stroke="var(--line)"/><text x="${x(n)}" y="${H - 6}" text-anchor="middle" font-size="12" fill="var(--muted)">${n}</text>`;
  rows.forEach((r, i) => {
    const yy = pt + i * rowH + 7, bh = rowH - 14;
    const dim = chartState.focus && chartState.focus !== r.key;
    const low = r.avg < 4;
    const k = `m${r.key}`;
    lookup[k] = [`${r.label} · ${arrondi(r.avg)}`, `${r.items.length} note${r.items.length > 1 ? 's' : ''}, moyenne pondérée`];
    s += `<text x="${pl - 10}" y="${yy + bh / 2 + 4}" text-anchor="end" font-size="13" fill="var(--ink)">${esc(r.label.length > 22 ? r.label.slice(0, 21) + '…' : r.label)}</text>`;
    s += `<rect data-k="${k}" tabindex="0" x="${x(1)}" y="${yy}" width="${Math.max(2, x(r.avg) - x(1))}" height="${bh}" rx="4" fill="${r.color}" fill-opacity="${dim ? 0.15 : 1}"/>`;
    s += `<text x="${x(r.avg) + 6}" y="${yy + bh / 2 + 4}" font-size="12.5" font-weight="700" fill="${low ? 'var(--danger)' : 'var(--ink)'}" fill-opacity="${dim ? 0.4 : 1}">${low ? '▼ ' : ''}${arrondi(r.avg)}</text>`;
  });
  s += `<line x1="${x(4)}" x2="${x(4)}" y1="${pt}" y2="${H - 22}" stroke="var(--danger)" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  return { svg: s + '</svg>', rows };
}

/** Carte complète : vue, légende cliquable, graphique. Les filtres sont ceux de la page. */
export function notesChartCard(evAll) {
  const ev = evAll.filter(e => typeof e.Note === 'number');
  const box = h('div');
  const redraw = () => {
    if (!ev.length) { box.replaceChildren(empty('Aucune note pour ces filtres (le formatif n\'apparaît pas dans le graphique).')); return; }
    const lookup = {};
    const { par, series } = seriesOf(ev);
    if (chartState.focus && !series.some(s => s.key === chartState.focus)) chartState.focus = null;
    const controls = h('div', { class: 'btn-row', style: { marginBottom: '10px', alignItems: 'center' } },
      seg([{ value: 'evolution', label: 'Évolution' }, { value: 'moyennes', label: 'Moyennes' }], chartState.vue, v => { chartState.vue = v; redraw(); }, 'Vue'),
      h('span', { class: 'small muted' }, par === 'branche' ? `${nomEleve(eleve(ev[0].EleveID))} : une ${chartState.vue === 'evolution' ? 'courbe' : 'barre'} par branche` : `une ${chartState.vue === 'evolution' ? 'courbe' : 'barre'} par élève`));
    let svg, extra;
    if (chartState.vue === 'evolution') {
      svg = evolutionSVG(series, lookup);
      extra = h('div', { class: 'hint' },
        h('p', { style: { margin: 0 } }, `Chaque point de courbe = moyenne de la semaine${par === 'eleve' ? ' sur les branches choisies' : ''}, cerclé de rouge sous 4. Cliquer un nom pour le mettre en avant.`),
        par === 'branche' && series.length > CAT ? h('p', { style: { margin: '4px 0 0' } }, `${series.length} branches : choisissez-en quelques-unes dans les filtres pour mieux distinguer les courbes.`) : null,
        h('label', { class: 'check', style: { minHeight: 0 } }, h('input', { type: 'checkbox', checked: chartState.points, onChange: e => { chartState.points = e.target.checked; redraw(); } }), 'afficher aussi chaque note'));
    } else {
      const m = moyennesSVG(series, lookup);
      svg = m.svg;
      extra = h('p', { class: 'hint' }, `Moyennes pondérées des notes filtrées${par === 'eleve' ? ', toutes branches choisies confondues' : ''}, de la plus basse à la plus haute. ▼ : sous 4.`);
    }
    const plot = h('div', { class: 'chart scroll-x' }, h('div', { style: { minWidth: '560px' }, svg }));
    wireTooltips(plot, lookup);
    box.replaceChildren(controls, legend(series, redraw), plot, extra);
  };
  redraw();
  return box;
}
