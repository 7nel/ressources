// Tests de l'enregistrement automatique (sans navigateur, sans dépendance) : node --test tests/
// Un dossier OneDrive est simulé en mémoire ; un « autre appareil » y dépose une version plus récente du même fichier.
// Vérifie que l'écriture automatique relit et fusionne le dossier au lieu d'écraser cette version.
import test from 'node:test';
import assert from 'node:assert/strict';

/* ---------- Navigateur minimal : juste ce que sync.js, ui.js et voisins.js touchent ---------- */
let installee = true;
globalThis.Node = class Node {};
const faux = () => Object.assign(new Node(), { style: {}, className: '', setAttribute() {}, appendChild() {}, addEventListener() {}, remove() {} });
globalThis.document = { visibilityState: 'visible', addEventListener() {}, querySelector: () => null, createElement: faux, createTextNode: faux, body: faux() };
const w = { matchMedia: q => ({ matches: installee && q.includes('standalone') }), dispatchEvent() {}, addEventListener() {}, showDirectoryPicker() {} };
w.self = w.top = w;
globalThis.window = w;

/** Dossier en mémoire, avec l'interface File System Access utilisée par sync.js. */
function dossier() {
  const fichiers = new Map();
  const fichier = name => ({ kind: 'file', name, getFile: async () => ({ text: async () => fichiers.get(name) }) });
  return {
    fichiers,
    name: 'RessourceS – échange',
    queryPermission: async () => 'granted',
    async *values() { for (const name of fichiers.keys()) yield fichier(name); },
    async getFileHandle(name) {
      return { ...fichier(name), createWritable: async () => { let c = ''; return { write: async t => { c = t; }, close: async () => { fichiers.set(name, c); } }; } };
    },
    async removeEntry(name) { fichiers.delete(name); },
  };
}

const { S } = await import('../js/state.js');
const { Store } = await import('../js/data/store.js');
const { LocalAdapter } = await import('../js/data/local-adapter.js');
const sync = await import('../js/sync.js');

const magasin = async () => { const s = new Store(new LocalAdapter({ memoryOnly: true })); await s.init(); return s; };
const eleveDuFichier = (texte, nom) => JSON.parse(texte).lists.RS_Eleves.find(e => e.Nom === nom);

test('l\'enregistrement automatique n\'est possible que dans l\'app installée', () => {
  installee = false;
  assert.equal(sync.autoPossible(), false);
  installee = true;
  assert.equal(sync.autoPossible(), true);
});

test('relit le dossier avant d\'écrire : la version plus récente d\'un autre appareil n\'est pas écrasée', async () => {
  const d = dossier();
  w.showDirectoryPicker = async () => d;
  S.store = await magasin();
  S.settings.moiId = S.store.all('RS_Enseignants')[0].ID;
  await sync.chooseFolder();
  const fichier = sync.myFileName();

  // Appareil A : crée un élève fictif et l'enregistre.
  const x = await S.store.add('RS_Eleves', { Nom: 'Test-X', Prenom: 'Fictif', Remarque: 'version A' });
  await sync.autosave();
  assert.equal(eleveDuFichier(d.fichiers.get(fichier), 'Test-X').Remarque, 'version A');

  // Appareil B (même personne, même fichier) : reprend ce fichier, modifie l'élève plus tard, ajoute un élève, enregistre.
  const b = await magasin();
  await b.mergeJSON(d.fichiers.get(fichier));
  await new Promise(r => setTimeout(r, 5)); // horodatage strictement plus récent
  const xB = b.all('RS_Eleves').find(e => e.UID === x.UID);
  await b.update('RS_Eleves', xB.ID, { Remarque: 'version B' });
  await b.add('RS_Eleves', { Nom: 'Test-B', Prenom: 'Fictif' });
  d.fichiers.set(fichier, JSON.stringify({ format: 'RessourceS-version', version: 2, lists: b.adapter.db.lists }));

  // Appareil A, qui n'a pas rechargé : une autre modification déclenche l'écriture automatique.
  await S.store.add('RS_Eleves', { Nom: 'Test-A', Prenom: 'Fictif' });
  await sync.autosave();

  const final = d.fichiers.get(fichier);
  assert.equal(eleveDuFichier(final, 'Test-X').Remarque, 'version B', 'la modification plus récente de B est gardée');
  assert.ok(eleveDuFichier(final, 'Test-B'), 'l\'ajout de B est gardé');
  assert.ok(eleveDuFichier(final, 'Test-A'), 'l\'ajout de A est écrit');
  assert.equal(sync.syncState().kind, 'saved');
});
