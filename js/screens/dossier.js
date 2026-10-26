import { S, nav, back, eleve, cours, volee, ens, inscriptionsEleve, inscriptionCourante, phaseInscription, etatVolee, nomEleve, refDate, isCoord, moi, labels, refresh } from '../state.js';
import { h, card, btn, pastille, ctPair, phaseBadge, badge, empty, notice, toast, modal, field, select, input, seg, menu, levelLegend, propres } from '../ui.js';
import { DEF_C, DEF_T, addDays, phaseOf, fmtDate, fmtNote, semaineCle, sortBy, daysBetween, STATUTS_ELEVE, STATUTS_INSCRIPTION, cleDoublon, PHASE_CLASS, retenueMinutes } from '../domain.js';
import { synthese, bilanDe, cpsDe } from '../queries.js';
import { enteteEleve } from '../voisins.js';

// Affichage du dossier : revient au défaut à chaque ouverture (changement d'adresse), pas lors d'un simple rafraîchissement.
const DEFAUT = () => ({ showAll: false, chrono: false, graph: true, table: true, groupes: [], aide: false, cours: [], menuCours: false });
const state = DEFAUT();
window.addEventListener('hashchange', () => Object.assign(state, DEFAUT()));
const basculer = (arr, id) => (arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

export function canEditSuivi(s) {
  if (isCoord()) return true;
  const m = moi();
  if (!m || m.ID !== s.EnseignantID) return false;
  return daysBetween(String(s.Created).slice(0, 10), refDate()) <= 7; // R7
}

const GROUPE_COULEUR = { 'Branches': 'var(--cat1)', 'Projet': 'var(--cat2)', 'Méthodo / Orientation': 'var(--cat3)' };
const fmt1 = v => v == null ? '' : v.toFixed(1).replace('.', ',');
function moyChip(lettre, v) {
  if (v == null) return null;
  return h('span', { class: 'ct' }, h('span', { class: 'k' }, lettre), h('span', { class: 'moy' }, fmt1(v)));
}

/** Tendance : moyenne hebdomadaire par famille de cours, C, T ou les deux. */
const tendState = { vue: 'CT' };
function tendanceSVG(weeks, moyennes, nowSk) {
  const W = 760, H = 250, pl = 40, pr = 170, pt = 16, pb = 40;
  const n = weeks.length;
  const x = k => pl + (n === 1 ? (W - pl - pr) / 2 : (W - pl - pr) * k / (n - 1));
  const y = v => pt + (H - pt - pb) * (1 - (v - 1) / 3);
  const val = m => tendState.vue === 'C' ? m.c : tendState.vue === 'T' ? m.t : (m.c == null ? null : (m.c + m.t) / 2);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tendance hebdomadaire des cotations par famille de cours, de 1 à 4. Les valeurs sont dans le tableau ci-dessous.">`;
  for (let v = 1; v <= 4; v++) s += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pl - 10}" y="${y(v) + 4}" text-anchor="end" font-size="14" fill="var(--muted)">${v}</text>`;
  weeks.forEach((w, k) => {
    if (w.sk === nowSk) s += `<rect x="${x(k) - 14}" y="${pt}" width="28" height="${H - pt - pb}" fill="var(--accent-soft)"/>`;
    s += `<text x="${x(k)}" y="${H - pb + 18}" text-anchor="middle" font-size="14" fill="var(--muted)">S${w.n}</text>`;
    s += `<rect x="${x(k) - 14}" y="${H - pb + 26}" width="28" height="4" rx="2" fill="var(--${({ 'Décompression': 'ph1', 'Remobilisation': 'ph2', 'Ré-exposition': 'ph3' })[w.phase]}-strong)"/>`;
  });
  const labels = [];
  for (const m of moyennes) {
    const col = GROUPE_COULEUR[m.groupe];
    const pts = m.semaines.map((w, k) => ({ k, v: val(w) })).filter(p => p.v != null);
    // segments seulement entre semaines consécutives renseignées
    let run = [];
    const flush = () => { if (run.length > 1) s += `<polyline points="${run.map(p => `${x(p.k).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>`; run = []; };
    pts.forEach((p, j) => { if (j && p.k !== pts[j - 1].k + 1) flush(); run.push(p); });
    flush();
    for (const p of pts) s += `<circle cx="${x(p.k).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="5" fill="${col}" stroke="var(--card)" stroke-width="2"><title>${m.groupe} · S${weeks[p.k].n} : ${fmt1(p.v)}</title></circle>`;
    const last = pts.at(-1);
    if (last) labels.push({ y: y(last.v), text: `${m.groupe === 'Méthodo / Orientation' ? 'Méthodo' : m.groupe} ${fmt1(last.v)}`, col });
  }
  // étiquettes directes à droite, écartées pour ne pas se chevaucher
  labels.sort((a, b) => a.y - b.y);
  for (let k = 1; k < labels.length; k++) if (labels[k].y - labels[k - 1].y < 18) labels[k].y = labels[k - 1].y + 18;
  for (const l of labels) s += `<circle cx="${W - pr + 14}" cy="${l.y}" r="5" fill="${l.col}"/><text x="${W - pr + 24}" y="${l.y + 4}" font-size="14" fill="var(--ink)">${l.text}</text>`;
  return s + '</svg>';
}

function syntheseCard(i) {
  const { weeks, rows, moyennes } = synthese(i);
  const L = labels();
  const nowSk = semaineCle(refDate());
  if (!rows.length) return card('Synthèse hebdomadaire', {}, empty('Aucune cotation pour cette inscription.'));
  const nowCls = k => weeks[k].sk === nowSk ? 'now' : null;
  const body = [];
  for (const m of moyennes) {
    const ouvert = state.groupes.includes(m.groupe);
    const nCours = rows.filter(r => r.groupe === m.groupe).length;
    body.push(h('tr', { class: 'grp-head' },
      h('th', { scope: 'row' }, h('button', {
        type: 'button', class: 'grp-toggle', 'aria-expanded': String(ouvert), 'data-cle-focus': `groupe-${m.groupe}`,
        title: ouvert ? 'Replier les cours' : `Afficher les ${nCours} cours`,
        onClick: () => { state.groupes = basculer(state.groupes, m.groupe); refresh(); },
      }, h('span', { class: 'chevron', 'aria-hidden': 'true' }, ouvert ? '▾' : '▸'),
        h('span', { class: 'dot', style: { background: GROUPE_COULEUR[m.groupe], marginRight: '6px' } }), `${m.groupe} · moyenne`,
        h('span', { class: 'muted', style: { fontWeight: 400 } }, ` (${nCours})`))),
      m.semaines.map((w, k) => h('td', { class: nowCls(k) }, w.n ? h('span', { class: 'cell row' }, moyChip('C', w.c), moyChip('T', w.t)) : h('span', { class: 'none', 'aria-label': 'aucun suivi' }, '·')))));
    if (ouvert) for (const r of rows.filter(r => r.groupe === m.groupe)) {
      body.push(h('tr', null,
        h('th', { scope: 'row', class: 'sub' }, h('span', { class: 'dot', style: { background: r.cours.Couleur || 'var(--muted)', marginRight: '6px' } }), r.cours.Title),
        r.cells.map((list, k) => h('td', { class: nowCls(k) },
          list.length
            ? h('span', { class: 'cell' }, list.slice(0, 2).map(s => ctPair(s.Comportement, s.Travail, L)), list.length > 2 && h('span', { class: 'more' }, `+${list.length - 2}`))
            : h('span', { class: 'none', 'aria-label': 'aucun suivi' }, '·')))));
    }
  }
  const table = h('table', { class: 'syn' },
    h('thead', null, h('tr', null,
      h('th', { scope: 'col' }, 'Cours'),
      weeks.map(w => h('th', { scope: 'col', class: w.sk === nowSk ? 'now' : null, title: w.phase },
        `S${w.n}`, h('br'), h('span', { style: { fontWeight: 400 } }, fmtDate(w.monday, { year: false })),
        h('span', { class: `band ${PHASE_CLASS[w.phase]}` }))))),
    h('tbody', null, body));

  // Aide « ? » et légende C / T, à côté des boutons du graphique (seules si le graphique est masqué).
  const aide = h('button', {
    type: 'button', class: 'aide-rond', 'aria-expanded': String(state.aide), 'aria-label': 'Comment lire cette synthèse',
    title: 'Comment lire cette synthèse', onClick: () => { state.aide = !state.aide; refresh(); },
  }, '?');
  const legende = h('div', { class: 'syn-legende' }, aide, levelLegend(L, { compact: true }));
  const aideTexte = state.aide ? h('p', { class: 'hint aide-texte' }, `C = comportement : ${DEF_C}. T = travail : ${DEF_T}. Les lignes « moyenne » donnent la tendance de la semaine par famille de cours ; cliquez sur une moyenne pour voir les pastilles de chaque cours. Le coaching n'est pas coté.`) : null;
  const chartBox = h('div');
  const drawChart = () => chartBox.replaceChildren(...propres([
    h('div', { class: 'syn-barre' },
      seg([{ value: 'CT', label: 'C et T' }, { value: 'C', label: 'Comportement' }, { value: 'T', label: 'Travail' }], tendState.vue, v => { tendState.vue = v; drawChart(); }, 'Courbes du graphique'), legende),
    aideTexte,
    h('div', { class: 'chart scroll-x' }, h('div', { style: { minWidth: '760px' }, svg: tendanceSVG(weeks, moyennes, nowSk) })),
  ]));
  drawChart();

  // Par défaut : graphique + tableau des seules moyennes ; un clic sur une moyenne déplie ses cours.
  return card('Synthèse hebdomadaire', {
    actions: [
      btn(state.graph ? 'Masquer le graphique' : 'Afficher le graphique', () => { state.graph = !state.graph; refresh(); }, 'ghost small', { 'aria-pressed': String(!state.graph), 'data-cle-focus': 'graphique' }),
      btn(state.table ? 'Masquer le tableau' : 'Afficher le tableau', () => { state.table = !state.table; refresh(); }, 'ghost small', { 'aria-pressed': String(!state.table), 'data-cle-focus': 'tableau' }),
    ],
  },
    !state.graph ? legende : null,
    !state.graph ? aideTexte : null,
    state.graph ? chartBox : null,
    state.table ? [h('div', { class: 'scroll-x' }, table),
      h('p', { class: 'hint scroll-note' }, 'Faites défiler le tableau vers la droite pour voir les autres semaines.')] : null,
    !state.graph && !state.table ? h('p', { class: 'hint' }, 'Graphique et tableau masqués.') : null);
}

/** Fil des 14 derniers jours : suivis, devoirs, évaluations et actions, jour par jour, du plus récent au plus ancien. */
function chronologieCard(i) {
  const fin = refDate(), debut = addDays(fin, -13);
  const dans = d => d && d >= debut && d <= fin;
  const L = labels();
  const v = volee(i.VoleeID);
  const ev = []; // { date, ordre, node }

  for (const s of S.store.where('RS_Suivis', x => x.InscriptionID === i.ID && dans(x.DateSuivi))) {
    const texte = s.Observation || s.CoachTravaille || '';
    const editable = canEditSuivi(s);
    ev.push({ date: s.DateSuivi, ordre: 0, signal: s.Comportement === 1 || s.Travail === 1, node: (h(editable ? 'button' : 'div', {
      type: editable ? 'button' : null, class: 'item', onClick: editable ? () => nav('saisie', { id: s.ID }) : null,
    },
    typeof s.Comportement === 'number' ? ctPair(s.Comportement, s.Travail, L, false) : badge('Coaching'),
    h('div', { class: 'main' }, h('div', { class: 'title' }, cours(s.CoursID)?.Title || ''), texte && h('div', { class: 'meta clip' }, texte)))) });
  }
  for (const d of S.store.where('RS_Devoirs', x => x.InscriptionID === i.ID && dans(x.DateConstat))) {
    ev.push({ date: d.DateConstat, ordre: 1, signal: d.Statut === 'Ouvert', node: (h('div', { class: 'item' },
      badge('Devoir non fait', d.SansConsequence ? 'neutral' : 'warn'),
      h('div', { class: 'main' }, h('div', { class: 'title' }, `${cours(d.CoursID)?.Title} · ${d.Description}`), d.SansConsequence && h('div', { class: 'meta' }, 'sans conséquence')),
      h('div', { class: 'end' }, badge(d.Statut, d.Statut === 'Rattrapé' ? 'ok' : d.Statut === 'Ouvert' ? 'warn' : 'danger')))) });
  }
  for (const x of S.store.where('RS_Evaluations', e => e.InscriptionID === i.ID && dans(e.DateEval))) {
    ev.push({ date: x.DateEval, ordre: 2, signal: (typeof x.Note === 'number' && x.Note < 4) || x.ResultatFormatif === 'Pas encore', node: (h('button', { type: 'button', class: 'item', onClick: () => nav('evaluation', { id: x.ID }) },
      badge('Évaluation'),
      h('div', { class: 'main' }, h('div', { class: 'title' }, `${cours(x.CoursID)?.Title} · ${x.Sujet}`)),
      h('div', { class: 'end' }, typeof x.Note === 'number'
        ? h('strong', { class: x.Note < 4 ? 'danger-text' : null }, fmtNote(x.Note))
        : badge(x.ResultatFormatif || '—', x.ResultatFormatif === 'Pas encore' ? 'warn' : 'ok')))) });
  }
  for (const a of S.store.where('RS_Actions', x => x.InscriptionID === i.ID && dans(x.Echeance))) {
    ev.push({ date: a.Echeance, ordre: 3, signal: !['Fait', 'Abandonnée'].includes(a.Statut), node: (h('button', { type: 'button', class: 'item', onClick: () => nav('action', { id: a.ID }) },
      badge('Action échue'),
      h('div', { class: 'main' }, h('div', { class: 'title' }, a.Description), h('div', { class: 'meta' }, a.Responsable)),
      h('div', { class: 'end' }, badge(a.Statut, a.Statut === 'Fait' ? 'ok' : a.Statut === 'Abandonnée' ? 'neutral' : 'warn')))) });
  }

  const jours = [...new Set(ev.map(e => e.date))].sort().reverse();
  const nSignaux = ev.filter(e => e.signal).length;
  const hint = `Du ${fmtDate(debut)} au ${fmtDate(fin)} · ${nSignaux ? `${nSignaux} ${nSignaux > 1 ? 'signaux' : 'signal'} (niveau 1, note sous 4 ou « pas encore », devoir ouvert, action en retard)` : 'aucun signal'}.`;
  if (!jours.length) return card('Ces deux dernières semaines', { hint }, empty('Rien à signaler sur cette période.'));
  const recents = (a, b) => b.date.localeCompare(a.date) || a.ordre - b.ordre;

  if (!state.chrono) {
    // Replié : les 3 signaux les plus récents ; s'il y en a moins, complété par les derniers événements.
    const choisis = [...ev.filter(e => e.signal).sort(recents), ...ev.filter(e => !e.signal).sort(recents)].slice(0, 3);
    return card('Ces deux dernières semaines', { hint },
      h('ul', { class: 'list chrono-court' }, choisis.map(e => h('li', null,
        h('span', { class: 'chrono-date' }, fmtDate(e.date, { day: true, year: false })), e.node))),
      h('div', { style: { marginTop: '8px' } },
        btn(`Tout afficher (${ev.length} événement${ev.length > 1 ? 's' : ''} sur ${jours.length} jour${jours.length > 1 ? 's' : ''})`, () => { state.chrono = true; refresh(); }, 'ghost small', { 'aria-expanded': 'false', 'data-cle-focus': 'chrono' })));
  }

  const rows = [];
  const silence = (n, texte) => n >= 2 && rows.push(h('li', { class: 'chrono-gap' }, texte(n)));
  silence(daysBetween(jours[0], fin), n => `Rien depuis ${n} jours.`);
  jours.forEach((date, k) => {
    if (k) silence(daysBetween(date, jours[k - 1]) - 1, n => `${n} jours sans événement.`);
    const phase = v ? phaseOf(date, v) : null;
    rows.push(h('li', { class: 'chrono-day' },
      h('h3', null, fmtDate(date, { day: true }), phase && phaseBadge(phase)),
      h('ul', { class: 'list' }, ev.filter(e => e.date === date).sort((a, b) => a.ordre - b.ordre).map(e => h('li', null, e.node)))));
  });
  return card('Ces deux dernières semaines', { hint },
    h('ol', { class: 'chrono' }, rows),
    h('div', { style: { marginTop: '8px' } }, btn('Replier : 3 éléments principaux', () => { state.chrono = false; refresh(); }, 'ghost small', { 'aria-expanded': 'true', 'data-cle-focus': 'chrono' })));
}

function devoirsCard(i) {
  const dv = sortBy(S.store.where('RS_Devoirs', d => d.InscriptionID === i.ID), '-DateConstat');
  const setStatut = async (d, statut) => {
    const avant = { Statut: d.Statut, DateResolution: d.DateResolution ?? null };
    await S.store.update('RS_Devoirs', d.ID, { Statut: statut, DateResolution: refDate() });
    toast(`Devoir marqué « ${statut} »`, 'ok', {
      label: 'Annuler',
      onClick: async () => { await S.store.update('RS_Devoirs', d.ID, avant); toast('Devoir remis à « Ouvert »'); refresh(); },
    });
    refresh();
  };
  const ouverts = dv.filter(d => d.Statut === 'Ouvert');
  return card(`Devoirs non faits (${ouverts.length} ouvert${ouverts.length > 1 ? 's' : ''})`, { hint: 'Les devoirs non faits sont aussi enregistrés en décompression, mais sans retenue.' },
    dv.length ? h('ul', { class: 'list' }, dv.slice(0, state.showAll ? 999 : 8).map(d => h('li', null,
      h('div', { class: 'item devoir' },
        h('div', { class: 'main' },
          h('div', { class: 'title' }, `${cours(d.CoursID)?.Title} · ${d.Description}`),
          h('div', { class: 'meta' }, `${fmtDate(d.DateConstat, { day: true })}${d.SansConsequence ? ' · sans conséquence' : ''}`)),
        h('div', { class: 'end' },
          d.Statut === 'Ouvert'
            ? h('div', { class: 'btn-row split' }, btn('Rattrapé', () => setStatut(d, 'Rattrapé'), 'secondary'), btn('Non rattrapé', () => setStatut(d, 'Non rattrapé'), 'danger secondary'))
            : badge(d.Statut, d.Statut === 'Rattrapé' ? 'ok' : 'danger')))))) : empty('Aucun devoir non fait.'));
}

const filtreCours = x => !state.cours.length || state.cours.includes(x.CoursID);

/** Filtre par cours, commun aux suivis et aux évaluations : menu repliable, plusieurs cours possibles. */
function filtreCoursCard(i) {
  const ids = new Set([...S.store.where('RS_Suivis', s => s.InscriptionID === i.ID), ...S.store.where('RS_Evaluations', x => x.InscriptionID === i.ID)].map(x => x.CoursID));
  const liste = sortBy([...ids].map(id => cours(id)).filter(Boolean), 'Title');
  if (!liste.length) return null;
  const n = state.cours.length;
  const resume = !n ? 'Tous les cours' : n === 1 ? cours(state.cours[0])?.Title || '1 cours' : `${n} cours choisis`;
  return card(null, { cls: 'filtre-dossier' },
    h('div', { class: 'filtre-ligne' },
      h('span', { class: 'label' }, 'Suivis et évaluations :'),
      h('button', {
        type: 'button', class: `menu-filtre ${n ? 'actif' : ''}`, 'aria-expanded': String(state.menuCours), 'aria-controls': 'menu-cours-dossier', 'data-cle-focus': 'menu-cours',
        onClick: () => { state.menuCours = !state.menuCours; refresh(); },
      }, h('span', null, resume), h('span', { class: 'chevron', 'aria-hidden': 'true' }, state.menuCours ? '▴' : '▾')),
      n ? btn('Tout afficher', () => { state.cours = []; refresh(); }, 'ghost small', { 'data-focus-repli': 'menu-cours' }) : null),
    state.menuCours && h('div', { class: 'panneau-filtre', id: 'menu-cours-dossier' },
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Cours' }, liste.map(c => h('button', {
        type: 'button', class: 'chip puce', 'aria-pressed': String(state.cours.includes(c.ID)),
        onClick: () => { state.cours = basculer(state.cours, c.ID); refresh(); },
      }, h('span', { class: 'dot', style: { background: c.Couleur || 'var(--muted)' } }), c.Title))),
      h('div', { class: 'btn-row' }, btn('Fermer', () => { state.menuCours = false; refresh(); }, 'secondary small'))));
}

function evaluationsCard(i, e) {
  const ev = sortBy(S.store.where('RS_Evaluations', x => x.InscriptionID === i.ID && filtreCours(x)), '-DateEval');
  const basses = ev.filter(x => typeof x.Note === 'number' && x.Note < 4);
  return card(`Évaluations${state.cours.length ? ` (${ev.length}, filtrées)` : ''}`, {
    actions: i.StatutInscription === 'En cours' ? [btn('+ Évaluation', () => nav('evaluation', { eleve: e.ID }), 'secondary small')] : null,
  },
  basses.length ? notice(`${basses.length} note${basses.length > 1 ? 's' : ''} sous 4 : signal à discuter au bilan, pas un résultat à maquiller.`, 'warn') : null,
  ev.length ? h('ul', { class: 'list' }, ev.map(x => h('li', null,
    h('button', { type: 'button', class: 'item', onClick: () => nav('evaluation', { id: x.ID }) },
      h('span', { class: 'dot', style: { background: cours(x.CoursID)?.Couleur } }),
      h('div', { class: 'main' },
        h('div', { class: 'title' }, `${cours(x.CoursID)?.Title} · ${x.Sujet}`),
        h('div', { class: 'meta' }, `${fmtDate(x.DateEval)} · ${x.Phase}${x.Coefficient && x.Coefficient !== 1 ? ` · coef. ${String(x.Coefficient).replace('.', ',')}` : ''}${x.Etayage ? ` · étayage : ${x.Etayage}` : ''}`)),
      h('div', { class: 'end' }, typeof x.Note === 'number'
        ? h('strong', { class: x.Note < 4 ? 'danger-text' : null }, fmtNote(x.Note))
        : badge(x.ResultatFormatif || '—', x.ResultatFormatif === 'Pas encore' ? 'warn' : 'ok')))))) : empty('Aucune évaluation.'));
}

function actionsCard(i) {
  const today = refDate();
  const acts = S.store.where('RS_Actions', a => a.InscriptionID === i.ID);
  const open = sortBy(acts.filter(a => !['Fait', 'Abandonnée'].includes(a.Statut)), 'Echeance');
  const closed = sortBy(acts.filter(a => ['Fait', 'Abandonnée'].includes(a.Statut)), '-DateCloture');
  return card('Actions', { actions: [btn('+ Action', () => nav('action', { insc: i.ID }), 'secondary small')] },
    acts.length ? h('ul', { class: 'list' }, [...open, ...closed].map(a => {
      const late = open.includes(a) && a.Echeance && a.Echeance < today;
      return h('li', null, h('button', { type: 'button', class: `item ${late ? 'late' : ''}`, onClick: () => nav('action', { id: a.ID }) },
        h('div', { class: 'main' },
          h('div', { class: 'title' }, a.Description),
          h('div', { class: 'meta' }, `${a.Responsable} · échéance ${fmtDate(a.Echeance)}${late ? ' · en retard' : ''}`)),
        h('div', { class: 'end' }, badge(a.Statut, a.Statut === 'Fait' ? 'ok' : a.Statut === 'Abandonnée' ? 'neutral' : late ? 'danger' : 'warn'))));
    })) : empty('Aucune action.'));
}

function bilansCard(i) {
  return card('Bilans de coordination', { actions: [btn('Ouvrir les bilans', () => nav('bilan', { insc: i.ID }), 'secondary small')] },
    h('ul', { class: 'list' }, ['Mise en route', 'Intermédiaire', 'Final'].map(t => {
      const b = bilanDe(i.ID, t);
      return h('li', null, h('button', { type: 'button', class: 'item', onClick: () => nav('bilan', { insc: i.ID, type: t }) },
        h('div', { class: 'main' },
          h('div', { class: 'title' }, t),
          h('div', { class: 'meta' }, b ? `${fmtDate(b.DateBilan)}${b.Objectif ? ' · ' + b.Objectif : b.ObjectifSortie ? ' · ' + b.ObjectifSortie : ''}` : 'pas encore fait')),
        h('div', { class: 'end' }, b ? badge(b.DateValidationCoord ? 'validé' : 'à valider', b.DateValidationCoord ? 'ok' : 'warn') : badge('à faire'))));
    })));
}

function suivisCard(i, e) {
  const L = labels();
  const sv = sortBy(S.store.where('RS_Suivis', s => s.InscriptionID === i.ID && filtreCours(s)), '-DateSuivi', 'CoursID');
  const shown = state.showAll ? sv : sv.slice(0, 12);
  return card(`${state.cours.length ? 'Suivis filtrés' : 'Tous les suivis'} (${sv.length})`, { hint: 'Un suivi se modifie pendant 7 jours par son auteur·e, ensuite par la coordination.' },
    sv.length ? h('ul', { class: 'list' }, shown.map(s => {
      const c = cours(s.CoursID);
      const texts = [s.Observation, s.CoachTravaille && `Travaillé : ${s.CoachTravaille}`, s.CoachProgres && `Progrès / vigilance : ${s.CoachProgres}`].filter(Boolean);
      const editable = canEditSuivi(s);
      return h('li', null, h(editable ? 'button' : 'div', {
        type: editable ? 'button' : null, class: 'item', onClick: editable ? () => nav('saisie', { id: s.ID }) : null,
        title: editable ? 'Modifier ce suivi' : 'Modification réservée à l\'auteur·e pendant 7 jours, puis à la coordination',
      },
      typeof s.Comportement === 'number' ? ctPair(s.Comportement, s.Travail, L, false) : h('span', { class: 'badge neutral' }, 'coaching'),
      h('div', { class: 'main' },
        h('div', { class: 'title' }, `${c?.Title}`, h('span', { class: 'muted', style: { fontWeight: 400 } }, ` · ${fmtDate(s.DateSuivi, { day: true })}${s.Portee === 'Semaine' ? ' (semaine)' : ''}`)),
        h('div', { class: 'meta' }, ens(s.EnseignantID)?.Title || ''),
        texts.map(t => h('div', { class: 'small' }, t))),
      editable && h('span', { class: 'muted', 'aria-hidden': 'true' }, '✎')));
    })) : empty('Aucun suivi.'),
    sv.length > 12 && h('div', { style: { marginTop: '8px' } }, btn(state.showAll ? 'Afficher moins' : `Afficher les ${sv.length} suivis`, () => { state.showAll = !state.showAll; refresh(); }, 'ghost small', { 'data-cle-focus': 'suivis-tout' })));
}

function inscriptionCard(i) {
  const v = volee(i.VoleeID);
  const profs = [['Français', i.ProfFrancais], ['Allemand', i.ProfAllemand], ['Anglais', i.ProfAnglais], ['Maths', i.ProfMaths], ['Sciences', i.ProfSciences]].filter(([, x]) => x);
  return h('details', { class: 'card fold' },
    h('summary', null, h('h2', null, `Inscription ${v?.Title}`), h('span', { class: 'hint' }, `${fmtDate(v.DateDebut)} – ${fmtDate(v.DateFin)} · ${i.StatutInscription}`)),
    h('dl', { class: 'kv' },
    h('dt', null, 'Dates'), h('dd', null, `${fmtDate(v.DateDebut)} – ${fmtDate(v.DateFin)}`),
    h('dt', null, 'Phases'), h('dd', null, `remobilisation dès le ${fmtDate(v.DateDebutRemob, { year: false })}, ré-exposition dès le ${fmtDate(v.DateDebutReexpo, { year: false })}`),
    h('dt', null, 'Degré'), h('dd', null, i.Degre),
    h('dt', null, 'Classe'), h('dd', null, i.ClasseOrigine),
    h('dt', null, 'Titulaire'), h('dd', null, i.Titulaire),
    profs.length ? [h('dt', null, 'Enseignant·es'), h('dd', null, profs.map(([k, x]) => `${k} ${x}`).join(' · '))] : null,
    h('dt', null, 'Statut'), h('dd', null, i.StatutInscription)),
    h('div', { class: 'btn-row', style: { marginTop: '12px' } }, btn('Modifier l\'inscription', () => nav('inscription', { insc: i.ID }), 'secondary small')));
}

function editEleve(e) {
  const nom = input('text', e.Nom), prenom = input('text', e.Prenom);
  const statut = select(STATUTS_ELEVE, e.Statut);
  modal('Modifier le dossier', h('div', { class: 'form' },
    h('div', { class: 'row' }, field('Nom', nom), field('Prénom', prenom)),
    field('Statut', statut, { help: 'Un dossier n\'est jamais supprimé : « Archivé » le retire des listes courantes.' })), [
    { label: 'Annuler', variant: 'secondary' },
    {
      label: 'Enregistrer', onClick: async () => {
        if (!nom.value.trim() || !prenom.value.trim()) { toast('Nom et prénom obligatoires', 'err'); return false; }
        await S.store.update('RS_Eleves', e.ID, { Nom: nom.value.trim(), Prenom: prenom.value.trim(), Title: `${nom.value.trim()} ${prenom.value.trim()}`, CleDoublon: cleDoublon(nom.value, prenom.value), Statut: statut.value });
        toast('Dossier modifié'); refresh();
      },
    },
  ]);
}

async function closeInscription(i, e) {
  const st = select(STATUTS_INSCRIPTION.filter(s => s !== 'En cours'), 'Terminée');
  const elStatut = select(STATUTS_ELEVE, 'Ancien');
  modal('Clore l\'inscription', h('div', { class: 'form' },
    field('Statut de l\'inscription', st),
    field('Statut du dossier élève', elStatut, { help: '« Ancien » : l\'élève a quitté le dispositif mais peut revenir pour une nouvelle volée.' })), [
    { label: 'Annuler', variant: 'secondary' },
    {
      label: 'Clore', onClick: async () => {
        await S.store.update('RS_Inscriptions', i.ID, { StatutInscription: st.value });
        await S.store.update('RS_Eleves', e.ID, { Statut: elStatut.value });
        toast('Inscription close'); refresh();
      },
    },
  ]);
}

export function render(params) {
  const e = eleve(params.eleve);
  if (!e) return h('div', { class: 'page' }, notice('Élève introuvable.', 'danger'), btn('Retour à la liste', () => nav('eleves'), 'secondary'));
  const inscs = inscriptionsEleve(e.ID);
  const i = (params.insc && inscs.find(x => x.ID === Number(params.insc))) || inscriptionCourante(e.ID);
  const sk = semaineCle(refDate());

  const cps = i ? cpsDe([i.ID]) : [];
  const phase = i && phaseInscription(i);
  const enCours = i?.StatutInscription === 'En cours';

  const head = h('header', { class: `page-head${phase ? ' ' + PHASE_CLASS[phase] : ''}` },
    h('div', null,
      h('h1', null, nomEleve(e), ' ', e.Statut !== 'Actif' ? badge(e.Statut) : null),
      h('div', { class: 'sub' }, i ? `${volee(i.VoleeID)?.Title} · ${i.Degre} · classe ${i.ClasseOrigine} · titulaire ${i.Titulaire}` : 'Aucune inscription', ' ', i && phaseBadge(phase, etatVolee(i) || undefined))),
    h('div', { class: 'btn-row' },
      enCours && btn('+ Nouveau suivi', () => nav('saisie', { eleve: e.ID })),
      menu('Plus', [
        i && { titre: 'Autres écrans du dossier' },
        i && { label: 'Orientation', onClick: () => nav('orientation', { eleve: e.ID }) },
        i && { label: 'Fiche coaching', onClick: () => nav('coaching', { insc: i.ID }) },
        i && { label: `Compétences psychosociales (CPS)${cps.length ? ` · ${cps.length}` : ''}`, onClick: () => nav('cps', { eleve: e.ID, insc: i.ID }) },
        i && { sep: true },
        { titre: 'Modifier' },
        { label: 'Modifier le dossier', onClick: () => editEleve(e) },
        { label: 'Nouvelle inscription', onClick: () => nav('inscription', { eleve: e.ID }) },
        enCours && { label: 'Clore l\'inscription…', danger: true, onClick: () => closeInscription(i, e) },
      ])));

  if (!i) return h('div', { class: 'page' }, h('div', { class: 'eleve-nav no-print' }, h('button', { type: 'button', class: 'back', onClick: () => back('eleves') }, '‹ Liste des élèves')), head, card(null, {}, empty('Cet élève n\'a encore aucune inscription.')));

  const alerteSemaine = S.store.where('RS_Suivis', s => s.InscriptionID === i.ID && s.SemaineCle === sk && (s.Comportement === 1 || s.Travail === 1));
  const nRetenue = S.store.where('RS_Devoirs', d => d.InscriptionID === i.ID && d.SemaineCle === sk && !d.SansConsequence).length;

  return h('div', { class: 'page' },
    enteteEleve({ route: 'dossier', eleveId: e.ID, inscId: i.ID, params: (x, xi) => ({ eleve: x.ID, insc: xi.ID }), retour: { label: '‹ Liste des élèves', onClick: () => back('eleves') } }),
    head,
    inscs.length > 1 && h('div', { class: 'chips', role: 'group', 'aria-label': 'Inscriptions' },
      inscs.map(x => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(x.ID === i.ID), onClick: () => nav('dossier', { eleve: e.ID, insc: x.ID }) },
        volee(x.VoleeID)?.Title, h('span', { class: 'meta' }, `${x.Degre} · ${x.StatutInscription}`)))),
    !enCours && notice(`Inscription ${i.StatutInscription.toLowerCase()} : le suivi est clos. Pour le reprendre, ajoutez une nouvelle inscription (menu Plus). Les bilans restent modifiables.`, 'info'),
    alerteSemaine.length ? notice(`Niveau 1 cette semaine, à discuter : ${alerteSemaine.map(s => `${cours(s.CoursID)?.Title} (${fmtDate(s.DateSuivi, { day: true, year: false })})`).join(', ')}.`, 'danger') : null,
    nRetenue ? notice(`Retenue du vendredi : ${retenueMinutes(nRetenue)} minutes (${nRetenue} devoir${nRetenue > 1 ? 's' : ''} non fait${nRetenue > 1 ? 's' : ''} cette semaine).`, 'warn') : null,
    syntheseCard(i),
    chronologieCard(i),
    filtreCoursCard(i),
    h('div', { class: 'cols-dossier suivis-d-abord' },
      h('div', { class: 'stack' }, suivisCard(i, e), evaluationsCard(i, e)),
      h('div', { class: 'stack' }, devoirsCard(i), actionsCard(i), bilansCard(i), inscriptionCard(i))));
}

export { pastille };
