// Modèle de la fiche coaching (sans navigateur) : node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { modeleFiche } from '../js/fiche-coaching-modele.js';
import { weeksOfVolee, semaineCle } from '../js/domain.js';

const v = { DateDebut: '2026-05-18', DateDebutRemob: '2026-05-25', DateDebutReexpo: '2026-06-08', DateFin: '2026-06-19' };
const lundis = weeksOfVolee(v);
const suivi = (k, extra) => ({ SemaineCle: semaineCle(lundis[k]), DateSuivi: '2026-05-20', CoachTravaille: '', CoachProgres: '', ...extra });
const bilansVides = { mr: undefined, it: undefined, fin: undefined };

test('3 bilans (mise en route, intermédiaire, final) et autant de semaines que la volée, dans l\'ordre', () => {
  const m = modeleFiche(v, bilansVides, []);
  assert.deepEqual(m.bilans.map(b => b.titre), ['Mise en route', 'Bilan intermédiaire', 'Bilan final']);
  assert.ok(m.bilans.every(b => b.lignes.length === 2));
  assert.equal(m.semaines.length, lundis.length);
  assert.deepEqual(m.semaines.map(s => s.numero), lundis.map((_, i) => i + 1));
});

test('données manquantes : chaînes vides et listes vides, jamais undefined ni null', () => {
  const m = modeleFiche(v, bilansVides, []);
  for (const b of m.bilans) { assert.equal(b.signature, ''); for (const l of b.lignes) assert.equal(l.valeur, ''); }
  for (const s of m.semaines) { assert.deepEqual(s.travaille, []); assert.deepEqual(s.progres, []); }
});

test('les valeurs des bilans et la signature viennent des bons champs, dans le bon ordre', () => {
  const m = modeleFiche(v, {
    mr: { DomainesPrioritaires: ['Communiquer', 'Coopérer'], Objectif: 'O1', DateBilan: '2026-05-20', DateSignatureEleve: '2026-05-20', DateValidationCoord: '2026-05-21' },
    it: { Avancee: 'A2', AjustementObjectif: 'J2', DateBilan: '2026-06-03' },
    fin: { PlanRetour: 'P3', ObjectifSortie: 'S3', DateBilan: '2026-06-16', DateValidationCoord: '2026-06-17' },
  }, []);
  assert.deepEqual(m.bilans[0].lignes.map(l => l.valeur), ['Communiquer · Coopérer', 'O1']);
  assert.deepEqual(m.bilans[1].lignes.map(l => l.valeur), ['A2', 'J2']);
  assert.deepEqual(m.bilans[2].lignes.map(l => l.valeur), ['P3', 'S3']);
  assert.match(m.bilans[0].signature, /signé élève.*validé/);
  assert.doesNotMatch(m.bilans[1].signature, /signé|validé/);
  assert.match(m.bilans[2].signature, /validé/);
});

test('les phases suivent les dates de la volée, y compris pour une semaine qui commence avant la volée', () => {
  const m = modeleFiche(v, bilansVides, []);
  assert.equal(m.semaines[0].phase, 'Décompression');
  assert.equal(m.semaines[1].phase, 'Remobilisation');
  assert.equal(m.semaines[2].phase, 'Remobilisation');
  assert.equal(m.semaines[3].phase, 'Ré-exposition');
  assert.equal(m.semaines.at(-1).phase, 'Ré-exposition');
});

test('plusieurs suivis la même semaine : triés par date, valeurs vides retirées, autres semaines intactes', () => {
  const m = modeleFiche(v, bilansVides, [
    suivi(1, { DateSuivi: '2026-05-28', CoachTravaille: 'B', CoachProgres: '' }),
    suivi(1, { DateSuivi: '2026-05-26', CoachTravaille: 'A', CoachProgres: 'p1' }),
    suivi(1, { DateSuivi: '2026-05-27', CoachTravaille: '', CoachProgres: 'p2' }),
  ]);
  assert.deepEqual(m.semaines[1].travaille, ['A', 'B']);
  assert.deepEqual(m.semaines[1].progres, ['p1', 'p2']);
  assert.deepEqual(m.semaines[0].travaille, []);
  assert.deepEqual(m.semaines[2].progres, []);
});

test('textes longs et chaînes « 0 » conservés tels quels', () => {
  const long = 'x'.repeat(420);
  const m = modeleFiche(v, bilansVides, [suivi(0, { CoachTravaille: long, CoachProgres: '0' })]);
  assert.equal(m.semaines[0].travaille[0], long);
  assert.deepEqual(m.semaines[0].progres, ['0']);
});

test('le modèle ne modifie pas ses entrées', () => {
  const suivis = [suivi(0, { CoachTravaille: 'a' }), suivi(0, { CoachTravaille: 'b', DateSuivi: '2026-05-19' })];
  const avant = JSON.stringify([v, suivis]);
  modeleFiche(v, bilansVides, suivis);
  assert.equal(JSON.stringify([v, suivis]), avant);
});
