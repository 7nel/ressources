// Base de départ du bac à sable : enseignant·es (initiales réelles de l'équipe), cours et volées. Aucun élève.
import { groupeCours } from '../domain.js';

export function buildSeed() {
  const lists = {};
  const add = (list, rec, created) => {
    lists[list] ||= [];
    const ID = lists[list].length + 1;
    const ts = (created || '2026-08-25') + 'T15:00:00.000Z';
    const r = { ID, Created: ts, Modified: ts, ...rec };
    lists[list].push(r);
    return r;
  };

  /* ---------- Enseignants (fictifs) ---------- */
  const T = [
    ['PL', 'Coordination'], ['ME', 'Coordination'], ['CM', 'Enseignant'], ['ET', 'Enseignant'], ['DAH', 'Enseignant'],
    ['OG', 'Enseignant'], ['DA', 'Enseignant'], ['VO', 'Enseignant'], ['XG', 'Enseignant'],
  ].map(([sigle, role]) => add('RS_Enseignants', {
    Title: sigle, Email: `${sigle.toLowerCase()}@exemple.invalid`, Role: role, Actif: true,
  }));
  const [PL, ME, CM, ET, DAH, OG, DA, VO, XG] = T.map((_, k) => k);

  /* ---------- Cours : [titre, enseignant, coaching, couleur, portée, jours (0 = lundi)] ---------- */
  const C = [
    ['Coaching', PL, true, '#2F6F63', 'Séance', [1]],
    ['Musique', ME, false, '#7A5CC4', 'Séance', [2]],
    ['Mathématiques', CM, false, '#B5651D', 'Séance', [0, 2]],
    ['Sciences', CM, false, '#6A994E', 'Séance', [3]],
    ['Anglais', ET, false, '#3C8DAD', 'Semaine', [4]],
    ['Méthodo / Orientation', ET, false, '#2A7F62', 'Semaine', [4]],
    ['Allemand', DAH, false, '#8E3B5E', 'Semaine', [4]],
    ['Français', OG, false, '#5B6FB0', 'Séance', [0, 3]],
    ['Théâtre', OG, false, '#C05299', 'Séance', [4]],
    ['ACM', DA, false, '#9C6644', 'Semaine', [3]],
    ['Arts visuels', VO, false, '#D08C2E', 'Semaine', [2]],
    ['Sport', XG, false, '#4F7CAC', 'Séance', [1]],
  ].map(([title, t, coach, col, portee, days]) => ({
    rec: add('RS_Cours', { Title: title, EnseignantID: T[t].ID, EstCoaching: coach, Couleur: col, Groupe: coach ? '' : groupeCours({ Title: title }) }), portee, days,
  }));
  const coursByTitle = Object.fromEntries(C.map(c => [c.rec.Title, c.rec]));

  /* ---------- Volées (dates de phases V2–V5 : proposition à vérifier) ---------- */
  const V = [
    ['2025-26 V5', '2025-26', '2026-05-18', '2026-05-25', '2026-06-08', '2026-06-19'],
    ['2026-27 V1', '2026-27', '2026-08-31', '2026-09-07', '2026-10-05', '2026-10-16'],
    ['2026-27 V2', '2026-27', '2026-10-26', '2026-11-04', '2026-12-07', '2026-12-23'],
    ['2026-27 V3', '2026-27', '2027-01-11', '2027-01-20', '2027-03-01', '2027-03-18'],
    ['2026-27 V4', '2026-27', '2027-03-22', '2027-03-29', '2027-05-03', '2027-05-14'],
    ['2026-27 V5', '2026-27', '2027-05-17', '2027-05-24', '2027-06-07', '2027-06-17'],
  ].map(([t, a, d, r, x, f]) => add('RS_Volees', { Title: t, AnneeScolaire: a, DateDebut: d, DateDebutRemob: r, DateDebutReexpo: x, DateFin: f }));
  return { lists };
}
