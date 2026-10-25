// Fiche coaching : une seule construction des informations, partagée par le tableau (ordinateur, impression)
// et la présentation par bilan et par semaine (petits écrans). Aucune dépendance à l'affichage ni au store.
import { weeksOfVolee, semaineCle, phaseOf, fmtDate, addDays, sortBy } from './domain.js';

const signature = b => b ? `${fmtDate(b.DateBilan)}${b.DateSignatureEleve ? ` · signé élève ${fmtDate(b.DateSignatureEleve)}` : ''}${b.DateValidationCoord ? ` · validé ${fmtDate(b.DateValidationCoord)}` : ''}` : '';

/**
 * @param {object} v        volée (DateDebut, DateDebutRemob, DateDebutReexpo, DateFin)
 * @param {object} bilans   { mr, it, fin } : bilans de mise en route, intermédiaire et final (ou undefined)
 * @param {object[]} suivis suivis du cours de coaching de l'inscription
 * @returns {{ bilans: {titre, lignes: {libelle, valeur}[], signature}[], semaines: {numero, dates, phase, travaille: string[], progres: string[]}[] }}
 */
export function modeleFiche(v, { mr, it, fin }, suivis) {
  const bilans = [
    { titre: 'Mise en route', signature: signature(mr), lignes: [
      { libelle: 'Priorités identifiées (boussole)', valeur: mr?.DomainesPrioritaires?.join(' · ') || '' },
      { libelle: 'Objectif', valeur: mr?.Objectif || '' }] },
    { titre: 'Bilan intermédiaire', signature: signature(it), lignes: [
      { libelle: 'Avancée', valeur: it?.Avancee || '' },
      { libelle: 'Ajustement de l\'objectif', valeur: it?.AjustementObjectif || '' }] },
    { titre: 'Bilan final', signature: signature(fin), lignes: [
      { libelle: 'Plan de retour', valeur: fin?.PlanRetour || '' },
      { libelle: 'Objectif en intégration', valeur: fin?.ObjectifSortie || '' }] },
  ];
  const semaines = weeksOfVolee(v).map((lundi, k) => {
    const liste = sortBy(suivis.filter(s => s.SemaineCle === semaineCle(lundi)), 'DateSuivi');
    const ref = lundi < v.DateDebut ? v.DateDebut : lundi;
    const textes = champ => liste.map(s => s[champ]).filter(Boolean);
    return {
      numero: k + 1,
      dates: `${fmtDate(lundi, { year: false })} – ${fmtDate(addDays(lundi, 4), { year: false })}`,
      phase: phaseOf(ref, v),
      travaille: textes('CoachTravaille'),
      progres: textes('CoachProgres'),
    };
  });
  return { bilans, semaines };
}
