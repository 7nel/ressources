import { S, nav, back, eleve, insc, nomEleve, refDate } from '../state.js';
import { h, card, btn, field, select, input, notice, toast } from '../ui.js';
import { DOMAINES, REGARDS, cpsKey } from '../domain.js';

export function render(params) {
  const e = eleve(params.eleve);
  const i = insc(params.insc);
  if (!e || !i) return h('div', { class: 'page' }, notice('Élève ou inscription introuvable.', 'danger'));
  const date = input('date', refDate());
  const hasEntree = S.store.where('RS_CPS', c => c.InscriptionID === i.ID && c.Moment === 'Entrée').length > 0;
  const moment = select(['Entrée', 'Sortie', 'Autre'], hasEntree ? 'Sortie' : 'Entrée');
  const cells = {};
  const errBox = h('div');

  const grid = h('div', { class: 'scroll-x' }, h('table', { class: 'tbl cps-grid' },
    h('thead', null, h('tr', null, h('th', null, 'Domaine'), REGARDS.map(r => h('th', { class: 'num' }, r.label, h('br'), h('span', { style: { fontWeight: 400 } }, r.key === 'Boussole' ? 'entier 1–4' : '1,00–5,00'))))),
    h('tbody', null, DOMAINES.map((dm, k) => h('tr', null,
      h('th', { scope: 'row' }, dm),
      REGARDS.map(r => {
        const el = input('text', '', { inputmode: 'decimal', 'aria-label': `${dm}, ${r.label}`, onInput: ev => ev.target.classList.remove('invalid') });
        cells[cpsKey(k + 1, r.key)] = { el, r };
        return h('td', { class: 'num' }, el);
      }))))));

  async function save() {
    const errs = [];
    const rec = {};
    let bad = 0;
    for (const [key, { el, r }] of Object.entries(cells)) {
      const raw = el.value.trim();
      if (!raw) { rec[key] = null; continue; }
      const v = Number(raw.replace(',', '.'));
      const ok = Number.isFinite(v) && v >= 1 && v <= r.max && (r.key !== 'Boussole' || Number.isInteger(v));
      if (!ok) { el.classList.add('invalid'); bad++; } else rec[key] = r.key === 'Boussole' ? v : Math.round(v * 100) / 100;
    }
    if (bad) errs.push(`${bad} valeur${bad > 1 ? 's' : ''} hors échelle (questionnaires 1 à 5, boussole entier 1 à 4).`);
    if (Object.values(rec).every(v => v == null)) errs.push('Saisissez au moins un regard.');
    if (moment.value !== 'Autre' && S.store.all('RS_CPS').some(c => c.InscriptionID === i.ID && c.Moment === moment.value)) errs.push(`Une passation « ${moment.value} » existe déjà pour cette inscription (R12).`);
    if (!date.value) errs.push('Date obligatoire.');
    if (errs.length) { errBox.replaceChildren(notice(errs.join(' '), 'danger')); return; }
    const incomplets = REGARDS.filter(r => [1, 2, 3, 4, 5].some(d => rec[cpsKey(d, r.key)] == null)).map(r => r.label);
    const created = await S.store.add('RS_CPS', { Title: `${nomEleve(e)} – ${moment.value}`, EleveID: e.ID, InscriptionID: i.ID, DatePassation: date.value, Moment: moment.value, ...rec });
    toast(incomplets.length ? `Passation enregistrée (incomplet : ${incomplets.join(', ')})` : 'Passation enregistrée');
    nav('cps', { eleve: e.ID, id: created.ID });
  }

  return h('div', { class: 'page' },
    h('button', { type: 'button', class: 'back', onClick: () => back('cps', { eleve: e.ID }) }, '‹ Retour'),
    h('h1', null, `Nouvelle passation CPS · ${nomEleve(e)}`),
    card(null, {}, h('div', { class: 'form' },
      h('div', { class: 'row' }, field('Date de passation', date), field('Moment', moment)),
      h('p', { class: 'hint' }, 'Pour la boussole, ou un questionnaire rempli sur papier : reportez les scores par domaine calculés dans le classeur Excel (items inversés déjà traités). Les questionnaires Forms s\'intègrent depuis « Réponses Forms ». Un regard laissé vide ne sera pas tracé.'),
      grid,
      errBox,
      h('div', { class: 'btn-row' }, btn('Enregistrer', save), btn('Annuler', () => back('cps', { eleve: e.ID }), 'secondary')))));
}
