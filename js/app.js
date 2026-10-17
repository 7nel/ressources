// Démarrage, cadre (menu, bandeau) et routage par adresse (#/ecran?param=…).
import { CONFIG } from './config.js';
import { Store } from './data/store.js';
import { LocalAdapter } from './data/local-adapter.js';
import { SharePointAdapter } from './data/sharepoint-adapter.js';
import { S, loadSettings, saveSettings, isSandbox, refDate, moi, enseignantsActifs, nav, applyTheme } from './state.js';
import { h, icon, btn, field, select, notice, card } from './ui.js';
import { fmtDate } from './domain.js';

import * as Accueil from './screens/accueil.js';
import * as Eleves from './screens/eleves.js';
import * as Inscription from './screens/inscription.js';
import * as Dossier from './screens/dossier.js';
import * as Saisie from './screens/saisie.js';
import * as SaisieGroupe from './screens/saisie-groupe.js';
import * as Evaluation from './screens/evaluation.js';
import * as Notes from './screens/notes.js';
import * as Branche from './screens/branche.js';
import * as Taches from './screens/taches.js';
import * as Action from './screens/action.js';
import * as Orientation from './screens/orientation.js';
import * as Bilan from './screens/bilan.js';
import * as CPS from './screens/cps.js';
import * as CPSSaisie from './screens/cps-saisie.js';
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
  taches: { mod: Taches, nav: 'taches' },
  action: { mod: Action, nav: 'eleves' },
  orientation: { mod: Orientation, nav: 'eleves' },
  bilan: { mod: Bilan, nav: 'eleves' },
  cps: { mod: CPS, nav: 'eleves' },
  cpssaisie: { mod: CPSSaisie, nav: 'eleves' },
  coaching: { mod: Coaching, nav: 'eleves' },
  parametres: { mod: Parametres, nav: 'parametres' },
};
const MENU = [
  ['accueil', 'Accueil', 'home'], ['eleves', 'Élèves', 'users'], ['groupe', 'Saisie', 'pen'],
  ['notes', 'Notes', 'chart'], ['taches', 'Tâches', 'check'], ['parametres', 'Réglages', 'gear'],
];

let mainEl, sidebarEl, bannerEl;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name, q] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(q || ''));
  return { name: ROUTES[name] ? name : 'accueil', params };
}

function renderBanner() {
  if (!isSandbox()) { bannerEl.hidden = true; return; }
  bannerEl.replaceChildren(
    h('strong', null, 'VERSION DE TEST'),
    h('span', { class: 'banner-long' }, 'Données fictives uniquement : ne saisissez aucun vrai nom d\'élève.'),
    h('span', null, `Date simulée : ${fmtDate(refDate(), { day: true })}`),
    h('button', { type: 'button', onClick: () => nav('parametres') }, 'changer'));
}

function renderSidebar(active) {
  const m = moi();
  sidebarEl.replaceChildren(
    h('div', { class: 'brand' }, 'Ressource', h('span', null, 'S')),
    ...MENU.map(([r, label, ic]) => {
      const isActive = active === r || (r === 'groupe' && active === 'saisie');
      return h('button', {
        type: 'button', class: 'nav-btn', 'aria-current': isActive ? 'page' : null,
        onClick: () => nav(r),
      }, icon(ic), h('span', null, label));
    }),
    h('div', { class: 'spacer' }),
    h('div', { class: 'whoami' }, 'Connecté·e (simulé) :', h('strong', null, m ? m.Title : 'personne')),
  );
}

async function render() {
  const { name, params } = parseHash();
  S.route = { name, params };
  const route = ROUTES[name];
  renderBanner();
  renderSidebar(route.nav === 'saisie' ? 'groupe' : route.nav);
  if (!S.settings.moiId && name !== 'parametres') { mainEl.replaceChildren(welcome()); return; }
  try {
    const page = await route.mod.render(params);
    mainEl.replaceChildren(page);
  } catch (e) {
    console.error(e);
    mainEl.replaceChildren(h('div', { class: 'page' }, notice(`Erreur d'affichage : ${e.message}`, 'danger')));
  }
}

function welcome() {
  const sel = select([{ value: '', label: 'Choisir…' }, ...enseignantsActifs().map(e => ({ value: e.ID, label: e.Title }))], '');
  return h('div', { class: 'page welcome' },
    card(null, {},
      h('h1', null, 'Bienvenue dans RessourceS'),
      h('p', { class: 'muted', style: { marginTop: '8px' } },
        'Ceci est une version de test. Les élèves sont fictifs et vos essais restent dans votre navigateur : personne d\'autre ne les voit.'),
      notice('Ne saisissez aucun vrai nom d\'élève, même pour essayer.', 'warn'),
      h('div', { class: 'form', style: { marginTop: '14px' } },
        field('Vos initiales', sel, { help: 'Ce choix simule la connexion Microsoft : l\'accueil affiche vos cours. Vous pourrez en changer dans Réglages.' }),
        h('div', null, btn('Commencer', () => {
          if (!sel.value) return;
          S.settings.moiId = Number(sel.value); saveSettings(); nav('accueil'); render();
        })))));
}

async function start() {
  const root = document.getElementById('app');
  bannerEl = h('div', { class: 'banner', role: 'note' });
  sidebarEl = h('nav', { class: 'sidebar', 'aria-label': 'Menu principal' });
  mainEl = h('main', { id: 'main', tabindex: '-1' });
  root.replaceChildren(bannerEl, h('div', { class: 'shell' }, sidebarEl, mainEl));
  mainEl.replaceChildren(h('p', { class: 'muted' }, 'Chargement…'));

  loadSettings();
  applyTheme();
  const adapter = CONFIG.MODE === 'sharepoint' ? new SharePointAdapter(CONFIG.sharepoint) : new LocalAdapter();
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
  let first = true;
  window.addEventListener('hashchange', () => { if (!first) S.cameFromApp = true; first = false; render().then(() => { window.scrollTo(0, 0); }); });
  window.addEventListener('rs:refresh', () => render());
  await render();
  first = false;
}

start();
