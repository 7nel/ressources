import { S, isSandbox, refDate, setDateCourante, voleeAt, volees, inscriptionsEnCours, eleve, nomEleve, cours, moi, isCoord, mesCours, vueRestreinte, saveSettings, nav, labels } from '../state.js';
import { h, card, btn, badge, pastille, phaseBadge, empty, notice, input, ctPair } from '../ui.js';
import { todayISO, semaineCle, phaseOf, daysBetween, fmtDate, fmtDateLong, mondayOf, addDays, weeksOfVolee } from '../domain.js';
import { CONFIG } from '../config.js';
const DATE_EXEMPLE = '2026-06-17'; // mercredi de la dernière semaine de la volée d'exemple
import { charger, wasLoadedThisSession, dismissLoad } from '../sync.js';
import { retenues, alertes, progres, sansSuivi, aFaire, travauxSemaine } from '../queries.js';

const fmt1 = v => v.toFixed(1).replace('.', ',');
const moy = v => h('span', { class: 'moy' }, fmt1(v));
/** « C 2,0 → 3,0 » : moyenne hebdomadaire avant et après. */
const hausse = (lettre, [avant, apres]) => h('span', { class: 'ct' },
  h('span', { class: 'k' }, lettre), moy(avant), h('span', { 'aria-hidden': 'true', class: 'muted' }, '→'), h('span', { class: 'sr-only' }, 'vers'), moy(apres));
const NB_PROGRES = 5;
const SECTIONS = ['Mes tâches', 'Élèves', 'Équipe'];
const sectionDe = kind => kind.startsWith('Ma tâche') ? 0 : kind.startsWith('Tâche de l\'équipe') ? 2 : 1;
const ouverts = new Map(); // groupes de « À faire » dépliés ou repliés par la personne, gardés d'un affichage à l'autre
const REGROUPE = {
  'Bilan à faire': n => `${n} bilans à faire`,
  'Sans suivi cette semaine': (n, restreint) => restreint ? `${n} cours avec des élèves sans suivi` : `${n} élèves sans suivi cette semaine`,
  'Devoirs ouverts': n => `${n} élèves avec des devoirs ouverts`,
  'Devoir à contrôler': n => `${n} devoirs à contrôler`,
  'Évaluation à saisir': n => `${n} évaluations à saisir`,
  'Ma tâche · en retard': n => `Mes tâches en retard (${n})`,
  'Ma tâche': n => `Mes tâches (${n})`,
  'Action en retard': n => `${n} actions en retard`,
  'Tâche de l\'équipe en retard': n => `${n} tâches de l'équipe en retard`,
  'Tâche de l\'équipe': n => `${n} tâches de l'équipe cette semaine`,
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

const pl = (n, un, plusieurs) => n > 1 ? plusieurs : un;

/** Tuile : le chiffre et son mot (« 3 élèves ») centrés en haut, puis la précision en dessous. */
function tile(num, mot, label, { alert = false, onClick } = {}) {
  const t = h(onClick ? 'button' : 'div', { class: `tile ${alert && num > 0 ? 'alert' : ''}`, type: onClick ? 'button' : null, onClick },
    h('div', { class: 'num' }, num, h('span', { class: 'mot' }, mot)), h('div', { class: 'lab' }, label));
  return t;
}

/** Amène une zone de l'accueil à l'écran et y place le focus (pour le clavier et les lecteurs d'écran). */
function vers(el) {
  if (!el) return;
  const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'start' });
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}
/** Mène au premier élément d'un type de « À faire » (ouvre le groupe s'il est replié). */
function versAFaire(kind) {
  const el = document.querySelector(`#carte-afaire [data-kind="${kind}"]`);
  if (!el) return vers(document.getElementById('carte-afaire'));
  if (el.getAttribute('aria-expanded') === 'false') el.click();
  vers(el);
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
          `${fmtDateLong(date)} · semaine ${sk % 100}`),
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
  // Devoirs à rendre et évaluations de la semaine de la rampe : mes cours (si j'en ai) et tous les cours.
  const tuileTravaux = () => {
    const compte = ids => {
      const tr = travauxSemaine(sk, ids);
      const nd = tr.filter(t => t.Type === 'Devoir').length;
      return { nd, ne: tr.length - nd, n: tr.length };
    };
    const mesIds = mine.filter(c => !c.EstCoaching).map(c => c.ID); // le coaching n'a ni devoir ni note
    const tous = compte(null), miens = mesIds.length ? compte(mesIds) : null;
    const n = weeksOfVolee(v).indexOf(mondayOf(date)) + 1;
    const sem = `${n > 0 ? `S${n} ` : ''}(${phaseNow.toLowerCase()})`;
    const ligne = (rang, c) => h('div', { class: 'duo-row' },
      rang && h('span', { class: 'rang' }, rang),
      h('div', { class: 'duo' },
        h('div', { class: 'num' }, c.nd, h('span', { class: 'mot' }, pl(c.nd, 'devoir à rendre', 'devoirs à rendre'))),
        h('div', { class: 'num' }, c.ne, h('span', { class: 'mot' }, pl(c.ne, 'évaluation', 'évaluations')))));
    return h('button', { type: 'button', class: 'tile tile-duo tile-large', title: 'Voir les devoirs et évaluations à venir', onClick: () => nav('travaux') },
      tous.n
        ? [miens && ligne('Mes cours', miens), ligne(miens ? 'Tous les cours' : null, tous)]
        : h('div', { class: 'num' }, '–'),
      h('div', { class: 'lab' }, tous.n ? `pour la ${sem}` : `Rien de prévu pour la ${sem}`));
  };
  // Deux signaux à suivre dans une même tuile : élèves sans suivi et élèves au niveau 1.
  const tuileSuivi = () => {
    const ligne = (n, label, onClick) => h(n > 0 ? 'button' : 'div', { class: `ligne-suivi ${n > 0 ? 'alert' : ''}`, type: n > 0 ? 'button' : null, onClick: n > 0 ? onClick : null },
      h('div', { class: 'num' }, n, h('span', { class: 'mot' }, pl(n, 'élève', 'élèves'))), h('div', { class: 'lab' }, label));
    return h('div', { class: 'tile tile-multi' },
      ligne(sans, restreint ? 'sans suivi dans mes cours' : 'sans suivi cette semaine', () => versAFaire('Sans suivi cette semaine')),
      ligne(al.length, 'au niveau 1 cette semaine', () => vers(document.getElementById('carte-niveau1'))));
  };
  const tiles = [
    // Pas de retenue en décompression : la tuile serait toujours à zéro.
    phaseNow !== 'Décompression' && tile(col.length, pl(col.length, 'élève', 'élèves'), `${pl(col.length, 'retenu', 'retenus')} vendredi`, { onClick: col.length ? () => vers(document.getElementById('carte-retenue')) : null }),
    v && tuileTravaux(),
    tuileSuivi(),
  ].filter(Boolean);

  /* ---- Alertes ---- */
  const L = labels();
  const alertCard = card('Niveau 1 cette semaine', { id: 'carte-niveau1', hint: 'Un niveau 1 en comportement ou en travail cette semaine. Indicateur de tendance, à discuter.' },
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
  const retenueCard = card('Retenue du vendredi', { id: 'carte-retenue', hint: 'Durée = min(60 ; 15 + 5 × (n − 1)) minutes, n = devoirs non faits de la semaine. Pas de retenue en décompression.' },
    phaseNow === 'Décompression' ? notice('Décompression : devoirs enregistrés sans conséquence.', 'info') : null,
    col.length ? h('ul', { class: 'list' }, col.map(c => h('li', null,
      h('button', { type: 'button', class: 'item', onClick: () => nav('dossier', { eleve: c.eleveId }) },
        h('div', { class: 'main' },
          h('div', { class: 'title' }, nomEleve(eleve(c.eleveId))),
          h('div', { class: 'meta' }, `${c.n} devoir${c.n > 1 ? 's' : ''} : ${c.devoirs.map(d => cours(d.CoursID)?.Title).join(', ')}`)),
        h('div', { class: 'end' }, h('strong', null, `${c.minutes} min`)))))) : empty('Pas de retenue cette semaine.'));

  /* ---- À faire ---- */
  const todo = aFaire(date, v, { restreint, coursIds });
  const afItem = (t, imbrique = false) => h('button', { type: 'button', 'data-kind': t.kind, class: `item ${t.late ? 'late' : ''}`, onClick: () => nav(...t.go) },
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
  // Trois sections (mes tâches, élèves, équipe) ; à l'intérieur, l'ordre de priorité reste celui de aFaire().
  const kindDe = r => r.t ? r.t.kind : r.g.kind;
  const parSection = todoRows.map((r, i) => ({ r, i, sec: sectionDe(kindDe(r)) })).sort((a, b) => a.sec - b.sec || a.i - b.i);
  let majBascule = () => {};
  const todoLis = parSection.flatMap(({ r, sec }, k) => {
    const entete = k === 0 || parSection[k - 1].sec !== sec ? [h('li', { class: 'todo-section' }, h('h3', null, SECTIONS[sec]))] : [];
    return [...entete, ligne(r)];
  });
  function ligne(r) {
    if (r.t) return h('li', null, afItem(r.t));
    if (r.g.items.length === 1) return h('li', null, afItem(r.g.items[0]));
    const { kind, items } = r.g;
    const late = !!items[0].late;
    // Ouvert d'office : mes tâches et tout ce qui est en retard ; le reste (volume) reste replié. Le choix de la personne est mémorisé.
    const ouvert = ouverts.has(kind) ? ouverts.get(kind) : late || kind.startsWith('Ma tâche');
    const detailId = `af-${sectionDe(kind)}-${items[0].kind.replace(/\W+/g, '-')}`;
    const detail = h('div', { id: detailId, class: 'sub-list', hidden: !ouvert }, h('ul', { class: 'list' }, items.map(t => h('li', null, afItem(t, true)))));
    const fleche = h('span', { 'aria-hidden': 'true', class: 'muted', style: { transform: ouvert ? 'rotate(-90deg)' : 'rotate(90deg)' } }, '›'); // vers le bas : déplie ; vers le haut : replie ; « › » droit reste réservé aux liens
    const apercu = late ? items.slice(0, 3).map(t => t.title).join(' · ') : '';
    const entete = h('button', { type: 'button', 'data-kind': kind, class: `item ${late ? 'late' : ''}`, 'aria-expanded': String(ouvert), 'aria-controls': detailId, onClick: e => {
      const ouvre = detail.hidden;
      detail.hidden = !ouvre;
      ouverts.set(kind, ouvre);
      e.currentTarget.setAttribute('aria-expanded', String(ouvre));
      fleche.style.transform = ouvre ? 'rotate(-90deg)' : 'rotate(90deg)';
      majBascule();
    } },
    h('div', { class: 'main' }, h('div', { class: 'title' }, REGROUPE[kind](items.length, restreint)), apercu && h('div', { class: 'meta apercu' }, apercu)),
    late && badge('en retard', 'danger'), fleche);
    return h('li', null, entete, detail);
  }
  // « Tout déplier » / « Tout replier » : un seul bouton pour lire toute la journée.
  const entetes = () => [...todoCard.querySelectorAll('button.item[aria-controls]')];
  const basculeTout = h('button', { type: 'button', class: 'btn ghost small' });
  const plie = () => entetes().every(b => b.getAttribute('aria-expanded') === 'true');
  majBascule = () => { basculeTout.textContent = plie() ? 'Tout replier' : 'Tout déplier'; };
  basculeTout.addEventListener('click', () => {
    const ouvre = !plie();
    entetes().forEach(b => { if ((b.getAttribute('aria-expanded') === 'true') !== ouvre) b.click(); });
    majBascule();
  });
  const nbGroupes = parSection.filter(({ r }) => r.g && r.g.items.length > 1).length;
  basculeTout.textContent = 'Tout déplier';
  const todoCard = card('À faire', { id: 'carte-afaire', hint: restreint ? 'Limité à vos cours, à vos actions et à vos tâches.' : null, actions: [nbGroupes > 0 && basculeTout, btn('Mes tâches', () => nav('taches'), 'secondary small')] },
    todoLis.length ? h('ul', { class: 'list' }, todoLis) : empty('Rien en attente.'));
  majBascule();

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
    v && h('div', { class: 'tiles-wrap' }, h('div', { class: `tiles tiles-${tiles.length}` }, tiles)),
    v
      ? h('div', { class: 'cols-dossier' },
        h('div', { class: 'stack' }, progresCard, alertCard, retenueCard),
        h('div', { class: 'stack todo-col' }, todoCard))
      : todoCard);
}
