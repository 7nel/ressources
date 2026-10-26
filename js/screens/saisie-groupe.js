import { S, nav, eleve, cours, refDate, moi, mesCours, coursActifs, voleeAt, inscriptionsEnCours, nomEleve, labels } from '../state.js';
import { h, card, btn, field, select, input, textarea, seg, levelPicker, levelLegend, phaseBadge, notice, toast, checkbox, empty, redraw } from '../ui.js';
import { phaseOf, semaineCle, sortBy, fmtDate, parseNote, evalMode, FORMATIF } from '../domain.js';

const state = { coursId: null, date: null, forDate: null, portee: 'Séance', mode: 'cot' };

export function render(params) {
  const mine = mesCours();
  if (params.cours) state.coursId = Number(params.cours);
  if (!state.coursId) state.coursId = mine.find(c => !c.EstCoaching)?.ID || mine[0]?.ID || null;
  if (params.mode) state.mode = params.mode === 'eval' ? 'eval' : 'cot';
  const ref = refDate();
  if (state.forDate !== ref) { state.date = ref; state.forDate = ref; }

  // Ouverture depuis « À faire » : contrôle d'un devoir à rendre ou saisie d'une évaluation prévue.
  const travail = params.travail ? S.store.get('RS_Travaux', params.travail) : null;
  if (travail) {
    state.coursId = travail.CoursID;
    state.mode = travail.Type === 'Évaluation' ? 'eval' : 'cot';
    if (travail.Type === 'Évaluation') { state.date = travail.Echeance; state.forDate = ref; }
  }
  const travailOuvert = () => { const t = travail && S.store.get('RS_Travaux', travail.ID); return t?.Statut === 'Prévu' ? t : null; };
  const changeStatut = async statut => { if (travailOuvert()) await S.store.update('RS_Travaux', travail.ID, { Statut: statut }); };

  const root = h('div', { class: 'page' });
  let rows = {}; // eleveId → saisie en cours
  const common = { devoir: travail?.Type === 'Devoir' ? travail.Title : '', sujet: travail?.Type === 'Évaluation' ? travail.Title : '', coef: '1' };

  function draw() {
    const L = labels();
    const c = cours(state.coursId);
    const v = voleeAt(state.date);
    const phase = v ? phaseOf(state.date, v) : null;
    const inscs = v ? sortBy(inscriptionsEnCours(v.ID).map(i => ({ i, e: eleve(i.EleveID) })), 'e.Nom') : [];
    inscs.sort((a, b) => a.e.Nom.localeCompare(b.e.Nom, 'fr'));
    const coursOpts = [...mine, ...coursActifs().filter(x => !mine.includes(x))];

    const controls = card(null, {}, h('div', { class: 'form' },
      h('div', { class: 'row' },
        field('Cours', select([{ value: '', label: 'Choisir…' }, ...coursOpts.map(x => ({ value: x.ID, label: x.Title + (mine.includes(x) ? ' (mon cours)' : '') }))], state.coursId || '', {
          onChange: e => { state.coursId = e.target.value ? Number(e.target.value) : null; rows = {}; draw(); },
        })),
        field('Date', input('date', state.date, { onChange: e => { if (e.target.value) { state.date = e.target.value; rows = {}; draw(); } } })),
        state.mode === 'cot' && field('Portée', seg(['Séance', 'Semaine'], state.portee, val => { state.portee = val; draw(); }, 'Portée'))),
      h('div', { class: 'btn-row' },
        seg([{ value: 'cot', label: 'Cotations C/T' }, { value: 'eval', label: 'Évaluation' }], state.mode, val => { state.mode = val; rows = {}; draw(); }, 'Mode'),
        h('span', { class: 'muted small' }, 'Phase :'), phaseBadge(phase), v && h('span', { class: 'muted small' }, v.Title))));

    let body;
    if (!c) body = card(null, {}, empty('Choisissez un cours.'));
    else if (!v) body = card(null, {}, notice('Aucune volée à cette date (vacances ou pause). Changez la date.', 'info'));
    else if (!inscs.length) body = card(null, {}, empty('Aucun élève en cours dans cette volée.'));
    else if (c.EstCoaching && state.mode === 'eval') body = card(null, {}, notice('Le coaching n\'a pas de note.', 'info'));
    else if (c.EstCoaching && state.mode === 'cot') {
      body = card('Coaching : saisie individuelle', { hint: 'Le coaching n\'a ni cotation C/T ni note : seulement un suivi écrit (travaillé, progrès). Il se saisit élève par élève.' },
        h('div', { class: 'btn-row' }, inscs.map(({ e }) => btn(nomEleve(e), () => nav('saisie', { eleve: e.ID, cours: c.ID }), 'secondary'))));
    } else if (state.mode === 'cot') body = cotations(c, v, phase, inscs, L);
    else body = evaluations(c, v, phase, inscs);

    const t0 = travailOuvert();
    const barreTravail = t0 && card(null, {},
      notice(t0.Type === 'Devoir'
        ? `Contrôle du devoir « ${t0.Title} » : cochez « devoir non fait » pour les élèves qui ne l'ont pas rendu.`
        : `Évaluation prévue le ${fmtDate(t0.Echeance, { day: true })} : « ${t0.Title} ». Saisissez les résultats ci-dessous.`, 'info'),
      h('div', { class: 'btn-row', style: { marginTop: '10px' } },
        t0.Type === 'Devoir' && btn('Tout le monde a rendu', async () => { await changeStatut('Contrôlé'); toast('Devoir contrôlé'); nav('accueil'); }, 'secondary'),
        btn('Annuler ce travail', async () => { await changeStatut('Annulé'); toast('Travail annulé'); nav('accueil'); }, 'ghost')));

    redraw(root,
      h('div', { class: 'page-head' },
        h('div', null, h('h1', null, 'Saisie de groupe'), h('div', { class: 'sub' }, `${fmtDate(state.date, { day: true })} · tous les élèves en cours de la volée`)),
        h('div', { class: 'btn-row' },
          btn('+ Devoir ou évaluation à venir', () => nav('travail', { cours: state.coursId }), 'secondary'),
          btn('Saisie individuelle', () => nav('saisie', { cours: state.coursId }), 'secondary'))),
      barreTravail, controls, body);
  }

  function cotations(c, v, phase, inscs, L) {
    const deja = new Set(S.store.where('RS_Suivis', s => s.CoursID === c.ID && s.DateSuivi === state.date).map(s => s.EleveID));
    const errBox = h('div');
    const list = h('div', null, inscs.map(({ i, e }) => {
      const done = deja.has(e.ID);
      const r = rows[e.ID] ||= { c: null, t: null, dv: false };
      return h('div', { class: `grp-row ${done ? 'done' : ''}` },
        h('div', { class: 'who' }, nomEleve(e), h('small', null, done ? 'déjà saisi pour ce cours et cette date' : `${i.Degre} · ${i.ClasseOrigine}`)),
        done ? h('span') : h('div', { class: 'pk' }, h('span', { class: 'lab', title: 'Comportement : respect et ponctualité' }, 'C'), levelPicker(r.c, val => { r.c = val; }, { labels: L, compact: true, name: `Comportement ${e.Prenom}` })),
        done ? h('span') : h('div', { class: 'pk' }, h('span', { class: 'lab', title: 'Travail : matériel et mise au travail' }, 'T'), levelPicker(r.t, val => { r.t = val; }, { labels: L, compact: true, name: `Travail ${e.Prenom}` })),
        done ? h('span') : checkbox('devoir non fait', r.dv, val => { r.dv = val; }));
    }));
    async function save() {
      const todo = inscs.filter(({ e }) => !deja.has(e.ID) && (rows[e.ID]?.c || rows[e.ID]?.t || rows[e.ID]?.dv));
      const incomplete = todo.filter(({ e }) => !rows[e.ID].c || !rows[e.ID].t);
      if (!todo.length) { errBox.replaceChildren(notice('Rien à enregistrer : touchez les pastilles d\'au moins un élève.', 'warn')); return; }
      if (incomplete.length) { errBox.replaceChildren(notice(`C et T sont obligatoires pour : ${incomplete.map(x => x.e.Prenom).join(', ')}.`, 'danger')); return; }
      if (todo.some(({ e }) => rows[e.ID].dv) && !common.devoir.trim()) { errBox.replaceChildren(notice('Indiquez le devoir attendu (commun).', 'danger')); return; }
      const ensId = moi()?.ID ?? c.EnseignantID;
      const sk = semaineCle(state.date);
      for (const { i, e } of todo) {
        const r = rows[e.ID];
        const title = `${e.Prenom} ${e.Nom} · ${c.Title} · ${state.date}`;
        await S.store.add('RS_Suivis', {
          Title: title, EleveID: e.ID, InscriptionID: i.ID, CoursID: c.ID, EnseignantID: ensId,
          DateSuivi: state.date, SemaineCle: sk, Portee: state.portee, Phase: phase,
          Comportement: r.c, Travail: r.t, Observation: '', CoachTravaille: '', CoachProgres: '',
        });
        if (r.dv) {
          await S.store.add('RS_Devoirs', {
            Title: title, EleveID: e.ID, InscriptionID: i.ID, CoursID: c.ID, EnseignantID: ensId,
            DateConstat: state.date, SemaineCle: sk, Phase: phase, SansConsequence: phase === 'Décompression',
            Description: common.devoir.trim(), Statut: 'Ouvert', DateResolution: null,
          });
        }
      }
      if (travail?.Type === 'Devoir' && todo.some(({ e }) => rows[e.ID].dv)) await changeStatut('Contrôlé');
      toast(`${todo.length} suivi${todo.length > 1 ? 's' : ''} enregistré${todo.length > 1 ? 's' : ''}`);
      rows = {};
      draw();
    }
    return card(`Cotations · ${c.Title}`, { hint: 'Touchez une pastille pour coter, touchez-la à nouveau pour annuler. Un élève sans pastille n\'est pas enregistré (absent).' },
      levelLegend(L),
      list,
      h('div', { class: 'form', style: { marginTop: '12px' } },
        field('Devoir attendu (commun aux cases cochées)', input('text', common.devoir, { placeholder: 'ex. Exercices p. 34', onInput: ev => { common.devoir = ev.target.value; } }),
          { help: phase === 'Décompression' ? 'Décompression : devoirs enregistrés sans conséquence.' : 'Les devoirs non faits comptent pour la retenue du vendredi.' }),
        errBox,
        h('div', { class: 'btn-row' }, btn('Enregistrer', save))));
  }

  function evaluations(c, v, phase, inscs) {
    const mode = evalMode(phase);
    const errBox = h('div');
    const list = h('div', null, inscs.map(({ e }) => {
      const r = rows[e.ID] ||= { note: '', etayage: '', formatif: '' };
      if (mode === 'formatif') {
        return h('div', { class: 'grp-row', style: { gridTemplateColumns: 'minmax(140px,1fr) auto' } },
          h('div', { class: 'who' }, nomEleve(e)),
          seg([{ value: '', label: 'absent' }, ...FORMATIF], r.formatif, val => { r.formatif = val; draw(); }, `Résultat ${e.Prenom}`));
      }
      return h('div', { class: 'grp-eval' },
        h('div', { class: 'who' }, nomEleve(e)),
        input('text', r.note, { inputmode: 'decimal', placeholder: 'note', 'aria-label': `Note ${e.Prenom}`, onInput: ev => { r.note = ev.target.value; } }),
        mode === 'etayee' ? h('div', { class: 'et' }, input('text', r.etayage, { placeholder: 'Étayage (aide apportée)', 'aria-label': `Étayage ${e.Prenom}`, onInput: ev => { r.etayage = ev.target.value; } })) : h('span'));
    }));
    async function save() {
      const errs = [];
      if (!common.sujet.trim()) errs.push('Indiquez le sujet de l\'évaluation.');
      const coef = Number(String(common.coef).replace(',', '.'));
      if (!(coef > 0 && coef <= 10)) errs.push('Coefficient invalide.');
      const todo = [];
      for (const { i, e } of inscs) {
        const r = rows[e.ID];
        if (mode === 'formatif') { if (r.formatif) todo.push({ i, e, rec: { ResultatFormatif: r.formatif, Note: null } }); continue; }
        if (!r.note.trim()) continue;
        const n = parseNote(r.note);
        if (Number.isNaN(n)) { errs.push(`Note invalide pour ${e.Prenom} (entre 1 et 6, au dixième).`); continue; }
        todo.push({ i, e, rec: { Note: n, ResultatFormatif: '', Etayage: mode === 'etayee' ? r.etayage.trim() : '' } });
      }
      if (!todo.length && !errs.length) errs.push('Aucun résultat saisi.');
      if (errs.length) { errBox.replaceChildren(notice(errs.join(' '), 'danger')); return; }
      const ensId = moi()?.ID ?? c.EnseignantID;
      for (const { i, e, rec } of todo) {
        await S.store.add('RS_Evaluations', {
          Title: `${e.Prenom} ${e.Nom} · ${c.Title} · ${common.sujet.trim()}`, EleveID: e.ID, InscriptionID: i.ID, CoursID: c.ID,
          EnseignantID: ensId, DateEval: state.date, Phase: phase, Sujet: common.sujet.trim(), Coefficient: coef, Etayage: '', ...rec,
        });
      }
      if (travail?.Type === 'Évaluation') await changeStatut('Contrôlé');
      toast(`${todo.length} résultat${todo.length > 1 ? 's' : ''} enregistré${todo.length > 1 ? 's' : ''}`);
      rows = {}; common.sujet = '';
      draw();
    }
    const hint = {
      formatif: 'Décompression : évaluation formative uniquement (réussi seul / avec aide / pas encore). Aucune note.',
      etayee: 'Remobilisation : note sur une tâche de niveau classe, avec l\'étayage apporté.',
      normale: 'Ré-exposition : note en conditions normales.',
    }[mode];
    return card(`Évaluation · ${c.Title}`, { hint },
      h('div', { class: 'form', style: { marginBottom: '8px' } },
        h('div', { class: 'row' },
          field('Sujet', input('text', common.sujet, { placeholder: 'ex. Fractions', onInput: ev => { common.sujet = ev.target.value; } })),
          mode !== 'formatif' && field('Coefficient', input('text', common.coef, { inputmode: 'decimal', style: 'max-width:120px', onInput: ev => { common.coef = ev.target.value; } })))),
      mode !== 'formatif' && h('p', { class: 'hint' }, 'Notes de 1 à 6 au dixième (4,5 ou 4.5). Case vide = absent, rien n\'est enregistré.'),
      list,
      errBox,
      h('div', { class: 'btn-row', style: { marginTop: '12px' } }, btn('Enregistrer', save)));
  }

  draw();
  void textarea;
  return root;
}
