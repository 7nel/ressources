// Organisation : ce que je dois faire (tâches, actions, contrôles), les devoirs et évaluations par cours, et le travail de l'équipe.
import { S, nav, moi, refDate, enseignantsActifs, nomEleve, eleve, cours, mesCours, coursActifs, voleeAt, refresh } from '../state.js';
import { h, card, btn, field, select, input, textarea, seg, badge, empty, modal, toast, notice } from '../ui.js';
import { fmtDate, sortBy, mondayOf, addDays, weeksOfVolee, phaseOf, STATUTS_TACHE } from '../domain.js';
import { travauxAControler } from '../queries.js';

const state = { onglet: 'moi', cours: null, equipe: 'ouvertes' };
const ONGLETS = [{ value: 'moi', label: 'Pour moi' }, { value: 'cours', label: 'Devoirs et évaluations' }, { value: 'equipe', label: 'Équipe' }];
const actionOuverte = a => !['Fait', 'Abandonnée'].includes(a.Statut);

function editTache(t) {
  const m = moi();
  const titre = input('text', t?.Title || '');
  const desc = textarea(t?.Description || '');
  const resp = select(enseignantsActifs().map(e => e.Title), t?.Responsable || m?.Title);
  const ech = input('date', t?.Echeance || refDate());
  const statut = select(STATUTS_TACHE, t?.Statut || 'À faire');
  const eleves = sortBy(S.store.where('RS_Eleves', e => e.Statut === 'Actif'), 'Nom');
  const el = select([{ value: '', label: '(aucun)' }, ...eleves.map(e => ({ value: e.ID, label: nomEleve(e) }))], t?.EleveID || '');
  modal(t ? 'Modifier la tâche' : 'Nouvelle tâche', h('div', { class: 'form' },
    field('Tâche', titre),
    field('Détails (facultatif)', desc),
    h('div', { class: 'row' }, field('Responsable', resp), field('Échéance', ech)),
    h('div', { class: 'row' }, field('Statut', statut), field('Élève concerné (facultatif)', el))), [
    { label: 'Annuler', variant: 'secondary' },
    {
      label: 'Enregistrer', onClick: async () => {
        if (!titre.value.trim()) { toast('Indiquez la tâche', 'err'); return false; }
        const rec = {
          Title: titre.value.trim(), Description: desc.value.trim(), Responsable: resp.value, Echeance: ech.value || null,
          Statut: statut.value, EleveID: el.value ? Number(el.value) : null,
          DateCloture: statut.value === 'Terminée' ? (t?.DateCloture || refDate()) : null,
        };
        if (t) await S.store.update('RS_Taches', t.ID, rec);
        else await S.store.add('RS_Taches', { ...rec, CreePar: m?.Title || '' });
        toast('Tâche enregistrée'); refresh();
      },
    },
  ]);
}

function labelSemaine(mon, ref) {
  const v = voleeAt(ref);
  const base = `semaine du ${fmtDate(mon, { year: false })}`;
  if (!v) return base[0].toUpperCase() + base.slice(1);
  const n = weeksOfVolee(v).indexOf(mon) + 1;
  return n > 0 ? `S${n} (${phaseOf(ref, v).toLowerCase()}) · ${base}` : base[0].toUpperCase() + base.slice(1);
}

/* ---------- Éléments communs : une tâche, une action, un devoir ou une évaluation prévus ---------- */
// Chaque élément : { date, late, node }. Tâches et actions se terminent d'un clic (✓) ; le reste s'ouvre.
function itemTache(t, today, { avecResp = false } = {}) {
  const late = t.Statut !== 'Terminée' && t.Echeance && t.Echeance < today;
  const done = async () => { await S.store.update('RS_Taches', t.ID, { Statut: 'Terminée', DateCloture: today }); toast('Tâche terminée'); refresh(); };
  return { date: t.Echeance, late, node: h('div', { class: `item ${late ? 'late' : ''}` },
    t.Statut !== 'Terminée'
      ? h('button', { type: 'button', class: 'btn secondary small', 'aria-label': `Terminer : ${t.Title}`, title: 'Marquer comme terminée', onClick: done }, '✓')
      : h('span', { class: 'badge ok' }, '✓'),
    h('button', { type: 'button', class: 'main', style: { background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', padding: 0 }, onClick: () => editTache(t) },
      h('div', { class: 'title' }, t.Title),
      h('div', { class: 'meta' }, ['Tâche', avecResp && t.Responsable, t.Echeance ? `échéance ${fmtDate(t.Echeance)}${late ? ' (en retard)' : ''}` : 'sans échéance', t.EleveID && nomEleve(eleve(t.EleveID))].filter(Boolean).join(' · '))),
    h('div', { class: 'end' }, t.Statut === 'En cours' && badge('en cours', 'warn'))) };
}
function itemAction(a, today, { avecResp = false } = {}) {
  const late = actionOuverte(a) && a.Echeance && a.Echeance < today;
  const done = async () => { await S.store.update('RS_Actions', a.ID, { Statut: 'Fait', DateCloture: today }); toast('Action faite'); refresh(); };
  return { date: a.Echeance, late, node: h('div', { class: `item ${late ? 'late' : ''}` },
    actionOuverte(a)
      ? h('button', { type: 'button', class: 'btn secondary small', 'aria-label': `Marquer comme faite : ${a.Description}`, title: 'Marquer comme faite', onClick: done }, '✓')
      : h('span', { class: 'badge ok' }, '✓'),
    h('button', { type: 'button', class: 'main', style: { background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', padding: 0 }, onClick: () => nav('action', { id: a.ID }) },
      h('div', { class: 'title' }, a.Description || '(sans description)'),
      h('div', { class: 'meta' }, [`Action · ${nomEleve(eleve(a.EleveID))}`, avecResp && a.Responsable, a.Echeance ? `échéance ${fmtDate(a.Echeance)}${late ? ' (en retard)' : ''}` : 'sans échéance'].filter(Boolean).join(' · '))),
    h('div', { class: 'end' }, a.Statut === 'En cours' && badge('en cours', 'warn'))) };
}
function itemTravail(t, controle) {
  const mien = mesCours().some(c => c.ID === t.CoursID);
  const devoir = t.Type === 'Devoir';
  const ouvre = controle ? () => nav('groupe', { cours: t.CoursID, travail: t.ID }) : () => nav('travail', { id: t.ID });
  return { date: t.Echeance, late: false, node: h('button', { type: 'button', class: 'item', onClick: ouvre },
    h('div', { class: 'main' },
      h('div', { class: 'title' }, t.Title),
      h('div', { class: 'meta' }, `${controle ? (devoir ? 'Devoir à contrôler · ' : 'Évaluation à saisir · ') : ''}${cours(t.CoursID)?.Title}${mien && !controle ? ' (mon cours)' : ''} · ${fmtDate(t.Echeance, { day: true, year: false })}`)),
    controle ? h('span', { 'aria-hidden': 'true', class: 'muted' }, '›') : badge(devoir ? 'Devoir' : 'Évaluation', devoir ? 'neutral' : 'warn')) };
}
const liste = items => h('ul', { class: 'list' }, items.map(x => h('li', null, x.node)));

/* ---------- Pour moi : mes tâches, mes actions, les contrôles de mes cours, par échéance ---------- */
function pourMoi(today) {
  const m = moi();
  if (!m) return card(null, {}, notice('Choisissez vos initiales (en bas du menu) pour voir ce qui vous concerne.', 'info'));
  const mesIds = mesCours().map(c => c.ID);
  const items = [
    ...S.store.where('RS_Taches', t => t.Statut !== 'Terminée' && t.Responsable === m.Title).map(t => itemTache(t, today)),
    ...S.store.where('RS_Actions', a => actionOuverte(a) && a.Responsable === m.Title).map(a => itemAction(a, today)),
    ...(mesIds.length ? travauxAControler(today, mesIds).map(t => itemTravail(t, true)) : []),
  ];
  const finSemaine = addDays(mondayOf(today), 6);
  const groupes = [
    ['Maintenant', x => x.date && x.date <= today],
    ['Cette semaine', x => x.date && x.date > today && x.date <= finSemaine],
    ['Plus tard', x => x.date && x.date > finSemaine],
    ['Sans échéance', x => !x.date],
  ];
  const tri = list => [...list].sort((a, b) => (b.late - a.late) || String(a.date).localeCompare(String(b.date)));
  const cartes = groupes.map(([titre, f]) => { const l = items.filter(f); return l.length ? card(titre, {}, liste(tri(l))) : null; });
  return items.length ? cartes : card(null, {}, empty('Rien à faire pour vous. Les tâches, les actions dont vous êtes responsable et les contrôles de vos cours arrivent ici.'));
}

/* ---------- Devoirs et évaluations : par cours (mes cours, tous, ou un seul) ---------- */
function devoirsEvals(today) {
  const mine = mesCours();
  if (state.cours == null) state.cours = mine.length ? 'mes' : 'tous';
  const tousCours = [...mine, ...coursActifs().filter(x => !mine.includes(x))].filter(c => !c.EstCoaching);
  const unSeul = typeof state.cours === 'number' ? cours(state.cours) : null;
  const ids = unSeul ? [unSeul.ID] : state.cours === 'mes' ? mine.map(c => c.ID) : null;
  const dans = id => !ids || ids.includes(id);

  const choix = field('Cours', select([
    { value: 'mes', label: 'Mes cours' }, { value: 'tous', label: 'Tous les cours' },
    ...tousCours.map(c => ({ value: c.ID, label: c.Title + (mine.includes(c) ? ' (mon cours)' : '') })),
  ], String(state.cours), { onChange: e => { const v = e.target.value; state.cours = v === 'mes' || v === 'tous' ? v : Number(v); refresh(); } }));

  const aControler = travauxAControler(today, ids);
  const deja = new Set(aControler.map(t => t.ID));
  const aVenir = sortBy(S.store.where('RS_Travaux', t => t.Statut === 'Prévu' && t.Echeance >= mondayOf(today) && !deja.has(t.ID) && dans(t.CoursID)), 'Echeance');
  const parSemaine = new Map();
  for (const t of aVenir) {
    const mon = mondayOf(t.Echeance);
    if (!parSemaine.has(mon)) parSemaine.set(mon, []);
    parSemaine.get(mon).push(t);
  }

  // devoirs non rendus : un par élève et par devoir, à marquer rattrapé ou non (comme dans le dossier)
  const nonRendus = sortBy(S.store.where('RS_Devoirs', d => d.Statut === 'Ouvert' && dans(d.CoursID)), 'DateConstat');
  const setStatut = async (d, statut) => {
    await S.store.update('RS_Devoirs', d.ID, { Statut: statut, DateResolution: today });
    toast(`Devoir marqué « ${statut} »`, 'ok', {
      label: 'Annuler',
      onClick: async () => { await S.store.update('RS_Devoirs', d.ID, { Statut: 'Ouvert', DateResolution: null }); toast('Devoir remis à « Ouvert »'); refresh(); },
    });
    refresh();
  };
  const carteNonRendus = nonRendus.length > 0 && card(`Devoirs non rendus (${nonRendus.length})`, { hint: 'Un devoir non fait par ligne, à marquer rattrapé ou non rattrapé.' },
    h('ul', { class: 'list' }, nonRendus.map(d => h('li', null, h('div', { class: 'item devoir' },
      h('div', { class: 'main' },
        h('button', { type: 'button', class: 'back title', onClick: () => nav('dossier', { eleve: d.EleveID }) }, nomEleve(eleve(d.EleveID))),
        h('div', { class: 'meta' }, `${cours(d.CoursID)?.Title} · ${d.Description} · ${fmtDate(d.DateConstat, { day: true, year: false })}${d.SansConsequence ? ' · sans conséquence' : ''}`)),
      h('div', { class: 'end' }, h('div', { class: 'btn-row split' },
        btn('Rattrapé', () => setStatut(d, 'Rattrapé'), 'secondary small'),
        btn('Non rattrapé', () => setStatut(d, 'Non rattrapé'), 'danger secondary small'))))))));

  // un seul cours : ce qui est déjà fait dans la volée, avec le nombre de résultats saisis pour les évaluations
  const v = voleeAt(today);
  const faits = unSeul && v ? sortBy(S.store.where('RS_Travaux', t => t.CoursID === unSeul.ID && t.Statut === 'Contrôlé' && t.Echeance >= v.DateDebut && t.Echeance <= v.DateFin), '-Echeance') : [];
  const nbNotes = t => S.store.where('RS_Evaluations', e => e.CoursID === t.CoursID && e.DateEval === t.Echeance && e.Sujet === t.Title).length;
  const carteFaits = faits.length > 0 && card('Déjà faits dans la volée', {},
    h('ul', { class: 'list' }, faits.map(t => h('li', null, h('div', { class: 'item' },
      h('div', { class: 'main' }, h('div', { class: 'title' }, t.Title), h('div', { class: 'meta' }, `${t.Type === 'Devoir' ? 'Devoir contrôlé' : 'Évaluation saisie'} · ${fmtDate(t.Echeance, { day: true, year: false })}`)),
      t.Type === 'Évaluation' && h('span', { class: 'muted small' }, `${nbNotes(t)} résultat${nbNotes(t) > 1 ? 's' : ''}`))))));

  const rien = !aControler.length && !parSemaine.size && !nonRendus.length && !faits.length;
  return [
    h('div', { class: 'org-filtre' }, choix),
    aControler.length > 0 && card('À contrôler', { hint: 'Échéance passée : un clic ouvre le contrôle du devoir ou la saisie de l\'évaluation.' }, liste(aControler.map(t => itemTravail(t, true)))),
    carteNonRendus,
    [...parSemaine].map(([mon, list]) => card(labelSemaine(mon, list[0].Echeance), {}, liste(list.map(t => itemTravail(t, false))))),
    carteFaits,
    rien && card(null, {}, empty(state.cours === 'mes' ? 'Rien de prévu ni à contrôler dans vos cours.' : 'Rien de prévu ni à contrôler.')),
  ];
}

/* ---------- Équipe : tâches et actions de tout le monde, par responsable ---------- */
function equipe(today) {
  const filtre = seg([{ value: 'ouvertes', label: 'En cours' }, { value: 'terminees', label: 'Terminées' }], state.equipe, v => { state.equipe = v; refresh(); }, 'Filtre');
  if (state.equipe === 'terminees') {
    const fini = [
      ...S.store.where('RS_Taches', t => t.Statut === 'Terminée').map(t => ({ ...itemTache(t, today, { avecResp: true }), clos: t.DateCloture })),
      ...S.store.where('RS_Actions', a => a.Statut === 'Fait').map(a => ({ ...itemAction(a, today, { avecResp: true }), clos: a.DateCloture })),
    ].sort((a, b) => String(b.clos).localeCompare(String(a.clos))).slice(0, 40);
    return card(null, {}, h('div', { style: { marginBottom: '10px' } }, filtre), fini.length ? liste(fini) : empty('Rien de terminé pour l\'instant.'));
  }
  const ouverts = [
    ...S.store.where('RS_Taches', t => t.Statut !== 'Terminée').map(t => ({ resp: t.Responsable, ...itemTache(t, today) })),
    ...S.store.where('RS_Actions', a => actionOuverte(a)).map(a => ({ resp: a.Responsable, ...itemAction(a, today) })),
  ];
  const parResp = new Map();
  for (const x of ouverts) { const k = x.resp || '—'; if (!parResp.has(k)) parResp.set(k, []); parResp.get(k).push(x); }
  const m = moi();
  // moi d'abord, puis les enseignant·es, puis Élève, Parents, Titulaire
  const profs = new Set(enseignantsActifs().map(e => e.Title));
  const rang = k => k === m?.Title ? 0 : profs.has(k) ? 1 : 2;
  const ordre = [...parResp.keys()].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b, 'fr'));
  const tri = list => [...list].sort((a, b) => (b.late - a.late) || (a.date || '9999').localeCompare(b.date || '9999'));
  return [
    h('div', { class: 'org-filtre' }, filtre),
    ordre.length ? ordre.map(k => {
      const list = parResp.get(k);
      const retard = list.filter(x => x.late).length;
      return card(k, { actions: retard ? [badge(`${retard} en retard`, 'danger')] : null }, liste(tri(list)));
    }) : card(null, {}, empty('Aucune tâche ni action ouverte.')),
  ];
}

export function render(params) {
  const today = refDate();
  if (params.onglet && ONGLETS.some(o => o.value === params.onglet)) state.onglet = params.onglet;
  if (params.cours) state.cours = Number(params.cours);
  if (params.id) setTimeout(() => { const t = S.store.get('RS_Taches', params.id); if (t) editTache(t); history.replaceState(null, '', '#/organisation'); }, 0);

  const coursParDefaut = typeof state.cours === 'number' ? { cours: state.cours } : {};
  const corps = state.onglet === 'cours' ? devoirsEvals(today) : state.onglet === 'equipe' ? equipe(today) : pourMoi(today);
  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, 'Organisation'), h('div', { class: 'sub' }, 'Ce que vous avez à faire, les devoirs et évaluations des cours, et le travail de l\'équipe.')),
      h('div', { class: 'btn-row' },
        btn('+ Tâche', () => editTache(null), state.onglet === 'cours' ? 'secondary' : ''),
        btn('+ Devoir', () => nav('travail', { type: 'Devoir', ...coursParDefaut }), 'secondary'),
        btn('+ Évaluation', () => nav('travail', { type: 'Évaluation', ...coursParDefaut }), 'secondary'))),
    h('div', { class: 'org-onglets' }, seg(ONGLETS, state.onglet, v => { state.onglet = v; nav('organisation', { onglet: v }); }, 'Onglets')),
    corps);
}
