// Suivi : cotations de comportement et de travail de la semaine, actions en cours et observations, pour tous les élèves de la volée.
import { S, nav, voleeAt, inscriptionsEnCours, eleve, nomEleve, cours, refDate, vueRestreinte, mesCours, moi, labels } from '../state.js';
import { h, card, btn, empty, notice, badge, ctPair, levelLegend, phaseBadge, esc } from '../ui.js';
import { fmtDate, fmtDateLong, mondayOf, addDays, semaineCle, phaseOf, sortBy, weeksOfVolee, estCote, moyenne } from '../domain.js';
import { suivisDeSemaine } from '../queries.js';

const state = { date: null, ref: null, alpha: false, courbes: true };
const fmt1 = v => v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ','); // semaine affichée ; revient à la date de référence quand celle-ci change

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

  const enRetard = a => a.Echeance && a.Echeance < refDate();
  const colonnes = sortBy([...new Set(suivis.map(s => s.CoursID))].map(id => cours(id)).filter(Boolean), 'Title');

  const lignes = inscs.map(i => {
    const e = eleve(i.EleveID);
    const sv = suivis.filter(s => s.InscriptionID === i.ID);
    const ac = actions.filter(x => x.InscriptionID === i.ID);
    const niveau1 = sv.some(s => s.Comportement === 1 || s.Travail === 1);
    const retard = ac.some(enRetard);
    return { Nom: e?.Nom || '', Prenom: e?.Prenom || '', i, e, sv, ac, niveau1, retard, aDiscuter: niveau1 || retard ? 0 : 1 };
  });
  const triees = state.alpha ? sortBy(lignes, 'Nom', 'Prenom') : sortBy(lignes, 'aDiscuter', 'Nom', 'Prenom');

  const caseCours = (sv, c) => {
    const list = sortBy(sv.filter(s => s.CoursID === c.ID), 'DateSuivi');
    if (!list.length) return h('td', { class: 'suivi-vide' }, h('span', { 'aria-hidden': 'true' }, '–'), h('span', { class: 'sr-only' }, 'pas de cotation'));
    return h('td', null, h('div', { class: 'suivi-cell' }, list.map(s => h('span', { class: 'suivi-it' },
      list.length > 1 && h('span', { class: 'suivi-cours' }, fmtDate(s.DateSuivi, { day: true, year: false })),
      ctPair(s.Comportement, s.Travail, L)))));
  };

  // une colonne pour les deux : actions ouvertes (A, par échéance) puis observations de la semaine (O, par date)
  const texteObs = s => [s.Observation, s.CoachTravaille, s.CoachProgres].filter(Boolean).join(' · ');
  const cellActions = (list, sv) => {
    const obs = sortBy(sv.filter(s => texteObs(s)), 'DateSuivi');
    return list.length || obs.length
      ? h('ul', { class: 'suivi-actions' },
        sortBy(list, 'Echeance').map(a => h('li', { class: enRetard(a) ? 'retard' : '' },
          h('span', { class: 'suivi-tag a', title: 'Action' }, 'A'),
          h('span', { class: 'suivi-ech' }, a.Echeance ? fmtDate(a.Echeance, { day: true, year: false }) : 'sans date'),
          h('button', { type: 'button', class: 'back', onClick: () => nav('action', { id: a.ID }) }, a.Description || '(sans description)'),
          h('span', { class: 'muted small' }, a.Responsable || '—'),
          enRetard(a) && badge('en retard', 'danger'))),
        // observation repliée sur une ligne (début du texte), dépliée au clic
        obs.map(s => h('li', null, h('details', { class: 'suivi-obs' },
          h('summary', null,
            h('span', { class: 'suivi-tag o', title: 'Observation' }, 'O'),
            h('span', { class: 'suivi-ech' }, fmtDate(s.DateSuivi, { day: true, year: false })),
            h('span', { class: 'suivi-obs-txt' }, texteObs(s)),
            h('span', { class: 'muted small suivi-obs-cours' }, cours(s.CoursID)?.Title || ''))))))
      : h('span', { class: 'muted' }, 'aucune');
  };

  // retards et matériel manquant de la semaine : un décompte sous le nom plutôt qu'une étiquette par cotation
  const decompte = sv => {
    const n = k => sv.filter(s => s[k]).length;
    const rt = n('Retard'), mat = n('MaterielManquant');
    const txt = [rt && `${rt} retard${rt > 1 ? 's' : ''}`, mat && `${mat} matériel${mat > 1 ? 's' : ''} manquant${mat > 1 ? 's' : ''}`].filter(Boolean).join(' · ');
    return txt ? h('div', { class: 'suivi-decompte' }, txt) : null;
  };

  const corps = triees.map(r => h('tr', null,
    h('th', { scope: 'row' },
      h('button', { type: 'button', class: 'back', onClick: () => nav('dossier', { eleve: r.i.EleveID }) }, nomEleve(r.e)),
      decompte(r.sv),
      (r.niveau1 || r.retard) && h('div', { class: 'suivi-reperes' },
        r.niveau1 && badge(L[0] || 'niveau 1', 'danger'),
        r.retard && badge('action en retard', 'danger'))),
    colonnes.map(c => caseCours(r.sv, c)),
    h('td', { class: 'suivi-col-actions' }, cellActions(r.ac, r.sv))));

  /* ---- Tendance : moyenne hebdomadaire de C et de T, une petite courbe par élève, de la 1re semaine à celle affichée ---- */
  const cles = semaines.map(semaineCle);
  const jusqua = cles.indexOf(sk);
  const toutes = S.store.where('RS_Suivis', x => estCote(x) && inscs.some(i => i.ID === x.InscriptionID) && (!coursIds || coursIds.has(x.CoursID)));
  const courbe = r => {
    const mine = toutes.filter(x => x.InscriptionID === r.i.ID);
    const pts = cles.map((k, n) => {
      if (n > jusqua) return null;
      const sem = mine.filter(x => x.SemaineCle === k);
      return sem.length ? { n, c: moyenne(sem.map(x => x.Comportement)), t: moyenne(sem.map(x => x.Travail)) } : null;
    });
    const nom = nomEleve(r.e);
    if (!pts.some(Boolean)) return h('div', { class: 'suivi-mini' }, h('div', { class: 'suivi-mini-nom' }, nom), h('span', { class: 'muted small' }, 'pas encore de cotation'));
    const W = 200, H = 56, pad = 6, n = cles.length;
    const x = k => pad + (n === 1 ? (W - 2 * pad) / 2 : (W - 2 * pad) * k / (n - 1));
    const y = v => pad + (H - 2 * pad) * (1 - (v - 1) / 3);
    const serie = (cle, col, dash) => {
      let out = '', run = [];
      const fin = () => { if (run.length > 1) out += `<polyline points="${run.map(q => `${x(q.n).toFixed(1)},${y(q[cle]).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${dash ? ' stroke-dasharray="5 4"' : ''}/>`; run = []; };
      pts.forEach((q, k) => { if (!q) fin(); else run.push(q); });
      fin();
      for (const q of pts.filter(Boolean)) out += `<circle cx="${x(q.n).toFixed(1)}" cy="${y(q[cle]).toFixed(1)}" r="${q.n === jusqua ? 3.5 : 2.5}" fill="${col}"><title>${cle === 'c' ? 'Comportement' : 'Travail'} · semaine ${q.n + 1} : ${fmt1(q[cle])}</title></circle>`;
      return out;
    };
    const dit = cle => pts.filter(Boolean).map(q => `semaine ${q.n + 1} : ${fmt1(q[cle])}`).join(', ');
    const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${nom}. Comportement : ${dit('c')}. Travail : ${dit('t')}.`)}">`
      + `<line x1="${pad}" x2="${W - pad}" y1="${y(1)}" y2="${y(1)}" stroke="var(--line)"/><line x1="${pad}" x2="${W - pad}" y1="${y(4)}" y2="${y(4)}" stroke="var(--line)"/>`
      + `<line x1="${x(jusqua)}" x2="${x(jusqua)}" y1="2" y2="${H - 2}" stroke="var(--line-strong)" stroke-width="1"/>`
      + serie('t', 'var(--accent)', true) + serie('c', 'var(--ink)', false) + '</svg>';
    return h('div', { class: 'suivi-mini' }, h('div', { class: 'suivi-mini-nom' }, nom), h('div', { svg }));
  };
  const tendance = h('details', { class: 'card fold', open: state.courbes, onToggle: e => { state.courbes = e.target.open; } },
    h('summary', null, h('h2', null, 'Tendance depuis le début de la volée'),
      h('span', { class: 'hint' }, 'moyenne hebdomadaire, de 1 à 4 · trait plein : comportement · pointillé : travail')),
    triees.length ? h('div', { class: 'suivi-mini-grid' }, triees.map(courbe)) : empty('Aucun élève inscrit dans cette volée.'));

  const tableau = h('div', { class: 'scroll-x' }, h('table', { class: 'tbl suivi-tbl' },
    h('caption', { class: 'sr-only' }, `Cotations de comportement (C) et de travail (T) de la semaine ${sk % 100}, par élève et par cours, actions en cours (A) et observations de la semaine (O)`),
    h('thead', null, h('tr', null,
      h('th', { scope: 'col' }, 'Élève'),
      colonnes.map(c => h('th', { scope: 'col' }, c.Title)),
      h('th', { scope: 'col', class: 'suivi-col-actions' }, 'Actions (A) et observations (O)'))),
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
        lundi !== mondayOf(refDate()) && btn('Cette semaine', () => aller(null), 'secondary'),
        btn(state.alpha ? 'À discuter en premier' : 'Ordre alphabétique', () => { state.alpha = !state.alpha; nav('suivi'); }, 'secondary', { title: 'Changer l\'ordre des élèves' }))),
    tendance,
    card('Cotations, actions et observations', { hint: (restreint ? 'Vue limitée à vos cours et aux actions qui vous sont attribuées. ' : 'Toutes les cotations et observations de la semaine, et toutes les actions ouvertes. ') + (state.alpha ? 'Ordre alphabétique.' : 'Les élèves à discuter (désengagement, action en retard) sont en tête.') },
      levelLegend(L, { compact: true }),
      triees.length ? tableau : empty('Aucun élève inscrit dans cette volée.')));
}
