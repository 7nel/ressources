// Alerte du dossier relié : figé (aucune version de collègue depuis 3 jours d'école) ou introuvable (renommé par OneDrive).
// Sans navigateur : dossier OneDrive simulé en mémoire, comme dans sync.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.Node = class Node {};
const faux = () => Object.assign(new Node(), { style: {}, className: '', setAttribute() {}, appendChild() {}, addEventListener() {}, remove() {} });
globalThis.document = { visibilityState: 'visible', addEventListener() {}, querySelector: () => null, createElement: faux, createTextNode: faux, body: faux() };
const w = { matchMedia: () => ({ matches: false }), dispatchEvent() {}, addEventListener() {}, showDirectoryPicker() {} };
w.self = w.top = w;
globalThis.window = w;

function dossier() {
  const fichiers = new Map();
  let disparu = false;
  const fichier = name => ({ kind: 'file', name, getFile: async () => ({ text: async () => fichiers.get(name) }) });
  return {
    fichiers, name: 'appCR', disparaitre() { disparu = true; },
    queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    async *values() {
      if (disparu) { const e = new Error('dossier introuvable'); e.name = 'NotFoundError'; throw e; }
      for (const name of fichiers.keys()) yield fichier(name);
    },
    async getFileHandle(name) {
      return { ...fichier(name), createWritable: async () => { let c = ''; return { write: async t => { c = t; }, close: async () => { fichiers.set(name, c); } }; } };
    },
    async removeEntry(name) { fichiers.delete(name); },
  };
}
const version = (auteur, enregistre) => JSON.stringify({ format: 'RessourceS-version', version: 2, auteur, enregistre, lists: {} });

const { S } = await import('../js/state.js');
const { Store } = await import('../js/data/store.js');
const { LocalAdapter } = await import('../js/data/local-adapter.js');
const sync = await import('../js/sync.js');

S.store = new Store(new LocalAdapter({ memoryOnly: true }));
await S.store.init();
S.settings.moiId = S.store.all('RS_Enseignants').find(e => e.Title === 'PL').ID;

test('jours d\'école : le week-end ne compte pas', () => {
  assert.equal(sync.joursEcoleEntre('2026-11-06', '2026-11-09'), 1); // vendredi → lundi
  assert.equal(sync.joursEcoleEntre('2026-11-02', '2026-11-05'), 3);
  assert.equal(sync.joursEcoleEntre('2026-11-10', '2026-11-10'), 0);
});

test('dossier figé : alerte au 3e jour d\'école sans version de collègue, pas avant', async () => {
  const d = dossier();
  w.showDirectoryPicker = async () => d;
  await sync.chooseFolder();
  d.fichiers.set('RessourceS_CM.json', version('CM', '2026-11-02T08:34:00Z'));
  d.fichiers.set('RessourceS_PL.json', version('PL', '2026-11-11T07:22:00Z')); // sa propre version ne compte pas
  await sync.chargerAuDemarrage();
  assert.equal(sync.alerteDossier({ aujourdhui: '2026-11-04', enVolee: true }), null, '2 jours d\'école : pas encore');
  const al = sync.alerteDossier({ aujourdhui: '2026-11-05', enVolee: true });
  assert.equal(al?.kind, 'fige');
  assert.equal(al.jours, 3);
});

test('dossier figé : rien pendant les vacances (hors volée)', () => {
  assert.equal(sync.alerteDossier({ aujourdhui: '2026-11-20', enVolee: false }), null);
});

test('« Ignorer » masque l\'alerte jusqu\'à la prochaine version reçue', async () => {
  sync.ignorerAlerte();
  assert.equal(sync.alerteDossier({ aujourdhui: '2026-11-20', enVolee: true }), null);
  const d = dossier();
  w.showDirectoryPicker = async () => d;
  await sync.chooseFolder();
  d.fichiers.set('RessourceS_CM.json', version('CM', '2026-11-12T08:00:00Z'));
  await sync.chargerAuDemarrage();
  assert.equal(sync.alerteDossier({ aujourdhui: '2026-11-13', enVolee: true }), null, 'version récente : pas d\'alerte');
  assert.equal(sync.alerteDossier({ aujourdhui: '2026-11-18', enVolee: true })?.kind, 'fige', 'puis figé de nouveau : l\'alerte revient');
});

test('aucun fichier de collègue dans le dossier : alerte', async () => {
  const d = dossier();
  w.showDirectoryPicker = async () => d;
  await sync.chooseFolder();
  d.fichiers.set('RessourceS_PL.json', version('PL', '2026-11-11T07:22:00Z'));
  await sync.chargerAuDemarrage();
  const al = sync.alerteDossier({ aujourdhui: '2026-11-11', enVolee: true });
  assert.equal(al?.kind, 'fige');
  assert.equal(al.derniere, null);
});

test('dossier renommé par OneDrive : alerte « introuvable », levée après avoir relié le bon dossier', async () => {
  const d = dossier();
  w.showDirectoryPicker = async () => d;
  await sync.chooseFolder();
  d.fichiers.set('RessourceS_CM.json', version('CM', '2026-11-10T08:00:00Z'));
  await sync.chargerAuDemarrage();
  d.disparaitre();
  assert.equal(await sync.chargerAuDemarrage(), false);
  assert.equal(sync.alerteDossier({ aujourdhui: '2026-11-11', enVolee: false })?.kind, 'introuvable', 'signalée même hors volée');
  const bon = dossier();
  bon.fichiers.set('RessourceS_CM.json', version('CM', '2026-11-10T08:00:00Z'));
  w.showDirectoryPicker = async () => bon;
  assert.equal(await sync.changerDeDossier(), true);
  assert.equal(sync.alerteDossier({ aujourdhui: '2026-11-11', enVolee: true }), null);
});
