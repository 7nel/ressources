import { S, nav, back, refDate, moi, mesCours, coursActifs } from '../state.js';
import { h, card, btn, field, select, input, seg, notice, toast } from '../ui.js';
import { addDays, semaineCle } from '../domain.js';

const TYPES = [{ value: 'Devoir', label: 'Devoir à rendre' }, { value: 'Évaluation', label: 'Évaluation' }];

export function render(params) {
  const editing = params.id ? S.store.get('RS_Travaux', params.id) : null;
  const mine = mesCours();
  const f = editing ? { ...editing } : {
    Type: params.type === 'Évaluation' ? 'Évaluation' : 'Devoir',
    CoursID: params.cours ? Number(params.cours) : (mine.find(c => !c.EstCoaching)?.ID || null),
    Title: '', Echeance: addDays(refDate(), 7),
  };
  const coursOpts = [...mine, ...coursActifs().filter(x => !mine.includes(x))].filter(x => !x.EstCoaching); // le coaching n'a ni devoir ni note
  const root = h('div', { class: 'page' });

  function draw() {
    const devoir = f.Type === 'Devoir';
    const errBox = h('div');

    async function save() {
      const c = coursOpts.find(x => x.ID === f.CoursID);
      const errs = [];
      if (!c) errs.push('Choisissez un cours.');
      if (!f.Title.trim()) errs.push(devoir ? 'Indiquez le devoir attendu.' : 'Indiquez le sujet.');
      if (!f.Echeance) errs.push('Indiquez la date.');
      if (errs.length) { errBox.replaceChildren(notice(errs.join(' '), 'danger')); return; }
      const rec = {
        Title: f.Title.trim(), Type: f.Type, CoursID: c.ID, EnseignantID: editing?.EnseignantID ?? moi()?.ID ?? c.EnseignantID,
        Echeance: f.Echeance, SemaineCle: semaineCle(f.Echeance), Statut: editing?.Statut || 'Prévu',
      };
      if (editing) await S.store.update('RS_Travaux', editing.ID, rec);
      else await S.store.add('RS_Travaux', rec);
      toast(devoir ? 'Devoir enregistré' : 'Évaluation enregistrée');
      nav('travaux');
    }

    async function annuler() {
      await S.store.update('RS_Travaux', editing.ID, { Statut: 'Annulé' });
      toast('Travail annulé');
      nav('travaux');
    }

    root.replaceChildren(
      h('button', { type: 'button', class: 'back', onClick: () => back('travaux') }, '‹ Retour'),
      h('h1', null, editing ? (devoir ? 'Devoir à rendre' : 'Évaluation') : (devoir ? 'Nouveau devoir à rendre' : 'Nouvelle évaluation')),
      editing && editing.Statut !== 'Prévu' && notice(`Ce travail est « ${editing.Statut.toLowerCase()} ».`, 'info'),
      card(null, { cls: 'narrow' }, h('div', { class: 'form' },
        field('Type', seg(TYPES, f.Type, val => { f.Type = val; draw(); }, 'Type')),
        field('Cours', select([{ value: '', label: 'Choisir…' }, ...coursOpts.map(x => ({ value: x.ID, label: x.Title + (mine.includes(x) ? ' (mon cours)' : '') }))], f.CoursID || '', {
          onChange: e => { f.CoursID = e.target.value ? Number(e.target.value) : null; },
        })),
        field(devoir ? 'Devoir attendu' : 'Sujet', input('text', f.Title, { placeholder: devoir ? 'ex. Exercices p. 34' : 'ex. Fractions', onInput: e => { f.Title = e.target.value; } })),
        field(devoir ? 'À rendre le' : 'Date de l\'évaluation', input('date', f.Echeance, { onChange: e => { f.Echeance = e.target.value; } }),
          { help: 'Il s\'applique à tous les élèves du cours. Après la date, il apparaît dans « À faire » pour être contrôlé.' }),
        errBox,
        h('div', { class: 'btn-row' },
          btn('Enregistrer', save),
          btn('Annuler', () => back('travaux'), 'secondary'),
          editing?.Statut === 'Prévu' && btn('Annuler ce travail', annuler, 'ghost')))));
  }

  draw();
  return root;
}
