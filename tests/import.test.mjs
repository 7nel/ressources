// Tests de l'import (sans navigateur, sans dépendance) : node --test tests/
// Chaque cas vérifie que la base active est identique avant et après un import refusé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalAdapter } from '../js/data/local-adapter.js';
import { Store, LISTS } from '../js/data/store.js';
import { ImportError } from '../js/data/import-validation.js';

// Base de test : base de départ de l'app (sans élève) + quelques enregistrements fictifs minimaux.
const neuf = async () => {
  const a = new LocalAdapter({ memoryOnly: true }); const s = new Store(a); await s.init();
  for (const n of ['A', 'B', 'C']) await s.add('RS_Eleves', { Title: `Élève ${n}` });
  for (let k = 0; k < 4; k++) await s.add('RS_Suivis', { Title: `Suivi ${k}` });
  for (let k = 0; k < 5; k++) await s.add('RS_Evaluations', { Title: `Évaluation ${k}` });
  await s.add('RS_Taches', { Title: 'Tâche' });
  return { a, s };
};
const instantane = a => JSON.stringify(a.db);
const refuse = async (s, a, texte, code) => {
  const avant = instantane(a);
  await assert.rejects(() => s.importJSON(texte), e => e instanceof ImportError && (!code || e.code === code));
  assert.equal(instantane(a), avant, 'la base doit être strictement inchangée');
  assert.equal(JSON.stringify(s.cache.RS_Eleves), JSON.stringify(a.db.lists.RS_Eleves), 'le cache doit rester aligné');
};

test('base de départ : enseignant·es, cours et volées, aucun élève', async () => {
  const a = new LocalAdapter({ memoryOnly: true }); const s = new Store(a); await s.init();
  assert.equal(a.db.lists.RS_Eleves.length, 0);
  assert.ok(a.db.lists.RS_Enseignants.length > 0 && a.db.lists.RS_Cours.length > 0 && a.db.lists.RS_Volees.length > 0);
});

test('{"lists":{}} est refusé (listes essentielles absentes)', async () => {
  const { a, s } = await neuf();
  await refuse(s, a, '{"lists":{}}', 'incomplet');
});

test('fichier valide mais vide (toutes listes présentes, aucune donnée) refusé sur base non vide', async () => {
  const { a, s } = await neuf();
  const lists = Object.fromEntries(LISTS.map(l => [l, []]));
  await refuse(s, a, JSON.stringify({ format: 'RessourceS-bac-a-sable', lists }), 'vide');
  assert.throws(() => s.previewImport(JSON.stringify({ lists })), e => e.code === 'vide');
});

test('JSON mal formé, tronqué, vide, non-objet', async () => {
  const { a, s } = await neuf();
  for (const t of ['ceci n\'est pas du json', '{"lists":{"RS_Eleves":[', '', 'null', '[]', '42', '"x"']) await refuse(s, a, t);
});

test('types incorrects : liste non tableau, élément null, élément sans ID, ID dupliqué, format inconnu', async () => {
  const { a, s } = await neuf();
  const base = () => JSON.parse(JSON.stringify({ lists: a.db.lists }));
  const cas = {
    liste: b => { b.lists.RS_Eleves = 5; },
    nul: b => { b.lists.RS_Suivis[3] = null; },
    sansId: b => { delete b.lists.RS_Taches[0]?.ID; b.lists.RS_Eleves[0] = { Title: 'x' }; },
    dup: b => { b.lists.RS_Eleves[1].ID = b.lists.RS_Eleves[0].ID; },
    lists: b => { b.lists = []; },
    format: b => { b.format = 'AutreChose'; },
  };
  for (const [nom, mod] of Object.entries(cas)) { const b = base(); mod(b); await refuse(s, a, JSON.stringify(b)); }
});

test('fichier partiellement valide (une liste corrompue parmi des listes saines) refusé en entier', async () => {
  const { a, s } = await neuf();
  const b = { lists: JSON.parse(JSON.stringify(a.db.lists)) };
  b.lists.RS_Evaluations = 'corrompu';
  await refuse(s, a, JSON.stringify(b), 'liste');
});

test('aperçu : ne modifie rien et rend les décomptes', async () => {
  const { a, s } = await neuf();
  const avant = instantane(a);
  const p = s.previewImport(JSON.stringify({ lists: a.db.lists }));
  assert.equal(p.fichier.RS_Eleves, 3); assert.equal(p.actuel.RS_Evaluations, 5);
  assert.equal(instantane(a), avant);
});

test('import valide : export puis restauration à l\'identique, et marque « à enregistrer »', async () => {
  const { a, s } = await neuf();
  await s.add('RS_Taches', { Title: 'ALLER-RETOUR' });
  const export1 = s.exportJSON();
  const autre = await neuf();
  let marque = 0; autre.s.onWrite = () => { marque++; };
  await autre.s.importJSON(export1);
  assert.equal(marque, 1);
  assert.ok(autre.s.all('RS_Taches').some(t => t.Title === 'ALLER-RETOUR'));
  assert.deepEqual(autre.a.db.lists, JSON.parse(export1).lists);
  assert.equal(autre.s.all('RS_Eleves').length, 3);
});

test('listes inconnues du fichier conservées ; listes optionnelles absentes créées vides', async () => {
  const { a, s } = await neuf();
  const b = { lists: JSON.parse(JSON.stringify(a.db.lists)) };
  b.lists.RS_Future = [{ ID: 1, x: 1 }]; delete b.lists.RS_Travaux;
  await s.importJSON(JSON.stringify(b));
  assert.deepEqual(a.db.lists.RS_Future, [{ ID: 1, x: 1 }]);
  assert.deepEqual(a.db.lists.RS_Travaux, []);
});

test('l\'export contient toujours le même format (v1 ; « supprimes » ajouté le 2026-10-29)', async () => {
  const { s } = await neuf();
  const e = JSON.parse(s.exportJSON());
  assert.equal(e.format, 'RessourceS-bac-a-sable'); assert.equal(e.version, 1); assert.deepEqual(Object.keys(e), ['format', 'version', 'exporte', 'lists', 'supprimes']);
});

test('fusion : une liste mal formée est refusée sans toucher à la base', async () => {
  const { a, s } = await neuf();
  const avant = instantane(a);
  await assert.rejects(() => s.mergeJSON(JSON.stringify({ lists: { RS_Eleves: 5 } })));
  assert.equal(instantane(a), avant);
});

test('import annulé : sans appel à importJSON, rien ne change (aperçu seul)', async () => {
  const { a, s } = await neuf();
  const avant = instantane(a);
  s.previewImport(s.exportJSON());
  assert.equal(instantane(a), avant);
});
