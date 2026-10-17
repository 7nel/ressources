import { S, nav, moi, refDate, enseignantsActifs, nomEleve, eleve, refresh } from '../state.js';
import { h, card, btn, field, select, input, textarea, seg, badge, empty, modal, toast } from '../ui.js';
import { fmtDate, sortBy, STATUTS_TACHE } from '../domain.js';

const state = { filtre: 'mes' };

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
        toast('Tâche enregistrée'); nav('taches');
      },
    },
  ]);
}

export function render(params) {
  const m = moi();
  const today = refDate();
  let list = S.store.all('RS_Taches');
  if (state.filtre === 'mes') list = list.filter(t => t.Statut !== 'Terminée' && t.Responsable === m?.Title);
  else if (state.filtre === 'toutes') list = list.filter(t => t.Statut !== 'Terminée');
  else list = list.filter(t => t.Statut === 'Terminée');
  list = state.filtre === 'terminees' ? sortBy(list, '-DateCloture') : sortBy(list, 'Echeance');

  if (params.id) setTimeout(() => { const t = S.store.get('RS_Taches', params.id); if (t) editTache(t); history.replaceState(null, '', '#/taches'); }, 0);

  const done = async t => { await S.store.update('RS_Taches', t.ID, { Statut: 'Terminée', DateCloture: today }); toast('Tâche terminée'); refresh(); };

  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, 'Tâches'), h('div', { class: 'sub' }, 'Tâches de l\'équipe. Celles de la semaine et en retard apparaissent dans « À faire » de l\'accueil.')),
      btn('+ Nouvelle tâche', () => editTache(null))),
    card(null, {},
      h('div', { style: { marginBottom: '10px' } }, seg([{ value: 'mes', label: 'Mes tâches' }, { value: 'toutes', label: 'Toutes' }, { value: 'terminees', label: 'Terminées' }], state.filtre, v => { state.filtre = v; nav('taches'); }, 'Filtre')),
      list.length ? h('ul', { class: 'list' }, list.map(t => {
        const late = t.Statut !== 'Terminée' && t.Echeance && t.Echeance < today;
        return h('li', null, h('div', { class: `item ${late ? 'late' : ''}` },
          t.Statut !== 'Terminée'
            ? h('button', { type: 'button', class: 'btn secondary small', 'aria-label': `Terminer : ${t.Title}`, title: 'Marquer comme terminée', onClick: () => done(t) }, '✓')
            : h('span', { class: 'badge ok' }, '✓'),
          h('button', { type: 'button', class: 'main', style: { background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', padding: 0 }, onClick: () => editTache(t) },
            h('div', { class: 'title' }, t.Title),
            h('div', { class: 'meta' }, [t.Responsable, t.Echeance && `échéance ${fmtDate(t.Echeance)}${late ? ' (en retard)' : ''}`, t.EleveID && nomEleve(eleve(t.EleveID))].filter(Boolean).join(' · '))),
          h('div', { class: 'end' }, badge(t.Statut, t.Statut === 'Terminée' ? 'ok' : late ? 'danger' : t.Statut === 'En cours' ? 'warn' : 'neutral'))));
      })) : empty(state.filtre === 'mes' ? 'Aucune tâche ouverte à votre nom.' : 'Aucune tâche.')));
}
