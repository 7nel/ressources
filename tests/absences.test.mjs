// Décompte des heures d'absence : matin 4 h, après-midi 3 h, mercredi 4 h au plus ; jamais plus que la journée d'école.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { heuresJour, totalHeuresAbsence } = await import('../js/domain.js');
const { S } = await import('../js/state.js');
const { Store } = await import('../js/data/store.js');
const { LocalAdapter } = await import('../js/data/local-adapter.js');
const { heuresAbsenceInsc, bilanCR } = await import('../js/queries.js');

const LUNDI = '2026-11-16', MERCREDI = '2026-11-18';
const A = (Duree, Moment = '', DateAbsence = LUNDI, EleveID = 1) => ({ EleveID, Duree, Moment, DateAbsence });

test('une durée seule', () => {
  assert.equal(heuresJour([A('Heure', 'Matin')]), 1);
  assert.equal(heuresJour([A('Demi-journée', 'Matin')]), 4);
  assert.equal(heuresJour([A('Demi-journée', 'Après-midi')]), 3);
  assert.equal(heuresJour([A('Journée')]), 7);
});

test('mercredi : pas d\'après-midi, 4 h au plus', () => {
  assert.equal(heuresJour([A('Journée', '', MERCREDI)]), 4);
  assert.equal(heuresJour([A('Demi-journée', 'Après-midi', MERCREDI)]), 0);
  assert.equal(heuresJour([A('Demi-journée', 'Matin', MERCREDI), A('Heure', 'Matin', MERCREDI)]), 4);
});

test('une heure dans une demi-journée déjà absente ne compte pas en plus', () => {
  assert.equal(heuresJour([A('Demi-journée', 'Matin'), A('Heure', 'Matin')]), 4);
  assert.equal(heuresJour([A('Demi-journée', 'Matin'), A('Heure', 'Après-midi')]), 5);
  assert.equal(heuresJour([A('Journée'), A('Heure', 'Matin'), A('Demi-journée', 'Après-midi')]), 7);
});

test('les heures s\'ajoutent jusqu\'à la durée de la demi-journée', () => {
  const cinqMatin = Array.from({ length: 5 }, () => A('Heure', 'Matin'));
  assert.equal(heuresJour(cinqMatin), 4);
  assert.equal(heuresJour([A('Heure', 'Après-midi'), A('Heure', 'Après-midi'), A('Heure', 'Après-midi'), A('Heure', 'Après-midi')]), 3);
  assert.equal(heuresJour([A('Demi-journée', 'Matin'), A('Demi-journée', 'Après-midi')]), 7);
});

test('le total s\'additionne jour par jour et élève par élève', () => {
  assert.equal(totalHeuresAbsence([A('Journée'), A('Heure', 'Matin'), A('Journée', '', MERCREDI), A('Demi-journée', 'Matin', LUNDI, 2)]), 7 + 4 + 4);
});

test('inscription et bilan CR', async () => {
  S.store = new Store(new LocalAdapter({ memoryOnly: true }));
  await S.store.init();
  const v = S.store.all('RS_Volees').find(x => x.Title === '2026-27 V2');
  const e1 = await S.store.add('RS_Eleves', { Nom: 'Test', Prenom: 'A', Statut: 'Actif' });
  const e2 = await S.store.add('RS_Eleves', { Nom: 'Test', Prenom: 'B', Statut: 'Actif' });
  const i1 = await S.store.add('RS_Inscriptions', { EleveID: e1.ID, VoleeID: v.ID, StatutInscription: 'En cours' });
  await S.store.add('RS_Inscriptions', { EleveID: e2.ID, VoleeID: v.ID, StatutInscription: 'En cours' });
  const abs = (Duree, Moment, DateAbsence, Phase) => S.store.add('RS_Absences', { EleveID: e1.ID, InscriptionID: i1.ID, CoursID: 1, DateAbsence, Duree, Moment, Phase });
  await abs('Demi-journée', 'Matin', '2026-10-27', 'Décompression');
  await abs('Heure', 'Matin', '2026-10-27', 'Décompression');
  await abs('Journée', '', MERCREDI, 'Remobilisation');
  assert.equal(heuresAbsenceInsc(i1.ID), 8);
  const b = bilanCR([v.ID]).absences;
  assert.equal(b.total, 8);
  assert.equal(b.sans, 1);
  assert.deepEqual(b.phases.map(p => p.total), [4, 4, 0]);
});
