// Réponses Forms CPS : lecture des 3 classeurs, rapprochement par code, intégration des scores.
import { nav, back, refresh, volee } from '../state.js';
import { h, card, btn, badge, empty, notice, toast, confirmDlg } from '../ui.js';
import { fmtDate, DOMAINES_COURTS } from '../domain.js';
import { supportsFolder } from '../sync.js';
import { SOURCES, source, derniereLecture, lireDossier, lireFichiers, analyser, integrer } from '../cps-forms.js';

const ETATS = {
  nouvelle: { label: 'À intégrer', kind: 'ok' },
  remplace: { label: 'Regard déjà rempli', kind: 'warn' },
  doublon: { label: 'Doublon', kind: 'warn' },
  inconnu: { label: 'Code inconnu', kind: 'danger' },
  incomplete: { label: 'Incomplète', kind: 'danger' },
  integree: { label: 'Intégrée', kind: 'neutral' },
};
const fmt2 = v => v == null ? '—' : Number(v).toFixed(2).replace('.', ',');
let essaiAuto = false;

function choisirFichiers() {
  const inp = h('input', { type: 'file', accept: '.xlsx', multiple: true, style: { display: 'none' } });
  inp.addEventListener('change', async () => { await lireFichiers([...inp.files]); inp.remove(); refresh(); });
  document.body.appendChild(inp);
  inp.click();
}
async function relire() {
  try {
    if (!(await lireDossier(true))) { choisirFichiers(); return; }
    refresh();
  } catch (e) { toast(`Lecture impossible : ${e.message}`, 'err'); }
}

function ligne(r) {
  const st = ETATS[r.etat];
  const v = r.insc && volee(r.insc.VoleeID);
  const actions = [];
  if (['nouvelle', 'remplace', 'doublon'].includes(r.etat)) {
    actions.push(btn(r.etat === 'nouvelle' ? 'Intégrer' : r.etat === 'doublon' ? 'Garder celle-ci' : 'Remplacer', async () => {
      if (r.etat !== 'nouvelle') {
        const txt = r.etat === 'doublon'
          ? `${r.nbDoublons} réponses ${source(r.src).label.toLowerCase()} « ${r.moment} » pour ${r.nom}. Garder celle du ${fmtDate(r.date)} (n° ${r.id}) ? Les autres restent dans le classeur.`
          : `La passation « ${r.moment} » de ${r.nom} a déjà un regard ${source(r.src).label.toLowerCase()}. Le remplacer par cette réponse du ${fmtDate(r.date)} ?`;
        if (!(await confirmDlg('Intégrer la réponse', txt, 'Intégrer'))) return;
      }
      await integrer(r);
      toast(`Réponse ${source(r.src).label.toLowerCase()} intégrée pour ${r.nom}`);
      refresh();
    }, r.etat === 'nouvelle' ? '' : 'secondary'));
  }
  actions.push(btn('Fiche', () => nav('cpsfiche', { src: r.src, id: r.id }), 'ghost'));
  if (r.passation && r.etat === 'integree') actions.push(btn('Voir', () => nav('cps', { eleve: r.insc.EleveID, id: r.passation.ID }), 'ghost'));
  return h('tr', null,
    h('td', null, badge(st.label, st.kind)),
    h('td', null, r.nom || h('span', { class: 'muted' }, '—'), v && h('div', { class: 'small muted' }, v.Title)),
    h('td', null, source(r.src).label),
    h('td', null, r.moment),
    h('td', { class: 'nowrap' }, fmtDate(r.date)),
    h('td', { class: 'mono' }, r.code || '—'),
    h('td', { class: 'num nowrap small' }, [1, 2, 3, 4, 5].map(d => fmt2(r.scores[d])).join(' · ')),
    h('td', null, h('div', { class: 'btn-row' }, actions)));
}

export async function render() {
  const lec = derniereLecture();
  if (!lec.reponses && !essaiAuto) {
    essaiAuto = true;
    try { await lireDossier(false); } catch { /* bouton « Lire » */ }
  }
  const head = h('div', null,
    h('button', { type: 'button', class: 'back', onClick: () => back('eleves') }, '‹ Retour'),
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, 'Réponses Forms CPS'),
        h('div', { class: 'sub' }, 'Questionnaires élève, titulaire et parents. Seuls les 5 scores par regard sont gardés dans le dossier ; les réponses brutes restent dans les classeurs.')),
      h('div', { class: 'btn-row' },
        btn(lec.reponses ? 'Relire les classeurs' : 'Lire les classeurs', relire),
        supportsFolder() && btn('Choisir les fichiers…', choisirFichiers, 'secondary'))));

  if (!lec.reponses) {
    return h('div', { class: 'page' }, head, card(null, {},
      empty(supportsFolder()
        ? 'Les classeurs se lisent dans le dossier d\'échange (sous-dossier « CPS »). Cliquez sur « Lire les classeurs ».'
        : 'Ce navigateur ne peut pas lire le dossier directement : cliquez sur « Lire les classeurs » et sélectionnez CPS_Eleve.xlsx, CPS_Titulaire.xlsx et CPS_Parents.xlsx.')));
  }

  const rows = analyser();
  const attente = rows.filter(r => r.etat !== 'integree');
  const faites = rows.filter(r => r.etat === 'integree');
  const nb = k => rows.filter(r => r.etat === k).length;
  const table = list => h('div', { class: 'scroll-x' }, h('table', { class: 'tbl' },
    h('thead', null, h('tr', null, ['État', 'Élève', 'Source', 'Moment', 'Date', 'Code'].map(t => h('th', null, t)),
      h('th', { class: 'num', title: DOMAINES_COURTS.join(' · ') }, 'Scores D1 · D2 · D3 · D4 · D5'), h('th', null, ''))),
    h('tbody', null, list.map(ligne))));

  return h('div', { class: 'page' },
    head,
    h('p', { class: 'small muted' }, `Lu ${lec.lu.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })} · ${lec.origine} · ${SOURCES.map(s => `${s.label} ${rows.filter(r => r.src === s.key).length}`).join(' · ')}`),
    lec.erreurs.length ? notice(lec.erreurs.join(' '), 'danger') : null,
    card(`En attente (${attente.length})`, {
      hint: attente.length ? [
        nb('nouvelle') && `${nb('nouvelle')} à intégrer`,
        nb('doublon') && `${nb('doublon')} en doublon : gardez-en une par élève, source et moment`,
        nb('remplace') && `${nb('remplace')} pour un regard déjà rempli`,
        nb('inconnu') && `${nb('inconnu')} avec un code inconnu (code modifié par le répondant, ou inscription pas encore chargée)`,
        nb('incomplete') && `${nb('incomplete')} incomplète${nb('incomplete') > 1 ? 's' : ''}`,
      ].filter(Boolean).join(' · ') + '.' : null,
    }, attente.length ? table(attente) : empty('Aucune nouvelle réponse.')),
    faites.length ? card(`Déjà intégrées (${faites.length})`, {}, table(faites)) : null);
}
