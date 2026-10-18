import { S, isSandbox, refDate, setDateCourante, voleeAt, volees, inscriptionsEnCours, eleve, nomEleve, cours, moi, isCoord, mesCours, vueRestreinte, saveSettings, nav, labels } from '../state.js';
import { h, card, btn, pastille, phaseBadge, empty, notice, input, ctPair } from '../ui.js';
import { todayISO, semaineCle, phaseOf, daysBetween, fmtDate, fmtDateLong, nextVolee, lastVolee, mondayOf, addDays, weeksOfVolee } from '../domain.js';
import { CONFIG } from '../config.js';
const DATE_EXEMPLE = '2026-06-10'; // mercredi, semaine 4 de la volée d'exemple (ré-exposition)
import { charger, wasLoadedThisSession, dismissLoad } from '../sync.js';
import { retenues, alertes, sansSuivi, devoirsOuverts, aFaire, suivisDeSemaine } from '../queries.js';


export function ramp(v, date) {
  const total = daysBetween(v.DateDebut, v.DateFin) + 1;
  const d1 = daysBetween(v.DateDebut, v.DateDebutRemob);
  const d2 = daysBetween(v.DateDebutRemob, v.DateDebutReexpo);
  const d3 = total - d1 - d2;
  const pos = Math.max(0, Math.min(1, (daysBetween(v.DateDebut, date) + 0.5) / total));
  const inside = date >= v.DateDebut && date <= v.DateFin;
  return h('div', { class: 'ramp-wrap', role: 'img', 'aria-label': `Rampe de la volée ${v.Title} : décompression jusqu'au ${fmtDate(addDays(v.DateDebutRemob, -1))}, remobilisation jusqu'au ${fmtDate(addDays(v.DateDebutReexpo, -1))}, ré-exposition jusqu'au ${fmtDate(v.DateFin)}` },
    inside && h('div', { class: 'ramp-marker', style: { left: `${pos * 100}%` } }, fmtDate(date, { year: false })),
    h('div', { class: 'ramp' },
      h('div', { class: 'p1', style: { flex: d1 } }, 'Décompression'),
      h('div', { class: 'p2', style: { flex: d2 } }, 'Remobilisation'),
      h('div', { class: 'p3', style: { flex: d3 } }, 'Ré-exposition')),
    h('div', { class: 'ramp-dates' }, h('span', null, fmtDate(v.DateDebut)), h('span', null, fmtDate(v.DateFin))));
}

function tile(num, label, { alert = false, onClick } = {}) {
  const t = h(onClick ? 'button' : 'div', { class: `tile ${alert && num > 0 ? 'alert' : ''}`, type: onClick ? 'button' : null, onClick },
    h('div', { class: 'num' }, num), h('div', { class: 'lab' }, label));
  return t;
}

export function render() {
  const date = refDate();
  // Volée d'exemple (élèves fictifs archivés) : permet de voir l'accueil « en vrai » en dehors des volées.
  const exemple = CONFIG.DONNEES_EXEMPLE ? volees().find(v => v.Title === '2025-26 V5') : null;
  const sk = semaineCle(date);
  const v = voleeAt(date);
  const m = moi();
  const restreint = vueRestreinte();
  const mine = mesCours();
  const coursIds = restreint ? mine.map(c => c.ID) : null;
  const inscs = v ? inscriptionsEnCours(v.ID) : [];
  const inscIds = inscs.map(i => i.ID);

  /* ---- En-tête ---- */
  // La date : celle du jour ; un clic dessus permet d'en choisir une autre pour la session.
  const picker = input('date', date, { id: 'acc-date', class: 'date-hidden', tabindex: '-1', 'aria-hidden': 'true',
    onChange: e => { if (e.target.value) { setDateCourante(e.target.value); nav('accueil'); } } });
  const openPicker = () => { try { picker.showPicker(); } catch { picker.focus(); picker.click(); } };
  const isToday = date === todayISO();
  const head = h('div', { class: 'page-head' },
    h('div', null,
      h('h1', null, `Bonjour ${m ? m.Title.split(' ')[0] : ''}`),
      h('div', { class: 'sub date-line' },
        h('button', { type: 'button', class: 'date-btn', onClick: openPicker, title: 'Choisir une autre date' },
          `${fmtDateLong(date)} · semaine ${sk % 100}`, h('span', { 'aria-hidden': 'true', class: 'pen' }, ' ✎')),
        picker,
        !isToday && h('button', { type: 'button', class: 'back', onClick: () => { setDateCourante(null); nav('accueil'); } }, 'revenir à aujourd\'hui'),
        exemple && !(exemple.DateDebut <= date && date <= exemple.DateFin) && h('button', { type: 'button', class: 'back', onClick: () => { setDateCourante(DATE_EXEMPLE); nav('accueil'); } }, 'voir la volée d\'exemple'))),
    h('div', { class: 'btn-row' },
      !isCoord() && mine.length ? btn(S.settings.vueTout ? 'Ma vue' : 'Tout voir', () => { S.settings.vueTout = !S.settings.vueTout; saveSettings(); nav('accueil'); }, 'secondary') : null,
      btn('+ Saisie de groupe', () => nav('groupe'))));

  /* ---- Volée et rampe ---- */
  let voleeBlock;
  if (v) {
    const wk = weeksOfVolee(v).indexOf(mondayOf(date)) + 1;
    voleeBlock = card(h('h2', null, `${v.Title} · semaine ${wk} sur ${weeksOfVolee(v).length}`), { actions: [phaseBadge(phaseOf(date, v))] }, ramp(v, date));
  } else {
    const nv = nextVolee(date, volees());
    const lv = lastVolee(date, volees());
    voleeBlock = card(null, {},
      notice(`Pas de volée à cette date (vacances ou pause).${nv ? ` Prochaine volée : ${nv.Title}, dès le ${fmtDate(nv.DateDebut)}.` : ''}`, 'info'),
      lv && h('div', { class: 'btn-row', style: { marginTop: '10px' } },
        btn(`Afficher la dernière semaine de ${lv.Title}`, () => { setDateCourante(addDays(lv.DateFin, -2)); nav('accueil'); }, 'secondary'),
        exemple && lv.ID !== exemple.ID && btn('Voir la volée d\'exemple (élèves fictifs)', () => { setDateCourante(DATE_EXEMPLE); nav('accueil'); }, 'secondary')));
  }

  /* ---- Tuiles ---- */
  const dv = devoirsOuverts(inscIds, coursIds);
  const sans = restreint
    ? new Set(mine.flatMap(c => sansSuivi(sk, inscs, c.ID).map(i => i.ID))).size
    : sansSuivi(sk, inscs).length;
  const al = alertes(sk, inscIds, coursIds);
  const tiles = [
    tile(inscs.length, 'élèves dans la volée', { onClick: () => nav('eleves') }),
    tile(dv.length, restreint ? 'devoirs ouverts (mes cours)' : 'devoirs ouverts', { alert: false }),
    tile(sans, restreint ? 'sans suivi dans mes cours' : 'sans suivi cette semaine', { alert: true }),
    tile(al.length, 'alertes « désengagé »', { alert: true }),
  ];
  if (isCoord() && v) {
    const suivisCours = new Set(suivisDeSemaine(sk, inscIds).map(s => s.CoursID)).size;
    const total = S.store.all('RS_Cours').length;
    tiles.push(tile(`${suivisCours}/${total}`, 'cours suivis cette semaine'));
  }

  /* ---- Mes cours ---- */
  const mesCoursCard = mine.length
    ? card('Mes cours', { hint: 'Un clic ouvre la saisie de groupe préréglée.' },
      h('div', { class: 'btn-row' }, mine.map(c => btn(c.Title, () => nav(c.EstCoaching ? 'saisie' : 'groupe', { cours: c.ID }), 'secondary'))))
    : null;

  /* ---- Alertes ---- */
  const L = labels();
  const alertCard = card('Alertes « désengagé »', { hint: 'Un niveau 1 en comportement ou en travail cette semaine. Indicateur de tendance, à discuter.' },
    al.length ? h('ul', { class: 'list' }, al.map(a => h('li', null,
      h('button', { type: 'button', class: 'item', onClick: () => nav('dossier', { eleve: a.eleveId }) },
        pastille(1),
        h('div', { class: 'main' },
          h('div', { class: 'title' }, nomEleve(eleve(a.eleveId))),
          h('div', { class: 'meta' }, a.suivis.map(s => `${cours(s.CoursID)?.Title} (${fmtDate(s.DateSuivi, { day: true, year: false })})`).join(' · '))),
        h('div', { class: 'end' }, ctPair(a.suivis[0].Comportement, a.suivis[0].Travail, L)))))) : empty('Aucune alerte cette semaine.'));

  /* ---- Retenue du vendredi ---- */
  const col = v ? retenues(sk, inscIds, coursIds) : [];
  const phaseNow = v ? phaseOf(date, v) : null;
  const retenueCard = card('Retenue du vendredi', { hint: 'Durée = min(60 ; 15 + 5 × (n − 1)) minutes, n = devoirs non faits de la semaine. Pas de retenue en décompression.' },
    phaseNow === 'Décompression' ? notice('Décompression : devoirs enregistrés sans conséquence.', 'info') : null,
    col.length ? h('ul', { class: 'list' }, col.map(c => h('li', null,
      h('button', { type: 'button', class: 'item', onClick: () => nav('dossier', { eleve: c.eleveId }) },
        h('div', { class: 'main' },
          h('div', { class: 'title' }, nomEleve(eleve(c.eleveId))),
          h('div', { class: 'meta' }, `${c.n} devoir${c.n > 1 ? 's' : ''} : ${c.devoirs.map(d => cours(d.CoursID)?.Title).join(', ')}`)),
        h('div', { class: 'end' }, h('strong', null, `${c.minutes} min`)))))) : empty('Pas de retenue cette semaine.'));

  /* ---- À faire ---- */
  const todo = aFaire(date, v, { restreint, coursIds });
  const todoCard = card('À faire', { hint: restreint ? 'Limité à vos cours, à vos actions et à vos tâches.' : null, actions: [btn('Mes tâches', () => nav('taches'), 'secondary small')] },
    todo.length ? h('ul', { class: 'list' }, todo.map(t => h('li', null,
      h('button', { type: 'button', class: `item ${t.late ? 'late' : ''}`, onClick: () => nav(...t.go) },
        h('div', { class: 'main' }, h('div', { class: 'meta' }, t.kind), h('div', { class: 'title' }, t.title), t.meta && h('div', { class: 'meta' }, t.meta)),
        h('span', { 'aria-hidden': 'true', class: 'muted' }, '›'))))) : empty('Rien en attente.'));

  const syncNotice = isSandbox() && S.settings.sansCopie === false && !wasLoadedThisSession()
    ? h('div', { class: 'notice info btn-row', style: { justifyContent: 'space-between' } },
      h('span', null, 'Récupérer les saisies de vos collègues depuis le dossier OneDrive partagé ?'),
      h('span', { class: 'btn-row' },
        btn('Charger les versions', () => charger(), 'small'),
        btn('Plus tard', () => { dismissLoad(); nav('accueil'); }, 'ghost small')))
    : null;

  return h('div', { class: 'page' },
    syncNotice,
    head,
    voleeBlock,
    h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' } }, tiles),
    mesCoursCard,
    h('div', { class: 'cols-dossier' },
      h('div', { class: 'stack' }, alertCard, retenueCard),
      h('div', { class: 'stack' }, todoCard)));
}
