// Navigation d'un élève à l'autre : ordre alphabétique dans la volée, sans bouclage.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document = { createElement: () => ({ addEventListener() {}, append() {}, setAttribute() {} }) };
const { S } = await import('../js/state.js');
const { voisins } = await import('../js/voisins.js');

const eleves = [{ ID: 1, Nom: 'Zurich', Prenom: 'Ana' }, { ID: 2, Nom: 'Aebi', Prenom: 'Léo' }, { ID: 3, Nom: 'Morel', Prenom: 'Sam' }, { ID: 4, Nom: 'Autre', Prenom: 'Volée' }];
const inscs = [
  { ID: 11, EleveID: 1, VoleeID: 5, StatutInscription: 'En cours' }, { ID: 12, EleveID: 2, VoleeID: 5, StatutInscription: 'En cours' },
  { ID: 13, EleveID: 3, VoleeID: 5, StatutInscription: 'En cours' }, { ID: 14, EleveID: 4, VoleeID: 6, StatutInscription: 'En cours' },
];
S.store = {
  get: (l, id) => (l === 'RS_Eleves' ? eleves : inscs).find(x => x.ID === id),
  where: (l, f) => (l === 'RS_Eleves' ? eleves : inscs).filter(f),
};

test('voisins : ordre alphabétique de la volée', () => {
  const v = voisins(3, 13);
  assert.equal(v.prev.e.ID, 2); assert.equal(v.next.e.ID, 1); assert.equal(v.rang, 2); assert.equal(v.total, 3);
});
test('voisins : pas de bouclage aux extrémités', () => {
  assert.equal(voisins(2, 12).prev, null);
  assert.equal(voisins(1, 11).next, null);
});
test('voisins : sans inscription fournie, prend celle de l\'élève', () => {
  assert.equal(voisins(3, null).total, 3);
});

test('voisins : volée affichée et élève hors de la liste', () => {
  eleves.push({ ID: 5, Nom: 'Ancien', Prenom: 'Max' });
  inscs.push({ ID: 15, EleveID: 5, VoleeID: 5, StatutInscription: 'Interrompue' });
  const v = voisins(5, 15);
  assert.equal(v.horsListe, true); assert.equal(v.prev, null); assert.equal(v.next, null);
});
