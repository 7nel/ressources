import { S, isSandbox, refDate, setDateCourante, voleeAt, volees, inscriptionsEnCours, eleve, nomEleve, cours, moi, isCoord, mesCours, vueRestreinte, saveSettings, nav, labels } from '../state.js';
import { h, card, btn, pastille, phaseBadge, empty, notice, input, ctPair } from '../ui.js';
import { todayISO, semaineCle, phaseOf, daysBetween, fmtDate, fmtDateLong, mondayOf, addDays, weeksOfVolee } from '../domain.js';
import { CONFIG } from '../config.js';
const DATE_EXEMPLE = '2026-06-17'; // mercredi de la dernière semaine de la volée d'exemple
import { charger, wasLoadedThisSession, dismissLoad } from '../sync.js';
import { retenues, alertes, progres, sansSuivi, aFaire, suivisDeSemaine, travauxSemaine } from '../queries.js';

const fmt1 = v => v.toFixed(1).replace('.', ',');
const niveau = v => Math.max(1, Math.min(4, Math.round(v)));
const moy = v => h('span', { class: `moy l${niveau(v)}` }, fmt1(v));
/** « C 2,0 → 3,0 » : moyenne hebdomadaire avant et après. */
const hausse = (lettre, [avant, apres]) => h('span', { class: 'ct' },
  h('span', { class: 'k' }, lettre), moy(avant), h('span', { 'aria-hidden': 'true', class: 'muted' }, '→'), h('span', { class: 'sr-only' }, 'vers'), moy(apres));
const NB_PROGRES = 5;
const REGROUPE = {
  'Bilan à faire': n => `${n} bilans à faire`,
  'Sans suivi cette semaine': (n, restreint) => restreint ? `${n} cours avec des élèves sans suivi` : `${n} élèves sans suivi cette semaine`,
  'Devoirs ouverts': n => `${n} élèves avec des devoirs ouverts`,
  'Devoir à contrôler': n => `${n} devoirs à contrôler`,
  'Évaluation à saisir': n => `${n} évaluations à saisir`,
};


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
      mine.map(c => btn(c.Title, () => nav(c.EstCoaching ? 'saisie' : 'groupe', { cours: c.ID }), 'secondary', { title: 'Ouvre la saisie préréglée pour ce cours' })),
      btn('+ Saisie de groupe', () => nav('groupe'))));

  /* ---- Volée et rampe ---- */
  let voleeBlock = null;
  if (v) {
    const wk = weeksOfVolee(v).indexOf(mondayOf(date)) + 1;
    voleeBlock = card(h('h2', null, `${v.Title} · semaine ${wk} sur ${weeksOfVolee(v).length}`), { actions: [phaseBadge(phaseOf(date, v))] }, ramp(v, date));
  }

  /* ---- Tuiles ---- */
  const sans = restreint
    ? new Set(mine.flatMap(c => sansSuivi(sk, inscs, c.ID).map(i => i.ID))).size
    : sansSuivi(sk, inscs).length;
  const al = alertes(sk, inscIds, coursIds);
  const col = v ? retenues(sk, inscIds, coursIds) : [];
  const phaseNow = v ? phaseOf(date, v) : null;
  // Devoirs à rendre et évaluations de la semaine de la rampe (mes cours en vue restreinte).
  const tuileTravaux = () => {
    const tr = travauxSemaine(sk, coursIds);
    const nd = tr.filter(t => t.Type === 'Devoir').length, ne = tr.length - nd;
    const n = weeksOfVolee(v).indexOf(mondayOf(date)) + 1;
    const sem = `${n > 0 ? `S${n} ` : ''}(${phaseNow.toLowerCase()})`;
    return h('button', { type: 'button', class: 'tile tile-duo', title: 'Voir les devoirs et évaluations à venir', onClick: () => nav('travaux') },
      tr.length
        ? h('div', { class: 'duo' },
          h('div', null, h('div', { class: 'num' }, nd), h('div', { class: 'lab' }, nd > 1 ? 'devoirs à rendre' : 'devoir à rendre')),
          h('div', null, h('div', { class: 'num' }, ne), h('div', { class: 'lab' }, ne > 1 ? 'évaluations' : 'évaluation')))
        : h('div', { class: 'num' }, '–'),
      h('div', { class: 'lab' }, tr.length ? `pour la ${sem}` : `Rien de prévu pour la ${sem}`));
  };
  const tiles = [
    // Pas de retenue en décompression : la tuile serait toujours à zéro.
    phaseNow !== 'Décompression' && tile(col.length, col.length > 1 ? 'élèves retenus vendredi' : 'élève retenu vendredi'),
    v && tuileTravaux(),
    tile(sans, restreint ? 'sans suivi dans mes cours' : 'sans suivi cette semaine', { alert: true }),
    tile(al.length, al.length > 1 ? 'élèves au niveau 1 cette semaine' : 'élève au niveau 1 cette semaine', { alert: true }),
  ].filter(Boolean);
  if (isCoord() && v) {
    const suivisCours = new Set(suivisDeSemaine(sk, inscIds).map(s => s.CoursID)).size;
    const total = S.store.all('RS_Cours').length;
    tiles.push(tile(`${suivisCours}/${total}`, 'cours suivis cette semaine'));
  }

  /* ---- Alertes ---- */
  const L = labels();
  const alertCard = card('Niveau 1 cette semaine', { hint: 'Un niveau 1 en comportement ou en travail cette semaine. Indicateur de tendance, à discuter.' },
    al.length ? h('ul', { class: 'list' }, al.map(a => h('li', null,
      h('button', { type: 'button', class: 'item', onClick: () => nav('dossier', { eleve: a.eleveId }) },
        pastille(1),
        h('div', { class: 'main' },
          h('div', { class: 'title' }, nomEleve(eleve(a.eleveId))),
          h('div', { class: 'meta' }, a.suivis.map(s => `${cours(s.CoursID)?.Title} (${fmtDate(s.DateSuivi, { day: true, year: false })})`).join(' · '))),
        h('div', { class: 'end' }, ctPair(a.suivis[0].Comportement, a.suivis[0].Travail, L)))))) : empty('Aucun niveau 1 cette semaine.'));

  /* ---- Ce qui va mieux ---- */
  let progresCard = null;
  if (v) {
    const pr = progres(date, inscs, { coursIds, responsable: restreint ? m?.Title : null });
    const lignes = pr.map(p => h('li', null,
      h('button', { type: 'button', class: 'item', onClick: () => nav('dossier', { eleve: p.eleveId }) },
        h('div', { class: 'main' },
          h('div', { class: 'title' }, nomEleve(eleve(p.eleveId))),
          p.items.map(it => it.type === 'ct'
            ? h('div', { class: 'meta prog' }, `${it.groupe} :`, it.c && hausse('C', it.c), it.t && hausse('T', it.t))
            : h('div', { class: 'meta' }, `Action réalisée : ${it.description}`))))));
    lignes.slice(NB_PROGRES).forEach(li => { li.hidden = true; });
    const toutVoir = lignes.length > NB_PROGRES
      ? btn(`Voir tous (${lignes.length})`, e => { lignes.forEach(li => { li.hidden = false; }); e.currentTarget.remove(); }, 'secondary small')
      : null;
    progresCard = card('Ce qui va mieux', { hint: 'Moyenne hebdomadaire de C ou de T en hausse d\'au moins 0,5 dans une famille de cours, ou action réalisée cette semaine. Indicateur de tendance, à discuter.' },
      lignes.length ? h('ul', { class: 'list' }, lignes) : empty('Rien à signaler cette semaine.'),
      toutVoir);
  }

  /* ---- Retenue du vendredi ---- */
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
  const afItem = (t, imbrique = false) => h('button', { type: 'button', class: `item ${t.late ? 'late' : ''}`, onClick: () => nav(...t.go) },
    h('div', { class: 'main' }, !imbrique && h('div', { class: 'meta' }, t.kind), h('div', { class: 'title' }, t.title), t.meta && h('div', { class: 'meta' }, t.meta)),
    h('span', { 'aria-hidden': 'true', class: 'muted' }, '›'));
  // Les types répétitifs (un élève ou un bilan par ligne) sont regroupés en une ligne qui se déplie.
  const todoRows = [];
  const groupes = new Map();
  for (const t of todo) {
    if (!REGROUPE[t.kind]) { todoRows.push({ t }); continue; }
    if (!groupes.has(t.kind)) { const g = { kind: t.kind, items: [] }; groupes.set(t.kind, g); todoRows.push({ g }); }
    groupes.get(t.kind).items.push(t);
  }
  const todoLis = todoRows.map(r => {
    if (r.t) return h('li', null, afItem(r.t));
    if (r.g.items.length === 1) return h('li', null, afItem(r.g.items[0]));
    const detail = h('div', { class: 'sub-list', hidden: true }, h('ul', { class: 'list' }, r.g.items.map(t => h('li', null, afItem(t, true)))));
    const fleche = h('span', { 'aria-hidden': 'true', class: 'muted' }, '›');
    const entete = h('button', { type: 'button', class: 'item', 'aria-expanded': 'false', onClick: e => {
      const ouvre = detail.hidden;
      detail.hidden = !ouvre;
      e.currentTarget.setAttribute('aria-expanded', String(ouvre));
      fleche.style.transform = ouvre ? 'rotate(90deg)' : '';
    } }, h('div', { class: 'main' }, h('div', { class: 'title' }, REGROUPE[r.g.kind](r.g.items.length, restreint))), fleche);
    return h('li', null, entete, detail);
  });
  const todoCard = card('À faire', { hint: restreint ? 'Limité à vos cours, à vos actions et à vos tâches.' : null, actions: [btn('Mes tâches', () => nav('taches'), 'secondary small')] },
    todoLis.length ? h('ul', { class: 'list' }, todoLis) : empty('Rien en attente.'));

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
    // Hors volée : ni tuiles à zéro ni cartes vides, seulement les tâches à faire.
    v && h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' } }, tiles),
    v
      ? h('div', { class: 'cols-dossier' },
        h('div', { class: 'stack' }, progresCard, alertCard, retenueCard),
        h('div', { class: 'stack' }, todoCard))
      : todoCard);
}
