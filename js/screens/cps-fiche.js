// Fiche imprimable d'une réponse Forms CPS (30 items), pour le dossier papier.
// Relue dans le classeur à chaque affichage : les réponses brutes ne sont pas gardées dans l'app.
import { back, volee } from '../state.js';
import { h, card, btn, notice } from '../ui.js';
import { DOMAINES, fmtDate } from '../domain.js';
import { source, derniereLecture, lireDossier, reponse, ITEMS, ECHELLE } from '../cps-forms.js';

const fmt2 = v => v == null ? '—' : Number(v).toFixed(2).replace('.', ',');

export async function render(params) {
  if (!derniereLecture().reponses) { try { await lireDossier(false); } catch { /* message ci-dessous */ } }
  const r = reponse(params.src, params.id);
  const retour = h('button', { type: 'button', class: 'back no-print', onClick: () => back('cpsforms') }, '‹ Retour');
  if (!r) return h('div', { class: 'page' }, retour, notice('Réponse introuvable : relisez les classeurs depuis « Réponses Forms CPS ».', 'danger'));
  const s = source(r.src);
  const v = r.insc && volee(r.insc.VoleeID);

  const items = h('table', { class: 'print-tbl cps-fiche-tbl' },
    h('thead', null, h('tr', null, h('th', null, 'N°'), h('th', null, 'Situation'), ECHELLE.map(x => h('th', { class: 'c' }, x)))),
    h('tbody', null, ITEMS.map(it => h('tr', null,
      h('td', null, it.n),
      h('td', null, r.textes[it.n - 1]),
      ECHELLE.map((_, k) => h('td', { class: 'c' }, r.valeurs[it.n - 1] === k + 1 ? '✕' : ''))))));

  const scores = h('table', { class: 'print-tbl' },
    h('thead', null, h('tr', null, h('th', null, 'Domaine'), h('th', { class: 'c' }, 'Score (1–5)'))),
    h('tbody', null, DOMAINES.map((dm, k) => h('tr', null, h('td', null, dm), h('td', { class: 'c' }, fmt2(r.scores[k + 1]))))));

  return h('div', { class: 'page' },
    h('div', { class: 'btn-row no-print' }, retour, btn('Imprimer', () => window.print(), 'secondary')),
    h('div', null,
      h('h1', null, `Questionnaire ${s.label.toLowerCase()} · ${r.nom || 'élève non identifié'}`),
      h('div', { class: 'sub muted' }, [v?.Title, `moment : ${r.moment}`, `rempli le ${fmtDate(r.date)}`, `code ${r.code}`, `réponse n° ${r.id}`].filter(Boolean).join(' · '))),
    card('Réponses', {}, h('div', { class: 'scroll-x' }, items)),
    card('Scores par domaine', { hint: 'Moyenne des 6 items du domaine ; items formulés négativement comptés 6 − x.' }, scores));
}
