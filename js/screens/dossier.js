import { S, nav, back, eleve, cours, volee, ens, inscriptionsEleve, inscriptionCourante, phaseInscription, nomEleve, refDate, isCoord, moi, labels, refresh } from '../state.js';
import { h, card, btn, pastille, ctPair, phaseBadge, badge, empty, notice, toast, modal, field, select, input, confirmDlg } from '../ui.js';
import { fmtDate, fmtNote, semaineCle, sortBy, daysBetween, STATUTS_ELEVE, STATUTS_INSCRIPTION, cleDoublon, PHASE_CLASS, retenueMinutes } from '../domain.js';
import { synthese, bilanDe, cpsDe } from '../queries.js';

const state = { showAll: false };

export function canEditSuivi(s) {
  if (isCoord()) return true;
  const m = moi();
  if (!m || m.ID !== s.EnseignantID) return false;
  return daysBetween(String(s.Created).slice(0, 10), refDate()) <= 7; // R7
}

function syntheseCard(i) {
  const { weeks, rows } = synthese(i);
  const L = labels();
  const nowSk = semaineCle(refDate());
  if (!rows.length) return card('Synthèse hebdomadaire', {}, empty('Aucun suivi pour cette inscription.'));
  const table = h('table', { class: 'syn' },
    h('thead', null, h('tr', null,
      h('th', { scope: 'col' }, 'Cours'),
      weeks.map(w => h('th', { scope: 'col', class: w.sk === nowSk ? 'now' : null, title: w.phase },
        `S${w.n}`, h('br'), h('span', { style: { fontWeight: 400 } }, fmtDate(w.monday, { year: false })),
        h('span', { class: `band ${PHASE_CLASS[w.phase]}` }))))),
    h('tbody', null, rows.map(r => h('tr', null,
      h('th', { scope: 'row' }, h('span', { class: 'dot', style: { background: r.cours.Couleur || 'var(--muted)', marginRight: '6px' } }), r.cours.Title),
      r.cells.map((list, k) => h('td', { class: weeks[k].sk === nowSk ? 'now' : null },
        list.length
          ? h('span', { class: 'cell' }, list.slice(0, 2).map(s => ctPair(s.Comportement, s.Travail, L)), list.length > 2 && h('span', { class: 'more' }, `+${list.length - 2}`))
          : h('span', { class: 'none', 'aria-label': 'aucun suivi' }, '·')))))));
  return card('Synthèse hebdomadaire', {
    hint: 'Toutes les cotations en pastilles, aucune moyenne (R10). C = comportement, T = travail. Bandes : phase de la semaine.',
  }, h('div', { class: 'scroll-x' }, table));
}

function devoirsCard(i) {
  const dv = sortBy(S.store.where('RS_Devoirs', d => d.InscriptionID === i.ID), '-DateConstat');
  const setStatut = async (d, statut) => {
    await S.store.update('RS_Devoirs', d.ID, { Statut: statut, DateResolution: refDate() });
    toast(`Devoir marqué « ${statut} »`);
    refresh();
  };
  const ouverts = dv.filter(d => d.Statut === 'Ouvert');
  return card(`Devoirs non faits (${ouverts.length} ouvert${ouverts.length > 1 ? 's' : ''})`, { hint: 'Enregistrés aussi en décompression, sans conséquence (R6).' },
    dv.length ? h('ul', { class: 'list' }, dv.slice(0, state.showAll ? 999 : 8).map(d => h('li', null,
      h('div', { class: 'item' },
        h('div', { class: 'main' },
          h('div', { class: 'title' }, `${cours(d.CoursID)?.Title} · ${d.Description}`),
          h('div', { class: 'meta' }, `${fmtDate(d.DateConstat, { day: true })}${d.SansConsequence ? ' · sans conséquence' : ''}`)),
        h('div', { class: 'end' },
          d.Statut === 'Ouvert'
            ? [btn('✓ Rattrapé', () => setStatut(d, 'Rattrapé'), 'secondary small'), btn('✗ Non rattrapé', () => setStatut(d, 'Non rattrapé'), 'danger secondary small')]
            : badge(d.Statut, d.Statut === 'Rattrapé' ? 'ok' : 'danger')))))) : empty('Aucun devoir non fait.'));
}

function evaluationsCard(i, e) {
  const ev = sortBy(S.store.where('RS_Evaluations', x => x.InscriptionID === i.ID), '-DateEval');
  const basses = ev.filter(x => typeof x.Note === 'number' && x.Note < 4);
  return card('Évaluations', {
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

function actionsCard(i, e) {
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
  void e;
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
  const sv = sortBy(S.store.where('RS_Suivis', s => s.InscriptionID === i.ID), '-DateSuivi', 'CoursID');
  const shown = state.showAll ? sv : sv.slice(0, 12);
  return card(`Suivis (${sv.length})`, { actions: [btn('+ Nouveau suivi', () => nav('saisie', { eleve: e.ID }), 'small')] },
    sv.length ? h('ul', { class: 'list' }, shown.map(s => {
      const c = cours(s.CoursID);
      const texts = [s.Observation, s.CoachTravaille && `Travaillé : ${s.CoachTravaille}`, s.CoachProgres && `Progrès / vigilance : ${s.CoachProgres}`].filter(Boolean);
      const editable = canEditSuivi(s);
      return h('li', null, h(editable ? 'button' : 'div', {
        type: editable ? 'button' : null, class: 'item', onClick: editable ? () => nav('saisie', { id: s.ID }) : null,
        title: editable ? 'Modifier ce suivi' : 'Modification réservée à l\'auteur (7 jours) puis à la coordination (R7)',
      },
      ctPair(s.Comportement, s.Travail, L, false),
      h('div', { class: 'main' },
        h('div', { class: 'title' }, `${c?.Title}`, h('span', { class: 'muted', style: { fontWeight: 400 } }, ` · ${fmtDate(s.DateSuivi, { day: true })}${s.Portee === 'Semaine' ? ' (semaine)' : ''}`)),
        h('div', { class: 'meta' }, ens(s.EnseignantID)?.Title || ''),
        texts.map(t => h('div', { class: 'small' }, t))),
      editable && h('span', { class: 'muted', 'aria-hidden': 'true' }, '✎')));
    })) : empty('Aucun suivi.'),
    sv.length > 12 && h('div', { style: { marginTop: '8px' } }, btn(state.showAll ? 'Afficher moins' : `Afficher les ${sv.length} suivis`, () => { state.showAll = !state.showAll; refresh(); }, 'ghost small')));
}

function inscriptionCard(i, e) {
  const v = volee(i.VoleeID);
  const profs = [['Français', i.ProfFrancais], ['Allemand', i.ProfAllemand], ['Anglais', i.ProfAnglais], ['Maths', i.ProfMaths], ['Sciences', i.ProfSciences]].filter(([, x]) => x);
  return card(`Inscription ${v?.Title}`, {
    actions: [btn('Modifier', () => nav('inscription', { insc: i.ID }), 'secondary small')],
  }, h('dl', { class: 'kv' },
    h('dt', null, 'Dates'), h('dd', null, `${fmtDate(v.DateDebut)} – ${fmtDate(v.DateFin)}`),
    h('dt', null, 'Phases'), h('dd', null, `remobilisation dès le ${fmtDate(v.DateDebutRemob, { year: false })}, ré-exposition dès le ${fmtDate(v.DateDebutReexpo, { year: false })}`),
    h('dt', null, 'Degré'), h('dd', null, i.Degre),
    h('dt', null, 'Classe'), h('dd', null, i.ClasseOrigine),
    h('dt', null, 'Titulaire'), h('dd', null, i.Titulaire),
    profs.length ? [h('dt', null, 'Enseignant·es'), h('dd', null, profs.map(([k, x]) => `${k} ${x}`).join(' · '))] : null,
    h('dt', null, 'Statut'), h('dd', null, i.StatutInscription)));
  void e;
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
  void confirmDlg;
}

export function render(params) {
  const e = eleve(params.eleve);
  if (!e) return h('div', { class: 'page' }, notice('Élève introuvable.', 'danger'), btn('Retour à la liste', () => nav('eleves'), 'secondary'));
  const inscs = inscriptionsEleve(e.ID);
  const i = (params.insc && inscs.find(x => x.ID === Number(params.insc))) || inscriptionCourante(e.ID);
  const sk = semaineCle(refDate());

  const head = h('div', { class: 'page-head' },
    h('div', null,
      h('button', { type: 'button', class: 'back', onClick: () => back('eleves') }, '‹ Retour'),
      h('h1', null, nomEleve(e), ' ', e.Statut !== 'Actif' ? badge(e.Statut) : null),
      h('div', { class: 'sub' }, i ? `${volee(i.VoleeID)?.Title} · ${i.Degre} · classe ${i.ClasseOrigine} · titulaire ${i.Titulaire}` : 'Aucune inscription', ' ', i && phaseBadge(phaseInscription(i)))),
    h('div', { class: 'btn-row' },
      btn('Modifier le dossier', () => editEleve(e), 'ghost small'),
      btn('+ Nouvelle inscription', () => nav('inscription', { eleve: e.ID }), 'secondary small')));

  if (!i) return h('div', { class: 'page' }, head, card(null, {}, empty('Cet élève n\'a encore aucune inscription.')));

  const alerteSemaine = S.store.where('RS_Suivis', s => s.InscriptionID === i.ID && s.SemaineCle === sk && (s.Comportement === 1 || s.Travail === 1));
  const nRetenue = S.store.where('RS_Devoirs', d => d.InscriptionID === i.ID && d.SemaineCle === sk && !d.SansConsequence).length;
  const cps = cpsDe([i.ID]);

  const actionsBar = h('div', { class: 'btn-row' },
    btn('+ Nouveau suivi', () => nav('saisie', { eleve: e.ID })),
    i.StatutInscription === 'En cours' && btn('+ Évaluation', () => nav('evaluation', { eleve: e.ID }), 'secondary'),
    btn('Bilans', () => nav('bilan', { insc: i.ID }), 'secondary'),
    btn(`CPS${cps.length ? ` (${cps.length})` : ''}`, () => nav('cps', { eleve: e.ID, insc: i.ID }), 'secondary'),
    btn('Orientation', () => nav('orientation', { eleve: e.ID }), 'secondary'),
    btn('Fiche coaching', () => nav('coaching', { insc: i.ID }), 'secondary'),
    i.StatutInscription === 'En cours' && btn('Clore l\'inscription', () => closeInscription(i, e), 'ghost'));

  return h('div', { class: 'page' },
    head,
    inscs.length > 1 && h('div', { class: 'chips', role: 'group', 'aria-label': 'Inscriptions' },
      inscs.map(x => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(x.ID === i.ID), onClick: () => nav('dossier', { eleve: e.ID, insc: x.ID }) },
        volee(x.VoleeID)?.Title, h('span', { class: 'meta' }, `${x.Degre} · ${x.StatutInscription}`)))),
    actionsBar,
    alerteSemaine.length ? notice(`Alerte « désengagé » cette semaine : ${alerteSemaine.map(s => `${cours(s.CoursID)?.Title} (${fmtDate(s.DateSuivi, { day: true, year: false })})`).join(', ')}.`, 'danger') : null,
    nRetenue ? notice(`Retenue du vendredi : ${retenueMinutes(nRetenue)} minutes (${nRetenue} devoir${nRetenue > 1 ? 's' : ''} non fait${nRetenue > 1 ? 's' : ''} cette semaine).`, 'warn') : null,
    syntheseCard(i),
    h('div', { class: 'cols-dossier' },
      h('div', { class: 'stack' }, inscriptionCard(i, e), bilansCard(i), actionsCard(i, e), devoirsCard(i)),
      h('div', { class: 'stack' }, evaluationsCard(i, e), suivisCard(i, e))));
}

export { pastille };
