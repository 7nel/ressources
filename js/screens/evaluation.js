import { S, nav, back, eleve, cours, volee, refDate, moi, mesCours, coursActifs, nomEleve, isCoord } from '../state.js';
import { h, card, btn, field, select, input, textarea, seg, phaseBadge, notice, toast } from '../ui.js';
import { phaseOf, sortBy, parseNote, evalMode, FORMATIF, fmtNote } from '../domain.js';
import { inscriptionAt } from './saisie.js';

export function render(params) {
  const editing = params.id ? S.store.get('RS_Evaluations', params.id) : null;
  const mine = mesCours();
  const canEdit = !editing || isCoord() || moi()?.ID === editing.EnseignantID;
  const f = editing ? { ...editing, NoteTxt: editing.Note != null ? fmtNote(editing.Note) : '', CoefTxt: String(editing.Coefficient ?? 1).replace('.', ',') } : {
    EleveID: params.eleve ? Number(params.eleve) : null,
    CoursID: params.cours ? Number(params.cours) : (mine.find(c => !c.EstCoaching)?.ID || null),
    DateEval: refDate(), Sujet: '', NoteTxt: '', CoefTxt: '1', Etayage: '', ResultatFormatif: '',
  };
  const root = h('div', { class: 'page' });

  function draw() {
    const i = f.EleveID ? inscriptionAt(f.EleveID, f.DateEval) : null;
    const v = i && volee(i.VoleeID);
    const phase = v ? phaseOf(f.DateEval, v) : null;
    const mode = evalMode(phase);
    const candidats = sortBy(S.store.all('RS_Inscriptions').filter(x => {
      const vv = volee(x.VoleeID);
      return vv && vv.DateDebut <= f.DateEval && f.DateEval <= vv.DateFin;
    }).map(x => eleve(x.EleveID)).filter(Boolean), 'Nom');
    if (f.EleveID && !candidats.find(e => e.ID === f.EleveID) && eleve(f.EleveID)) candidats.unshift(eleve(f.EleveID));
    const coursOpts = [...mine, ...coursActifs().filter(x => !mine.includes(x))];
    const errBox = h('div');

    async function save() {
      const errs = [];
      if (!f.EleveID) errs.push('Choisissez un élève.');
      if (!f.CoursID) errs.push('Choisissez un cours.');
      if (f.EleveID && !i) errs.push('Date hors de la volée de l\'élève.');
      if (!f.Sujet.trim()) errs.push('Indiquez le sujet.');
      const coef = Number(String(f.CoefTxt).replace(',', '.'));
      if (!(coef > 0 && coef <= 10)) errs.push('Coefficient invalide.');
      let note = null;
      if (mode === 'formatif') { if (!f.ResultatFormatif) errs.push('Choisissez un résultat formatif.'); }
      else {
        note = parseNote(f.NoteTxt);
        if (note == null || Number.isNaN(note)) errs.push('Note invalide : entre 1 et 6, au dixième.');
      }
      if (errs.length) { errBox.replaceChildren(notice(errs.join(' '), 'danger')); return; }
      const e = eleve(f.EleveID), c = cours(f.CoursID);
      const rec = {
        Title: `${e.Prenom} ${e.Nom} · ${c.Title} · ${f.Sujet.trim()}`, EleveID: e.ID, InscriptionID: i.ID, CoursID: c.ID,
        EnseignantID: editing ? editing.EnseignantID : (moi()?.ID ?? c.EnseignantID),
        DateEval: f.DateEval, Phase: phase, Sujet: f.Sujet.trim(), Coefficient: coef,
        ResultatFormatif: mode === 'formatif' ? f.ResultatFormatif : '',
        Note: mode === 'formatif' ? null : note,
        Etayage: mode === 'etayee' ? f.Etayage.trim() : '',
      };
      if (editing) await S.store.update('RS_Evaluations', editing.ID, rec);
      else await S.store.add('RS_Evaluations', rec);
      toast(editing ? 'Évaluation modifiée' : 'Évaluation enregistrée');
      nav('dossier', { eleve: e.ID });
    }

    const hint = {
      formatif: 'Décompression : formatif uniquement. Aucune note : l\'évaluation ne mesurerait que la fragilité (R5).',
      etayee: 'Remobilisation : note sur une tâche de niveau classe, travaillée avec soutien. Indiquez l\'étayage.',
      normale: 'Ré-exposition : note en conditions normales.',
    }[mode];

    root.replaceChildren(
      h('button', { type: 'button', class: 'back', onClick: () => back('accueil') }, '‹ Retour'),
      h('h1', null, editing ? 'Évaluation' : 'Nouvelle évaluation'),
      !canEdit && notice('Lecture seule : seule la personne qui a saisi cette évaluation ou la coordination peut la modifier.', 'info'),
      card(null, { cls: 'narrow' }, h('div', { class: 'form' },
        h('div', { class: 'row' },
          field('Élève', select([{ value: '', label: 'Choisir…' }, ...candidats.map(e => ({ value: e.ID, label: nomEleve(e) }))], f.EleveID || '', { disabled: !!editing, onChange: ev => { f.EleveID = Number(ev.target.value) || null; draw(); } })),
          field('Branche', select([{ value: '', label: 'Choisir…' }, ...coursOpts.map(x => ({ value: x.ID, label: x.Title }))], f.CoursID || '', { disabled: !!editing, onChange: ev => { f.CoursID = Number(ev.target.value) || null; draw(); } }))),
        h('div', { class: 'row' },
          field('Date', input('date', f.DateEval, { onChange: ev => { if (ev.target.value) { f.DateEval = ev.target.value; draw(); } } })),
          field('Sujet', input('text', f.Sujet, { placeholder: 'ex. Fractions', onInput: ev => { f.Sujet = ev.target.value; } }))),
        h('div', { class: 'btn-row' }, h('span', { class: 'muted small' }, 'Phase :'), phaseBadge(phase)),
        phase && notice(hint, 'info'),
        mode === 'formatif'
          ? field('Résultat', seg(FORMATIF, f.ResultatFormatif, val => { f.ResultatFormatif = val; draw(); }, 'Résultat formatif'))
          : h('div', { class: 'row' },
            field('Note (1 à 6, au dixième)', input('text', f.NoteTxt, { inputmode: 'decimal', placeholder: 'ex. 4,5', onInput: ev => { f.NoteTxt = ev.target.value; } })),
            field('Coefficient', input('text', f.CoefTxt, { inputmode: 'decimal', onInput: ev => { f.CoefTxt = ev.target.value; } }))),
        mode === 'etayee' && field('Étayage (aide apportée)', textarea(f.Etayage, { onInput: ev => { f.Etayage = ev.target.value; } })),
        h('p', { class: 'hint' }, 'Les notes sont calibrées sur le niveau de la classe d\'origine. Une note sous 4 est un signal, pas un résultat à maquiller.'),
        errBox,
        canEdit && h('div', { class: 'btn-row' }, btn('Enregistrer', save), btn('Annuler', () => back('accueil'), 'secondary')))));
  }
  draw();
  return root;
}
