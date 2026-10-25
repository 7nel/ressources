// Tests du rendu conditionnel (sans navigateur) : node --test tests/
// `cond && h(...)` donne null ou false ; replaceChildren les écrirait à l'écran sous forme de texte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { propres } from '../js/ui.js';

test('propres retire null, undefined, false et la chaîne vide', () => {
  assert.deepEqual(propres([null, undefined, false, '', 'a']), ['a']);
});
test('propres garde 0, « 0 », NaN et les textes (ce ne sont pas des rendus conditionnels)', () => {
  const sortie = propres([0, '0', NaN, 'null', 'false', 'true', true]);
  assert.equal(sortie.length, 7);
  assert.equal(sortie[0], 0);
  assert.equal(sortie[1], '0');
  assert.ok(Number.isNaN(sortie[2]));
  assert.deepEqual(sortie.slice(3), ['null', 'false', 'true', true]);
});
test('propres aplatit les listes et applique la même règle aux éléments imbriqués', () => {
  assert.deepEqual(propres([[null, 'a', [false, 0]], 'b']), ['a', 0, 'b']);
});
test('propres ne modifie pas la liste reçue et garde l\'ordre', () => {
  const entree = ['a', null, 'b'];
  assert.deepEqual(propres(entree), ['a', 'b']);
  assert.deepEqual(entree, ['a', null, 'b']);
});
