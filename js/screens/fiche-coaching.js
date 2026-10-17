// Fiche de suivi coaching : reprend le document papier « Suivi dossier » (bilans + tableau hebdomadaire).
import { S, back, insc, eleve, volee, cours, nomEleve } from '../state.js';
import { h, btn, notice, card } from '../ui.js';
import { weeksOfVolee, semaineCle, phaseOf, fmtDate, addDays, sortBy } from '../domain.js';
import { bilanDe } from '../queries.js';

export function render(params) {
  const i = insc(params.insc);
  if (!i) return h('div', { class: 'page' }, notice('Inscription introuvable.', 'danger'));
  const e = eleve(i.EleveID), v = volee(i.VoleeID);
  const mr = bilanDe(i.ID, 'Mise en route'), it = bilanDe(i.ID, 'Intermédiaire'), fin = bilanDe(i.ID, 'Final');
  const coachingIds = new Set(S.store.where('RS_Cours', c => c.EstCoaching).map(c => c.ID));
  const sv = S.store.where('RS_Suivis', s => s.InscriptionID === i.ID && coachingIds.has(s.CoursID));
  const sig = b => b ? `${fmtDate(b.DateBilan)}${b.DateSignatureEleve ? ` · signé élève ${fmtDate(b.DateSignatureEleve)}` : ''}${b.DateValidationCoord ? ` · validé ${fmtDate(b.DateValidationCoord)}` : ''}` : '';

  const bilans = h('table', { class: 'print-tbl' },
    h('tbody', null,
      h('tr', null, h('th', { rowspan: 2, style: { width: '18%' } }, 'Mise en route'), h('th', { style: { width: '22%' } }, 'Priorités identifiées (boussole)'), h('td', null, mr?.DomainesPrioritaires?.join(' · ') || ''), h('td', { rowspan: 2, style: { width: '20%' } }, sig(mr))),
      h('tr', null, h('th', null, 'Objectif'), h('td', null, mr?.Objectif || '')),
      h('tr', null, h('th', { rowspan: 2 }, 'Bilan intermédiaire'), h('th', null, 'Avancée'), h('td', null, it?.Avancee || ''), h('td', { rowspan: 2 }, sig(it))),
      h('tr', null, h('th', null, 'Ajustement de l\'objectif'), h('td', null, it?.AjustementObjectif || '')),
      h('tr', null, h('th', { rowspan: 2 }, 'Bilan final'), h('th', null, 'Plan de retour'), h('td', null, fin?.PlanRetour || ''), h('td', { rowspan: 2 }, sig(fin))),
      h('tr', null, h('th', null, 'Objectif en intégration'), h('td', null, fin?.ObjectifSortie || ''))));

  const weeks = weeksOfVolee(v);
  const hebdo = h('table', { class: 'print-tbl' },
    h('thead', null, h('tr', null, h('th', null, 'N°'), h('th', null, 'Semaine'), h('th', null, 'Phase'), h('th', null, 'Ce qui a été travaillé / notion ciblée'), h('th', null, 'Progrès · point de vigilance'))),
    h('tbody', null, weeks.map((mon, k) => {
      const sk = semaineCle(mon);
      const list = sortBy(sv.filter(s => s.SemaineCle === sk), 'DateSuivi');
      const ref = mon < v.DateDebut ? v.DateDebut : mon;
      return h('tr', null,
        h('td', null, k + 1),
        h('td', { class: 'nowrap' }, `${fmtDate(mon, { year: false })} – ${fmtDate(addDays(mon, 4), { year: false })}`),
        h('td', null, phaseOf(ref, v)),
        h('td', null, list.map(s => h('div', null, s.CoachTravaille)).filter(x => x.textContent)),
        h('td', null, list.map(s => h('div', null, s.CoachProgres)).filter(x => x.textContent)));
    })));

  return h('div', { class: 'page' },
    h('div', { class: 'btn-row no-print' },
      h('button', { type: 'button', class: 'back', onClick: () => back('dossier', { eleve: e.ID }) }, '‹ Retour au dossier'),
      btn('Imprimer', () => window.print(), 'secondary')),
    h('div', null, h('h1', null, `Coaching · ${nomEleve(e)}`), h('div', { class: 'sub muted' }, `${v.Title} · ${i.Degre} · classe ${i.ClasseOrigine} · titulaire ${i.Titulaire}`)),
    card('Bilans de coordination', {}, h('div', { class: 'scroll-x' }, bilans)),
    card('Suivi hebdomadaire', { hint: `Tiré des suivis du cours ${[...coachingIds].map(id => cours(id)?.Title).join(', ')}.` }, h('div', { class: 'scroll-x' }, hebdo)));
}
