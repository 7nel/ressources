import { S, nav, back, eleve, insc, volee, nomEleve, inscriptionCourante, refresh } from '../state.js';
import { h, card, btn, badge, empty, notice, esc, checkbox } from '../ui.js';
import { enteteEleve } from '../voisins.js';
import { DOMAINES, DOMAINES_COURTS, REGARDS, cpsKey, scaleBoussole, SEUIL_ECART, fmtDate, sortBy } from '../domain.js';

const state = { moyenne: false };
const fmt2 = v => v == null ? '—' : Number(v).toFixed(2).replace('.', ',');

export function radarSVG(p, { moyenne = false } = {}) {
  const W = 560, H = 390, cx = W / 2, cy = 200, R = 155;
  const ang = k => (-90 + k * 72) * Math.PI / 180;
  const pt = (k, v) => [cx + R * (v / 5) * Math.cos(ang(k)), cy + R * (v / 5) * Math.sin(ang(k))];
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Radar des compétences psychosociales : 5 domaines, 4 regards">`;
  for (let n = 1; n <= 5; n++) {
    const poly = [0, 1, 2, 3, 4].map(k => pt(k, n).map(x => x.toFixed(1)).join(',')).join(' ');
    s += `<polygon points="${poly}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
  }
  for (let k = 0; k < 5; k++) {
    const [x, y] = pt(k, 5);
    s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/>`;
    const [lx, ly] = pt(k, 6.1);
    const anchor = Math.abs(lx - cx) < 10 ? 'middle' : lx > cx ? 'start' : 'end';
    s += `<text x="${lx}" y="${ly + 4}" text-anchor="${anchor}" font-size="13" fill="var(--ink)">${esc(DOMAINES_COURTS[k])}</text>`;
  }
  const series = REGARDS.map(r => {
    const vals = [1, 2, 3, 4, 5].map(d => p[cpsKey(d, r.key)]);
    if (vals.some(v => v == null || v === '')) return null; // regard incomplet : non tracé
    return { r, vals: r.key === 'Boussole' ? vals.map(scaleBoussole) : vals };
  }).filter(Boolean);
  for (const { r, vals } of series) {
    const poly = vals.map((v, k) => pt(k, v).map(x => x.toFixed(1)).join(',')).join(' ');
    s += `<polygon points="${poly}" fill="${r.color}" fill-opacity="0.08" stroke="${r.color}" stroke-width="2.2"/>`;
    vals.forEach((v, k) => { const [x, y] = pt(k, v); s += `<circle cx="${x}" cy="${y}" r="3.5" fill="${r.color}"/>`; });
  }
  if (moyenne) {
    const q = REGARDS.filter(r => r.key !== 'Boussole');
    const vals = [1, 2, 3, 4, 5].map(d => {
      const xs = q.map(r => p[cpsKey(d, r.key)]).filter(v => v != null && v !== '');
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    });
    if (vals.every(v => v != null)) {
      const poly = vals.map((v, k) => pt(k, v).map(x => x.toFixed(1)).join(',')).join(' ');
      s += `<polygon points="${poly}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="6 4"/>`;
    }
  }
  s += '</svg>';
  return { svg: s, drawn: series.map(x => x.r.key) };
}

export function render(params) {
  const e = eleve(params.eleve);
  if (!e) return h('div', { class: 'page' }, notice('Élève introuvable.', 'danger'));
  const passations = sortBy(S.store.where('RS_CPS', c => c.EleveID === e.ID), 'DatePassation');
  const cur = (params.id && passations.find(p => p.ID === Number(params.id))) || passations.at(-1);
  const i = params.insc ? insc(params.insc) : inscriptionCourante(e.ID);

  const head = [
    enteteEleve({ route: 'cps', eleveId: e.ID, inscId: i?.ID, params: (x, xi) => ({ eleve: x.ID, insc: xi.ID }), retour: { label: '‹ Retour au dossier', onClick: () => back('dossier', { eleve: e.ID }) } }),
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, `CPS · ${nomEleve(e)}`), h('div', { class: 'sub' }, 'Compétences psychosociales : 5 domaines, 4 regards côte à côte, sans moyenne globale.')),
      h('div', { class: 'btn-row' },
        i && btn('QR codes Forms', () => nav('cpsqr', { insc: i.ID }), 'secondary'),
        btn('Réponses Forms', () => nav('cpsforms'), 'secondary'),
        i && btn('+ Saisie à la main', () => nav('cpssaisie', { eleve: e.ID, insc: i.ID }))))];
  if (!cur) return h('div', { class: 'page' }, head, card(null, {}, empty('Aucune passation enregistrée. Imprimez les QR codes Forms, puis intégrez les réponses depuis « Réponses Forms ».')));

  const idx = passations.indexOf(cur);
  const prev = idx > 0 ? passations[idx - 1] : null;

  const chips = h('div', { class: 'chips' }, passations.map(p => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(p.ID === cur.ID), onClick: () => nav('cps', { eleve: e.ID, id: p.ID }),
  }, `${p.Moment} · ${fmtDate(p.DatePassation)}`, h('span', { class: 'meta' }, volee(insc(p.InscriptionID)?.VoleeID)?.Title || ''))));

  const rows = DOMAINES.map((dm, k) => {
    const d = k + 1;
    const q = ['Eleve', 'Titulaire', 'Parents'].map(r => cur[cpsKey(d, r)]).filter(v => v != null && v !== '');
    const ecart = q.length >= 2 ? Math.max(...q) - Math.min(...q) : null;
    return h('tr', null,
      h('th', { scope: 'row' }, dm),
      REGARDS.map(r => {
        const v = cur[cpsKey(d, r.key)];
        const pv = prev?.[cpsKey(d, r.key)];
        const delta = v != null && pv != null ? v - pv : null;
        return h('td', { class: 'num' },
          r.key === 'Boussole' ? (v ?? '—') : fmt2(v),
          delta != null && Math.abs(delta) >= 0.01 && h('span', { class: 'delta' }, `${delta > 0 ? '▲ +' : '▼ '}${r.key === 'Boussole' ? delta : fmt2(delta)}`));
      }),
      h('td', { class: 'num' }, ecart == null ? '—' : ecart >= SEUIL_ECART ? h('span', { class: 'ecart', title: `Écart ≥ ${String(SEUIL_ECART).replace('.', ',')} point entre questionnaires` }, `⚠ ${fmt2(ecart)}`) : fmt2(ecart)));
  });

  const table = h('div', { class: 'scroll-x' }, h('table', { class: 'tbl cps-tbl' },
    h('thead', null, h('tr', null, h('th', null, 'Domaine'), REGARDS.map(r => h('th', { class: 'num' }, r.label, h('br'), h('span', { style: { fontWeight: 400 } }, `1–${r.max}`))), h('th', { class: 'num' }, 'Écart entre', h('br'), 'questionnaires'))),
    h('tbody', null, rows)));

  // Un radar par passation, côte à côte (dans l'ordre chronologique) ; celle du tableau est encadrée.
  const radars = passations.map(p => {
    const { svg, drawn } = radarSVG(p, { moyenne: state.moyenne });
    const missing = REGARDS.filter(r => !drawn.includes(r.key)).map(r => r.label);
    return h('figure', { class: `radar-item ${p.ID === cur.ID ? 'current' : ''}` },
      h('figcaption', null,
        h('button', { type: 'button', class: 'back', style: { fontWeight: 700, color: 'var(--ink)' }, onClick: () => nav('cps', { eleve: e.ID, id: p.ID }) }, `${p.Moment} · ${fmtDate(p.DatePassation)}`),
        h('span', { class: 'small muted' }, ` ${volee(insc(p.InscriptionID)?.VoleeID)?.Title || ''}`)),
      h('div', { class: 'radar-wrap', svg }),
      missing.length ? h('p', { class: 'hint' }, `Non tracé : ${missing.join(', ')}.`) : null);
  });

  return h('div', { class: 'page' },
    head,
    chips,
    card(`${cur.Moment} · ${fmtDate(cur.DatePassation)}`, {
      hint: prev ? `Flèches : évolution depuis la passation précédente (${prev.Moment}, ${fmtDate(prev.DatePassation)}).` : 'Première passation : pas de comparaison.',
      actions: [badge(`seuil d'écart ${String(SEUIL_ECART).replace('.', ',')} (arbitraire)`, 'warn')],
    }, table),
    card('Les regards en un coup d\'œil', { hint: 'La boussole du coach (1–4) est ramenée sur 1–5 pour le tracé.' },
      h('div', { style: { marginBottom: '8px' } }, REGARDS.map(r => h('span', { class: 'regard-key' }, h('span', { class: 'dot', style: { background: r.color, width: '14px', height: '4px', borderRadius: '2px' } }), r.label))),
      h('div', { class: `radar-grid n${Math.min(radars.length, 3)}` }, radars),
      checkbox('Afficher la moyenne des 3 questionnaires (pointillés) — à lire avec prudence', state.moyenne, on => { state.moyenne = on; refresh(); })));
}
