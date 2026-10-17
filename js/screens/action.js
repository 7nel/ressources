import { S, nav, back, insc, eleve, nomEleve, refDate, enseignantsActifs, phaseInscription } from '../state.js';
import { h, card, btn, field, select, input, textarea, notice, toast } from '../ui.js';
import { STATUTS_ACTION, addDays } from '../domain.js';
import { bilanDe } from '../queries.js';

const ORIGINE_PAR_PHASE = { 'Décompression': 'Mise en route', 'Remobilisation': 'Bilan intermédiaire', 'Ré-exposition': 'Bilan final' };

export function render(params) {
  const editing = params.id ? S.store.get('RS_Actions', params.id) : null;
  const i = editing ? insc(editing.InscriptionID) : insc(params.insc);
  if (!i) return h('div', { class: 'page' }, notice('Inscription introuvable.', 'danger'));
  const e = eleve(i.EleveID);
  const mr = bilanDe(i.ID, 'Mise en route');
  const it = bilanDe(i.ID, 'Intermédiaire');

  const desc = textarea(editing?.Description || '', { placeholder: 'Ce qui doit être fait, concrètement' });
  const respOpts = ['Élève', 'Titulaire', 'Parents', ...enseignantsActifs().map(x => x.Title)];
  const resp = select(respOpts, editing?.Responsable || 'Élève');
  const ech = input('date', editing?.Echeance || addDays(refDate(), 7));
  const statut = select(STATUTS_ACTION, editing?.Statut || 'À faire');
  const origine = select(['Mise en route', 'Bilan intermédiaire', 'Bilan final', 'Autre'], editing?.Origine || ORIGINE_PAR_PHASE[phaseInscription(i)] || 'Autre');
  const notes = textarea(editing?.NotesSuivi || '', { placeholder: 'Où en est-on ? (faits observables)' });
  const errBox = h('div');

  async function save() {
    if (!desc.value.trim()) { errBox.replaceChildren(notice('Décrivez l\'action.', 'danger')); return; }
    const closed = ['Fait', 'Abandonnée'].includes(statut.value);
    const rec = {
      Title: desc.value.trim().slice(0, 60), EleveID: e.ID, InscriptionID: i.ID, Description: desc.value.trim(),
      Responsable: resp.value, Echeance: ech.value || null, Statut: statut.value, Origine: origine.value, NotesSuivi: notes.value.trim(),
      DateCloture: closed ? (editing?.DateCloture || refDate()) : null,
    };
    if (editing) await S.store.update('RS_Actions', editing.ID, rec);
    else await S.store.add('RS_Actions', rec);
    toast('Action enregistrée');
    nav('dossier', { eleve: e.ID, insc: i.ID });
  }

  return h('div', { class: 'page' },
    h('button', { type: 'button', class: 'back', onClick: () => back('dossier', { eleve: e.ID }) }, '‹ Retour'),
    h('h1', null, `${editing ? 'Action' : 'Nouvelle action'} · ${nomEleve(e)}`),
    (mr?.Objectif || it?.AjustementObjectif) && card('Rappel de l\'objectif', { cls: 'narrow flat' },
      mr?.Objectif && h('p', null, h('strong', null, 'Objectif personnel : '), mr.Objectif),
      it?.AjustementObjectif && h('p', null, h('strong', null, 'Ajustement : '), it.AjustementObjectif)),
    card(null, { cls: 'narrow' }, h('div', { class: 'form' },
      field('Action', desc),
      h('div', { class: 'row' }, field('Responsable', resp), field('Échéance', ech)),
      h('div', { class: 'row' }, field('Statut', statut, { help: 'Une action n\'est pas supprimée : « Abandonnée » la clôt.' }), field('Origine', origine)),
      field('Notes de suivi', notes),
      errBox,
      h('div', { class: 'btn-row' }, btn('Enregistrer', save), btn('Annuler', () => back('dossier', { eleve: e.ID }), 'secondary')))));
}
