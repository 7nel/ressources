// Démarrage, cadre (menu, bandeau) et routage par adresse (#/ecran?param=…).
import { CONFIG } from './config.js';
import { Store } from './data/store.js';
import { LocalAdapter } from './data/local-adapter.js';
import { SharePointAdapter } from './data/sharepoint-adapter.js';
import { S, loadSettings, saveSettings, isSandbox, refDate, moi, enseignantsActifs, nav, applyTheme } from './state.js';
import { h, icon, btn, field, select, notice, card } from './ui.js';
import { fmtDate } from './domain.js';
import { sauvegarder, charger, chargerAuDemarrage, isDirty, markDirty, getMeta, wasLoadedThisSession, dismissLoad, supportsFolder } from './sync.js';

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

let mainEl, sidebarEl, bannerEl, syncBarEl;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name, q] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(q || ''));
  return { name: ROUTES[name] ? name : 'accueil', params };
}

function renderBanner() {
  bannerEl.hidden = true; return; // bandeau retiré à la demande de l'équipe
  // eslint-disable-next-line no-unreachable
  bannerEl.replaceChildren(
    h('strong', null, 'VERSION DE TEST'),
    h('span', { class: 'banner-long' }, 'Élèves fictifs uniquement : ne saisissez aucun vrai nom d\'élève.'),
    h('span', null, `Date simulée : ${fmtDate(refDate(), { day: true })}`),
    h('button', { type: 'button', onClick: () => nav('parametres') }, 'changer'));
}

function renderSidebar(active) {
  const m = moi();
  if (syncBarEl) syncBarEl.replaceChildren(isSandbox() && S.settings.moiId ? syncBlock(true) : '');
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
    isSandbox() && syncBlock(),
    h('div', { class: 'whoami' }, 'Connecté·e : ', h('strong', { style: { display: 'inline' } }, m ? m.Title : '—')),
  );
}

const hhmm = iso => { const d = new Date(iso); const today = new Date().toDateString() === d.toDateString();
  return `${today ? '' : fmtDate(iso.slice(0, 10), { year: false }) + ' '}${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** Bloc d'échange : dans le menu de gauche (ordinateur) ou en barre compacte en haut (écran étroit). */
function syncBlock(compact = false) {
  const m = getMeta();
  const dirty = isDirty();
  const status = dirty
    ? h('span', { class: 'sync-status warn' }, h('span', { class: 'dot-dirty' }), 'Non sauvegardé')
    : m.lastSave ? h('span', { class: 'sync-status ok' }, '✓ ', `Enregistré ${hhmm(m.lastSave)}`) : h('span', { class: 'sync-status' }, 'Pas encore sauvegardé');
  const save = h('button', { type: 'button', class: `sync-save ${dirty ? 'dirty' : ''}`, onClick: () => sauvegarder(), title: 'Enregistrer ma version dans le dossier partagé' },
    icon('upload'), h('span', null, 'Sauvegarder'));
  const load = h('button', { type: 'button', class: 'sync-load', onClick: () => charger(), title: 'Charger les versions de l\'équipe' },
    icon('download'), h('span', { class: compact ? 'sr-only' : null }, 'Charger'));
  if (compact) return h('div', { class: 'sync-bar' }, status, h('div', { class: 'sync-bar-btns' }, load, save));
  return h('div', { class: 'sync' },
    h('div', { class: 'sync-title' }, 'Échange avec l\'équipe'),
    save, load,
    h('div', { class: 'sync-meta' }, status, m.lastLoad ? h('span', null, `Chargé ${hhmm(m.lastLoad)}`) : null));
}

async function render() {
  const { name, params } = parseHash();
  S.route = { name, params };
  const route = ROUTES[name];
  renderBanner();
  renderSidebar(route.nav === 'saisie' ? 'groupe' : route.nav);
  if (!S.settings.moiId && name !== 'parametres') { mainEl.replaceChildren(welcome()); return; }
  if (isSandbox() && S.settings.sansCopie !== false && !wasLoadedThisSession() && name !== 'parametres') { mainEl.replaceChildren(gate()); return; }
  try {
    const page = await route.mod.render(params);
    mainEl.replaceChildren(page);
  } catch (e) {
    console.error(e);
    mainEl.replaceChildren(h('div', { class: 'page' }, notice(`Erreur d'affichage : ${e.message}`, 'danger')));
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

function welcome() {
  const sel = select([{ value: '', label: 'Choisir…' }, ...enseignantsActifs().map(e => ({ value: e.ID, label: e.Title }))], '');
  return h('div', { class: 'page welcome' },
    card(null, {},
      h('h1', null, 'Bienvenue dans RessourceS'),
      h('p', { class: 'muted', style: { marginTop: '8px' } },
        'Ceci est une version de test. Saisissez uniquement des élèves fictifs.'),
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
  syncBarEl = h('div', { class: 'sync-bar-wrap' });
  root.replaceChildren(bannerEl, syncBarEl, h('div', { class: 'shell' }, sidebarEl, mainEl));
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
  window.addEventListener('rs:sync', () => renderSidebar(ROUTES[S.route.name]?.nav === 'saisie' ? 'groupe' : ROUTES[S.route.name]?.nav));
  if (isSandbox() && S.settings.moiId) await chargerAuDemarrage();
  let first = true;
  window.addEventListener('hashchange', () => { if (!first) S.cameFromApp = true; first = false; render().then(() => { window.scrollTo(0, 0); }); });
  window.addEventListener('rs:refresh', () => render());
  await render();
  first = false;
}

start();
