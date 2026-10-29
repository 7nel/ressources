// Tests de la suppression (sans navigateur, sans dépendance) : node --test tests/
// Une saisie supprimée ne doit pas revenir quand on fusionne la version d'un·e collègue qui la contient encore.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalAdapter } from '../js/data/local-adapter.js';
import { Store } from '../js/data/store.js';

const neuf = async () => { const a = new LocalAdapter({ memoryOnly: true }); const s = new Store(a); await s.init(); return { a, s }; };
const version = a => JSON.stringify({ format: 'RessourceS-version', version: 2, lists: a.db.lists, supprimes: a.db.supprimes });

test('supprimer retire l\'élément du cache et de la base, et garde son UID', async () => {
  const { a, s } = await neuf();
  const x = await s.add('RS_Suivis', { Title: 'Suivi' });
  await s.remove('RS_Suivis', x.ID);
  assert.equal(s.get('RS_Suivis', x.ID), null);
  assert.equal(a.db.lists.RS_Suivis.length, 0);
  assert.deepEqual(a.db.supprimes, [x.UID]);
});

test('fusion : la version d\'un·e collègue ne ramène pas un élément supprimé ici', async () => {
  const moi = await neuf(), autre = await neuf();
  const x = await moi.s.add('RS_Suivis', { Title: 'Suivi' });
  await autre.s.mergeJSON(version(moi.a)); // l'autre reçoit le suivi
  await moi.s.remove('RS_Suivis', x.ID);
  const st = await moi.s.mergeJSON(version(autre.a)); // l'autre l'a encore
  assert.equal(st.ajoutes, 0);
  assert.equal(moi.s.all('RS_Suivis').length, 0);
});

test('fusion : une suppression faite ailleurs s\'applique ici', async () => {
  const moi = await neuf(), autre = await neuf();
  const x = await moi.s.add('RS_Suivis', { Title: 'Suivi' });
  await moi.s.add('RS_Suivis', { Title: 'Gardé' });
  await autre.s.mergeJSON(version(moi.a));
  const chez = autre.s.all('RS_Suivis').find(r => r.UID === x.UID);
  await autre.s.remove('RS_Suivis', chez.ID);
  const st = await moi.s.mergeJSON(version(autre.a));
  assert.equal(st.supprimes, 1);
  assert.deepEqual(moi.s.all('RS_Suivis').map(r => r.Title), ['Gardé']);
});

test('export puis import : les suppressions sont conservées', async () => {
  const { a, s } = await neuf();
  const x = await s.add('RS_Suivis', { Title: 'Suivi' });
  await s.remove('RS_Suivis', x.ID);
  const b = await neuf();
  await b.s.importJSON(a.exportJSON());
  assert.deepEqual(b.a.db.supprimes, [x.UID]);
});
