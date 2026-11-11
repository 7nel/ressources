// Démarrage, cadre (menu, bandeau) et routage par adresse (#/ecran?param=…).
import { CONFIG } from './config.js';
import { Store } from './data/store.js';
import { LocalAdapter } from './data/local-adapter.js';
import { SharePointAdapter } from './data/sharepoint-adapter.js';
import { S, loadSettings, saveSettings, isSandbox, moi, enseignantsActifs, nav, applyTheme, isCoord, voleeAt } from './state.js';
import { h, icon, btn, field, select, notice, card, modal, memoriserFocus, toast } from './ui.js';
import { fmtDate, todayISO } from './domain.js';
import { sauvegarder, charger, chargerAuDemarrage, isDirty, markDirty, getMeta, syncState, wasLoadedThisSession, dismissLoad, supportsFolder, autoPossible, alerteDossier, ignorerAlerte, changerDeDossier, SEUIL_JOURS_ECOLE } from './sync.js';

import * as Accueil from './screens/accueil.js';
import * as Eleves from './screens/eleves.js';
import * as Inscription from './screens/inscription.js';
import * as Dossier from './screens/dossier.js';
import * as Saisie from './screens/saisie.js';
import * as SaisieGroupe from './screens/saisie-groupe.js';
import * as Evaluation from './screens/evaluation.js';
import * as Notes from './screens/notes.js';
import * as Branche from './screens/branche.js';
import * as Organisation from './screens/organisation.js';
import * as Travail from './screens/travail.js';
import * as Action from './screens/action.js';
import * as Orientation from './screens/orientation.js';
import * as Bilan from './screens/bilan.js';
import * as BilanCR from './screens/bilan-cr.js';
import * as Suivi from './screens/suivi.js';
import * as CPS from './screens/cps.js';
import * as CPSSaisie from './screens/cps-saisie.js';
import * as CPSForms from './screens/cps-forms.js';
import * as CPSQr from './screens/cps-qr.js';
import * as CPSFiche from './screens/cps-fiche.js';
import * as Parametres from './screens/parametres.js';
import * as Coaching from './screens/fiche-coaching.js';

const ROUTES = {
  accueil: { mod: Accueil, nav: 'accueil' },
  eleves: { mod: Eleves, nav: 'eleves' },
  inscription: { mod: Inscription, nav: 'eleves' },
  dossier: { mod: Dossier, nav: 'eleves' },
  saisie: { mod: Saisie, nav: 'saisie' },
  groupe: { mod: SaisieGroupe, nav: 'saisie' },
  evaluation: { mod: Evaluation, nav: 'saisie' },
  notes: { mod: Notes, nav: 'notes' },
  branche: { mod: Branche, nav: 'notes' },
  organisation: { mod: Organisation, nav: 'organisation' },
  // anciennes adresses (favoris) : ouvrent l'onglet correspondant d'Organisation
  taches: { mod: { render: p => Organisation.render({ onglet: 'moi', ...p }) }, nav: 'organisation' },
  travaux: { mod: { render: p => Organisation.render({ onglet: 'cours', ...p }) }, nav: 'organisation' },
  travail: { mod: Travail, nav: 'organisation' },
  action: { mod: Action, nav: 'eleves' },
  orientation: { mod: Orientation, nav: 'eleves' },
  bilan: { mod: Bilan, nav: 'eleves' },
  suivi: { mod: Suivi, nav: 'suivi' },
  bilancr: { mod: BilanCR, nav: 'eleves' }, // plus dans le menu ; bouton « Bilan CR » sur la page Élèves (coordination)
  cps: { mod: CPS, nav: 'eleves' },
  cpssaisie: { mod: CPSSaisie, nav: 'eleves' },
  cpsforms: { mod: CPSForms, nav: 'eleves' },
  cpsqr: { mod: CPSQr, nav: 'eleves' },
  cpsfiche: { mod: CPSFiche, nav: 'eleves' },
  coaching: { mod: Coaching, nav: 'eleves' },
  parametres: { mod: Parametres, nav: 'parametres' }, // plus dans le menu ; accessible par #/parametres (coordination)
  profil: { mod: { render: () => welcome(true) }, nav: 'profil' },
};
const MENU = [
  ['accueil', 'Accueil', 'home'], ['eleves', 'Élèves', 'users'], ['groupe', 'Saisie', 'pen'],
  ['notes', 'Notes', 'chart'], ['suivi', 'Suivi', 'trend'], ['organisation', 'Organisation', 'check'],
];

let mainEl, sidebarEl, bannerEl, syncBarEl;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name, q] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(q || ''));
  return { name: ROUTES[name] ? name : 'accueil', params };
}

/** Le bandeau ne sert plus qu'à l'alerte du dossier relié (figé ou introuvable). */
function renderBanner() {
  const aujourdhui = todayISO();
  const al = S.store ? alerteDossier({ aujourdhui, enVolee: Boolean(voleeAt(aujourdhui)) }) : null;
  if (!al) { bannerEl.hidden = true; bannerEl.className = 'banner'; bannerEl.replaceChildren(); return; }
  const prevenir = isCoord() ? null : h('span', null, 'Si vous ne savez pas quoi faire, prévenez PL.');
  const changer = h('button', { type: 'button', onClick: async () => { try { await changerDeDossier(); } catch (e) { toast(`Dossier non relié (${e.message}).`, 'err'); } render(); } }, 'Changer de dossier');
  const texte = al.kind === 'introuvable'
    ? [h('strong', null, 'Dossier partagé introuvable.'), h('span', null, `« ${getMeta().folderName || 'appCR'} » a été renommé, déplacé ou recréé par OneDrive : l'app ne peut plus le lire ni y enregistrer.`)]
    : [h('strong', null, 'Le dossier relié ne reçoit plus les versions des collègues.'),
      h('span', null, al.derniere
        ? `Aucune nouvelle version depuis le ${fmtDate(al.derniere.slice(0, 10), { year: false })} (${al.jours} jours d'école). OneDrive l'a peut-être dupliqué ou déconnecté.`
        : 'Aucune version de collègue dans ce dossier. Ce n\'est peut-être pas le bon dossier.')];
  bannerEl.className = 'banner alerte';
  bannerEl.hidden = false;
  bannerEl.replaceChildren(...[...texte, prevenir, changer,
    al.kind === 'fige' ? h('button', { type: 'button', title: 'Masquer jusqu\'à la prochaine version reçue', onClick: () => { ignorerAlerte(); renderBanner(); } }, 'Ignorer') : null].filter(Boolean));
}

function renderSidebar(active) {
  const m = moi();
  if (syncBarEl) syncBarEl.replaceChildren(isSandbox() && S.settings.moiId ? syncBlock(true) : h('div', { class: 'sync-bar' }, h('span'), themeBtn()));
  sidebarEl.replaceChildren(...[
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark', svg: '<svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="76" fill="var(--accent)"/><g transform="translate(2 -1.5)" fill="none" stroke="var(--accent-ink)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"><path d="M37,119 C36,106 38,92 37,78 C37,74 37,72 37,71"/><path d="M37,95 C39,82 49,73 62,74"/><path d="M119,58 C115,46 101,42 92,47 C81,53 83,66 97,76 C111,86 123,92 116,107 C110,119 92,121 81,110"/></g></svg>' }), h('span', null, 'Ressource', h('span', { class: 's' }, 'S'))),
    ...MENU.map(([r, label, ic]) => {
      const isActive = active === r || (r === 'groupe' && active === 'saisie');
      return h('button', {
        type: 'button', class: 'nav-btn', 'aria-current': isActive ? 'page' : null,
        onClick: () => nav(r),
      }, icon(ic), h('span', null, label));
    }),
    h('div', { class: 'spacer' }),
    isSandbox() && S.settings.moiId && syncBlock(),
    S.settings.moiId && h('div', { class: 'whoami' },
      h('button', { type: 'button', class: 'who-btn', onClick: () => nav('profil'), title: 'Changer de profil' }, icon('user'), h('span', null, m ? m.Title : '—')),
      themeBtn()),
  ].filter(Boolean));
}

const hhmm = iso => { const d = new Date(iso); const today = new Date().toDateString() === d.toDateString();
  return `${today ? '' : fmtDate(iso.slice(0, 10), { year: false }) + ' '}${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** Bloc d'échange : dans le menu de gauche (ordinateur) ou en barre compacte en haut (écran étroit). */
/** Bascule clair / sombre (le seul réglage laissé à l'écran). */
function isDark() {
  const t = S.settings.theme;
  return t === 'dark' || (t !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}
function themeBtn() {
  const dark = isDark();
  return h('button', { type: 'button', class: 'theme-btn', 'aria-label': dark ? 'Passer en mode clair' : 'Passer en mode sombre', title: dark ? 'Mode clair' : 'Mode sombre',
    onClick: () => { S.settings.theme = isDark() ? 'light' : 'dark'; saveSettings(); applyTheme(); render(); } }, icon(dark ? 'sun' : 'moon'));
}

const noteEnregistrement = () => autoPossible()
  ? 'Enregistrement automatique dans le dossier relié (app installée) : le dossier est relu et fusionné avant chaque écriture.'
  : 'Enregistrement dans le dossier : manuel ici (bouton Sauvegarder). Il est automatique dans l\'app installée depuis Chrome ou Edge.';
/** Phrase complète de l'état, avec l'heure et la cause d'un échec. */
function etatComplet(st) {
  return [st.at ? `${st.label} ${hhmm(st.at)}` : st.label, st.detail && st.kind === 'error' ? `Cause : ${st.detail}. Cliquez sur « Sauvegarder » pour réessayer.` : st.detail ? `Cause : ${st.detail}.` : null].filter(Boolean).join('. ').replace(/\.\./g, '.');
}
/** Fenêtre d'aide de la barre étroite : l'explication complète de l'état, accessible au clavier. */
function afficherEtat() {
  const st = syncState();
  const m = getMeta();
  const equipe = Object.entries(m.equipe || {}).sort(([a], [b]) => a.localeCompare(b));
  const ilYa = iso => { const j = Math.round((Date.parse(todayISO()) - Date.parse(iso.slice(0, 10))) / 86400000);
    return j <= 0 ? 'aujourd\'hui' : j === 1 ? 'hier' : `${fmtDate(iso.slice(0, 10), { year: false })} (il y a ${j} jours)`; };
  modal('État de l\'enregistrement', h('div', { class: 'form' },
    h('p', null, etatComplet(st)), h('p', { class: 'hint' }, noteEnregistrement()),
    supportsFolder() && h('p', null, m.folderName ? `Dossier relié : « ${m.folderName} »${m.introuvable ? ' (introuvable)' : ''}.` : 'Aucun dossier relié.'),
    equipe.length
      ? h('div', null, h('p', { class: 'small' }, h('strong', null, 'Dernière version de chacun·e'), ' (au dernier chargement) :'),
        h('ul', { class: 'small', style: { margin: 0, paddingLeft: '20px' } }, equipe.map(([a, d]) => h('li', null, `${a} : ${ilYa(d)}`))),
        h('p', { class: 'hint' }, `Si aucune version de collègue ne change pendant ${SEUIL_JOURS_ECOLE} jours d'école, un bandeau vous prévient.`))
      : supportsFolder() && h('p', { class: 'hint' }, 'Les versions des collègues s\'affichent ici après un chargement du dossier.')),
  [{ label: 'Fermer', variant: 'secondary' },
    ...(supportsFolder() ? [{ label: 'Changer de dossier', variant: 'secondary', onClick: async () => { try { await changerDeDossier(); } catch (e) { toast(`Dossier non relié (${e.message}).`, 'err'); } render(); } }] : []),
    { label: 'Sauvegarder', onClick: () => { sauvegarder(); } }]);
}

function syncBlock(compact = false) {
  const m = getMeta();
  const st = syncState();
  const dirty = st.kind === 'dirty' || st.kind === 'error' || st.kind === 'secours'; // bouton Sauvegarder mis en évidence
  const classe = st.kind === 'saved' ? 'ok' : st.kind === 'error' || st.kind === 'secours' ? 'err' : dirty || st.kind === 'download' ? 'warn' : '';
  // Un marqueur de forme (jamais la couleur seule) : ✓ enregistré dans le dossier ; ↓ copie téléchargée (pas dans le dossier) ; point = à faire.
  const marque = st.kind === 'saved' ? '✓ ' : st.kind === 'download' ? '↓ ' : st.kind === 'saving' ? null : h('span', { class: 'dot-dirty' });
  const status = compact
    ? h('button', { type: 'button', class: `sync-status ${classe}`, 'aria-label': etatComplet(st), 'aria-haspopup': 'dialog', onClick: afficherEtat }, marque, st.court)
    : h('span', { class: `sync-status ${classe}` }, marque, etatComplet(st));
  const note = h('span', { class: 'sync-note' }, noteEnregistrement());
  const save = h('button', { type: 'button', class: `sync-save ${dirty ? 'dirty' : ''}`, onClick: () => sauvegarder(), title: 'Enregistrer ma version dans le dossier partagé' },
    icon('upload'), h('span', null, 'Sauvegarder'));
  const load = h('button', { type: 'button', class: 'sync-load', onClick: () => charger(), title: 'Charger les versions de l\'équipe' },
    icon('download'), h('span', { class: compact ? 'sr-only' : null }, 'Charger'));
  if (compact) return h('div', { class: 'sync-bar' }, h('div', { class: 'sync-bar-st' }, status), h('div', { class: 'sync-bar-btns' },
    h('button', { type: 'button', class: 'sync-load', onClick: () => nav('profil'), title: 'Changer de profil' }, h('span', null, moi()?.Title || '—')),
    themeBtn(), load, save));
  return h('div', { class: 'sync' },
    h('div', { class: 'sync-title' }, 'Échange avec l\'équipe'),
    save, load,
    h('div', { class: 'sync-meta' }, status, note, m.lastLoad ? h('span', null, `Chargé ${hhmm(m.lastLoad)}`) : null,
      h('button', { type: 'button', class: 'sync-detail', 'aria-haspopup': 'dialog', onClick: afficherEtat }, 'Dossier et collègues')));
}

/**
 * Annonce aux lecteurs d'écran : deux régions STABLES (créées une fois, hors du menu qui est redessiné à chaque changement),
 * alimentées seulement quand le type d'état change. « Enregistrement… » n'est pas annoncé (le résultat suit aussitôt).
 */
let dernierEtat = null;
function installerAnnonces() {
  const info = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', id: 'annonce-etat' });
  const erreur = h('div', { class: 'sr-only', role: 'alert', 'aria-atomic': 'true', id: 'annonce-erreur' });
  document.body.append(info, erreur);
  dernierEtat = syncState().kind;
  window.addEventListener('rs:sync', () => {
    const st = syncState();
    if (st.kind === dernierEtat) return;
    dernierEtat = st.kind;
    // Pas d'annonce pour « Enregistrement… » (le résultat suit) ni pour « Enregistré » et « Copie téléchargée » : le message
    // affiché à ce moment-là (toast) est déjà lu, et plus complet. Les échecs sont annoncés ici ; leur toast est muet pour les lecteurs d'écran.
    if (['saving', 'saved', 'download'].includes(st.kind)) { info.textContent = ''; erreur.textContent = ''; return; }
    const err = st.kind === 'error' || st.kind === 'secours';
    const zone = err ? erreur : info;
    const texte = err ? `${st.label}${st.detail ? ` : ${st.detail}` : ''}` : st.court;
    zone.textContent = '';
    setTimeout(() => { zone.textContent = texte; }, 60); // vider puis remplir : un même texte est réannoncé s'il revient
  });
}

let dernierHash = null;
/** Affiche un écran, met le titre de la page à jour et, quand l'écran change, place le focus sur son titre (annonce au lecteur d'écran) ; sur un simple rafraîchissement, redonne le focus au contrôle qui l'avait. */
function show(...nodes) {
  const restaurerFocus = dernierHash !== null && location.hash === dernierHash ? memoriserFocus(mainEl) : null; // rafraîchissement du même écran
  mainEl.replaceChildren(...nodes);
  const titre = mainEl.querySelector('h1');
  document.title = titre ? `${titre.textContent} · RessourceS` : 'RessourceS';
  if (dernierHash !== null && location.hash !== dernierHash && titre) { titre.tabIndex = -1; titre.focus({ preventScroll: true }); }
  dernierHash = location.hash;
  restaurerFocus?.();
}

async function render() {
  const { name, params } = parseHash();
  S.route = { name, params };
  const route = ROUTES[name];
  renderBanner();
  renderSidebar(route.nav === 'saisie' ? 'groupe' : route.nav);
  if (!S.settings.moiId && name !== 'parametres') { show(welcome()); return; }
  if (name === 'profil') { show(welcome(true)); return; }
  if (isSandbox() && S.settings.sansCopie !== false && !wasLoadedThisSession() && name !== 'parametres') { show(gate()); return; }
  try {
    const page = await route.mod.render(params);
    show(page);
  } catch (e) {
    console.error(e);
    show(h('div', { class: 'page' }, notice(`Erreur d'affichage : ${e.message}`, 'danger')));
  }
}

/** Sans copie locale, les données viennent du dossier partagé à chaque ouverture. */
function gate() {
  return h('div', { class: 'page welcome' },
    card(null, {},
      h('h1', null, 'Ouvrir les données de l\'équipe'),
      h('p', { class: 'muted', style: { marginTop: '8px' } },
        'Rien n\'est conservé dans ce navigateur : les données sont relues dans le dossier OneDrive partagé à chaque ouverture.'),
      h('p', { class: 'small muted' }, supportsFolder()
        ? 'Première fois : choisissez le dossier partagé. Ensuite, un clic suffit (ou rien, si le navigateur garde l\'autorisation).'
        : h('span', null, 'Sélectionnez ', h('strong', null, 'tous'), ' les fichiers « RessourceS_… » du dossier partagé, pas seulement le vôtre (Ctrl+A ou Cmd+A).')),
      h('div', { class: 'btn-row', style: { marginTop: '12px' } },
        btn('Charger les données', () => charger()),
        btn('Commencer sans charger', () => { dismissLoad(); render(); }, 'ghost'))));
}

function welcome(changer = false) {
  const sel = select([{ value: '', label: 'Choisir…' }, ...enseignantsActifs().map(e => ({ value: e.ID, label: e.Title }))], S.settings.moiId || '');
  const ok = () => {
    if (!sel.value) return;
    S.settings.moiId = Number(sel.value); S.settings.vueTout = false; saveSettings(); nav('accueil'); render();
  };
  return h('div', { class: 'page welcome' },
    card(null, {},
      h('h1', null, changer ? 'Changer de profil' : 'Bienvenue dans RessourceS'),
      h('p', { style: { marginTop: '10px' } }, 'Choisissez vos initiales. L\'application s\'adapte alors à votre travail :'),
      h('ul', { class: 'welcome-list' },
        h('li', null, h('strong', null, 'Accueil'), ' : vos cours, vos alertes et vos retenues, et vos tâches en tête de « À faire ».'),
        h('li', null, h('strong', null, 'Saisie'), ' : la saisie de groupe s\'ouvre directement sur votre cours.'),
        h('li', null, h('strong', null, 'Organisation'), ' : vos tâches, vos actions et les contrôles de vos cours ; les devoirs et évaluations de vos cours.'),
        h('li', null, h('strong', null, 'Suivis et notes'), ' : vos saisies sont enregistrées à vos initiales ; vous pouvez corriger les vôtres pendant 7 jours.'),
        h('li', null, h('strong', null, 'Échange'), ' : votre version est enregistrée dans le dossier partagé sous votre nom (RessourceS_initiales.json).')),
      h('div', { class: 'form', style: { marginTop: '14px' } },
        field('Vos initiales', sel),
        h('div', { class: 'btn-row' }, btn(changer ? 'Valider' : 'Commencer', ok), changer && btn('Annuler', () => nav('accueil'), 'secondary'))),
      h('p', { class: 'hint', style: { marginTop: '12px' } }, 'Vous pourrez changer de profil à tout moment en cliquant sur vos initiales, en bas du menu.')));
}

async function start() {
  const root = document.getElementById('app');
  bannerEl = h('div', { class: 'banner', role: 'status', hidden: true });
  sidebarEl = h('nav', { class: 'sidebar', 'aria-label': 'Menu principal' });
  mainEl = h('main', { id: 'main', tabindex: '-1' });
  syncBarEl = h('div', { class: 'sync-bar-wrap' });
  // Barre mobile collante : sa hauteur réelle (états longs, texte agrandi) sert de marge de défilement, pour que le contenu ne passe pas dessous.
  new ResizeObserver(() => document.documentElement.style.setProperty('--barre-h', `${syncBarEl.offsetHeight}px`)).observe(syncBarEl);
  const skip = h('a', { class: 'skip-link', href: '#main', onClick: e => { e.preventDefault(); mainEl.focus(); } }, 'Aller au contenu');
  root.replaceChildren(skip, bannerEl, syncBarEl, h('div', { class: 'shell' }, sidebarEl, mainEl));
  mainEl.replaceChildren(h('p', { class: 'muted' }, 'Chargement…'));

  loadSettings();
  applyTheme();
  const adapter = CONFIG.MODE === 'sharepoint' ? new SharePointAdapter(CONFIG.sharepoint) : new LocalAdapter({ memoryOnly: S.settings.sansCopie !== false });
  S.store = new Store(adapter);
  try {
    await S.store.init();
  } catch (e) {
    mainEl.replaceChildren(notice(`Impossible de charger les données : ${e.message}`, 'danger'));
    return;
  }
  // Mode SharePoint : la personne connectée est reconnue par son adresse e-mail.
  if (!isSandbox()) {
    const email = (adapter.currentUserEmail?.() || '').toLowerCase();
    const me = S.store.all('RS_Enseignants').find(e => (e.Email || '').toLowerCase() === email);
    S.settings.moiId = me ? me.ID : -1;
  }
  S.store.onWrite = markDirty;
  window.addEventListener('beforeunload', e => { if (isSandbox() && isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  installerAnnonces();
  window.addEventListener('rs:sync', () => renderBanner());
  window.addEventListener('rs:sync', () => renderSidebar(ROUTES[S.route.name]?.nav === 'saisie' ? 'groupe' : ROUTES[S.route.name]?.nav));
  if (isSandbox() && S.settings.moiId) await chargerAuDemarrage();
  let first = true;
  window.addEventListener('hashchange', () => { if (!first) S.cameFromApp = true; first = false; render().then(() => { window.scrollTo(0, 0); }); });
  window.addEventListener('rs:refresh', () => render());
  await render();
  first = false;
}

start();
