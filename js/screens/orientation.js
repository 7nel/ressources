import { S, nav, back, eleve, nomEleve, refDate, inscriptionCourante, refresh } from '../state.js';
import { h, card, btn, field, select, input, textarea, badge, empty, modal, toast, notice } from '../ui.js';
import { enteteEleve } from '../voisins.js';
import { fmtDate, sortBy, STATUTS_STAGE, TYPES_DOC, STATUTS_DOC } from '../domain.js';

function editStage(e, s) {
  const metier = input('text', s?.Metier || '');
  const ent = input('text', s?.Entreprise || '', { placeholder: 'Nom seulement, sans coordonnées' });
  const statut = select(STATUTS_STAGE, s?.Statut || 'Demandé');
  const d1 = input('date', s?.DateDebut || ''), d2 = input('date', s?.DateFin || '');
  const retour = textarea(s?.Retour || '', { placeholder: 'Retour de l\'entreprise et de l\'élève (faits)' });
  modal(s ? 'Modifier le stage' : 'Nouveau stage', h('div', { class: 'form' },
    h('div', { class: 'row' }, field('Métier', metier), field('Entreprise', ent)),
    h('div', { class: 'row' }, field('Statut', statut), field('Du', d1), field('Au', d2)),
    field('Retour', retour)), [
    { label: 'Annuler', variant: 'secondary' },
    {
      label: 'Enregistrer', onClick: async () => {
        if (!metier.value.trim()) { toast('Indiquez le métier', 'err'); return false; }
        if (d1.value && d2.value && d2.value < d1.value) { toast('La fin précède le début', 'err'); return false; }
        const rec = {
          Title: `${nomEleve(e)} · ${metier.value.trim()}`, EleveID: e.ID, InscriptionID: s?.InscriptionID ?? inscriptionCourante(e.ID)?.ID ?? null,
          Metier: metier.value.trim(), Entreprise: ent.value.trim(), Statut: statut.value, DateDebut: d1.value || null, DateFin: d2.value || null, Retour: retour.value.trim(),
        };
        if (s) await S.store.update('RS_Stages', s.ID, rec); else await S.store.add('RS_Stages', rec);
        toast('Stage enregistré'); refresh();
      },
    },
  ]);
}

function editDoc(e, d) {
  const type = select(TYPES_DOC, d?.TypeDoc || 'CV');
  const dest = input('text', d?.Destinataire || '', { placeholder: 'ex. entreprise visée (facultatif)' });
  const statut = select(STATUTS_DOC, d?.Statut || 'À faire');
  const rem = textarea(d?.Remarque || '');
  modal(d ? 'Modifier le document' : 'Nouveau document', h('div', { class: 'form' },
    h('div', { class: 'row' }, field('Type', type), field('Statut', statut)),
    field('Destinataire', dest), field('Remarque', rem)), [
    { label: 'Annuler', variant: 'secondary' },
    {
      label: 'Enregistrer', onClick: async () => {
        const rec = { Title: `${nomEleve(e)} · ${type.value}`, EleveID: e.ID, TypeDoc: type.value, Destinataire: dest.value.trim(), Statut: statut.value, DateMaj: refDate(), Remarque: rem.value.trim() };
        if (d) await S.store.update('RS_DocsOrientation', d.ID, rec); else await S.store.add('RS_DocsOrientation', rec);
        toast('Document enregistré'); refresh();
      },
    },
  ]);
}

export function render(params) {
  const e = eleve(params.eleve);
  if (!e) return h('div', { class: 'page' }, notice('Élève introuvable.', 'danger'), btn('Retour à la liste', () => nav('eleves'), 'secondary'));
  const stages = sortBy(S.store.where('RS_Stages', s => s.EleveID === e.ID), '-DateDebut');
  const docs = sortBy(S.store.where('RS_DocsOrientation', d => d.EleveID === e.ID), 'TypeDoc');
  const done = stages.filter(s => s.Statut === 'Effectué').length;
  const kind = s => ({ Effectué: 'ok', Prévu: 'warn', Annulé: 'neutral', Demandé: 'neutral', Terminé: 'ok', 'En cours': 'warn', 'À faire': 'neutral' }[s] || 'neutral');

  return h('div', { class: 'page' },
    enteteEleve({ route: 'orientation', eleveId: e.ID, inscId: inscriptionCourante(e.ID)?.ID, params: x => ({ eleve: x.ID }), retour: { label: '‹ Retour au dossier', onClick: () => back('dossier', { eleve: e.ID }) } }),
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, `Orientation · ${nomEleve(e)}`),
        h('div', { class: 'sub' }, `${stages.length} stage${stages.length > 1 ? 's' : ''} (${done} effectué${done > 1 ? 's' : ''}) · ${docs.filter(d => d.Statut === 'Terminé').length}/${docs.length} documents terminés. Rattaché à l'élève : suit d'une volée à l'autre.`))),
    h('div', { class: 'grid grid-2' },
      card('Stages', { actions: [btn('+ Stage', () => editStage(e, null), 'secondary small')], hint: 'Pas de coordonnées d\'entreprise (minimisation des données).' },
        stages.length ? h('ul', { class: 'list' }, stages.map(s => h('li', null, h('button', { type: 'button', class: 'item', onClick: () => editStage(e, s) },
          h('div', { class: 'main' },
            h('div', { class: 'title' }, s.Metier),
            h('div', { class: 'meta' }, [s.Entreprise, s.DateDebut && `${fmtDate(s.DateDebut, { year: false })}–${fmtDate(s.DateFin)}`].filter(Boolean).join(' · ')),
            s.Retour && h('div', { class: 'small' }, s.Retour)),
          h('div', { class: 'end' }, badge(s.Statut, kind(s.Statut))))))) : empty('Aucun stage.')),
      card('Documents', { actions: [btn('+ Document', () => editDoc(e, null), 'secondary small')] },
        docs.length ? h('ul', { class: 'list' }, docs.map(d => h('li', null, h('button', { type: 'button', class: 'item', onClick: () => editDoc(e, d) },
          h('div', { class: 'main' },
            h('div', { class: 'title' }, d.TypeDoc + (d.Destinataire ? ` · ${d.Destinataire}` : '')),
            h('div', { class: 'meta' }, `mis à jour le ${fmtDate(d.DateMaj)}${d.Remarque ? ' · ' + d.Remarque : ''}`)),
          h('div', { class: 'end' }, badge(d.Statut, kind(d.Statut))))))) : empty('Aucun document.'))));
}
