// Bloc « Reste à clôturer » : pas de bilan final ni de CPS de sortie réclamés pour une volée commencée avant l'app.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { S } = await import('../js/state.js');
const { Store } = await import('../js/data/store.js');
const { LocalAdapter } = await import('../js/data/local-adapter.js');
const { aCloturer } = await import('../js/queries.js');

S.store = new Store(new LocalAdapter({ memoryOnly: true }));
await S.store.init();
const vol = t => S.store.all('RS_Volees').find(v => v.Title === t);
const e = await S.store.add('RS_Eleves', { Nom: 'Test', Prenom: 'A', Statut: 'Actif' });
for (const t of ['2026-27 V1', '2026-27 V2']) await S.store.add('RS_Inscriptions', { EleveID: e.ID, VoleeID: vol(t).ID, StatutInscription: 'En cours' });
const insc = t => S.store.all('RS_Inscriptions').find(i => i.VoleeID === vol(t).ID);
await S.store.add('RS_Actions', { EleveID: e.ID, InscriptionID: insc('2026-27 V1').ID, Description: 'x', Statut: 'À faire', Responsable: 'PL' });

test('V1 (avant l\'app) : ni bilan final ni CPS de sortie, l\'action ouverte reste', () => {
  const k = aCloturer(vol('2026-27 V1')).map(x => x.kind);
  assert.ok(!k.includes('Bilan final manquant'));
  assert.ok(!k.includes('CPS de sortie manquant'));
  assert.ok(k.includes('Action ouverte'));
});
test('V2 (suivie dans l\'app) : bilan final et CPS de sortie toujours réclamés', () => {
  const k = aCloturer(vol('2026-27 V2')).map(x => x.kind);
  assert.ok(k.includes('Bilan final manquant'));
  assert.ok(k.includes('CPS de sortie manquant'));
});
