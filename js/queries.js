// Calculs partagés entre écrans (accueil, dossier, bilans). Rien n'est stocké : tout est recalculé.
import { S, volee, cours, eleve, nomEleve, inscriptionsEnCours, moi, ens, isCoord, refDate } from './state.js';
import { semaineCle, colleMinutes, groupBy, addDays, weeksOfVolee, phaseOf, mondayOf, sortBy } from './domain.js';

const st = () => S.store;

export function suivisDeSemaine(sk, inscIds) {
  const set = inscIds && new Set(inscIds);
  return st().where('RS_Suivis', s => s.SemaineCle === sk && (!set || set.has(s.InscriptionID)));
}

/** Colle du vendredi (R9) : devoirs de la semaine hors décompression. */
export function colles(sk, inscIds, coursIds) {
  const set = new Set(inscIds);
  const cset = coursIds && new Set(coursIds);
  const dv = st().where('RS_Devoirs', d => d.SemaineCle === sk && !d.SansConsequence && set.has(d.InscriptionID) && (!cset || cset.has(d.CoursID)));
  return [...groupBy(dv, d => d.EleveID)].map(([eleveId, list]) => ({ eleveId, n: list.length, minutes: colleMinutes(list.length), devoirs: list }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Alertes « désengagé » (R10) : un niveau 1 en comportement ou en travail. */
export function alertes(sk, inscIds, coursIds) {
  const cset = coursIds && new Set(coursIds);
  const sv = suivisDeSemaine(sk, inscIds).filter(s => (s.Comportement === 1 || s.Travail === 1) && (!cset || cset.has(s.CoursID)));
  return [...groupBy(sv, s => s.EleveID)].map(([eleveId, list]) => ({ eleveId, suivis: sortBy(list, 'DateSuivi') }));
}

/** Inscriptions sans suivi cette semaine (tous cours, ou un cours donné). */
export function sansSuivi(sk, inscriptions, coursId) {
  const sv = suivisDeSemaine(sk, inscriptions.map(i => i.ID)).filter(s => !coursId || s.CoursID === coursId);
  const vus = new Set(sv.map(s => s.InscriptionID));
  return inscriptions.filter(i => !vus.has(i.ID));
}

export function devoirsOuverts(inscIds, coursIds) {
  const set = new Set(inscIds);
  const cset = coursIds && new Set(coursIds);
  return st().where('RS_Devoirs', d => d.Statut === 'Ouvert' && set.has(d.InscriptionID) && (!cset || cset.has(d.CoursID)));
}

export function bilanDe(inscId, type) {
  return st().all('RS_Bilans').find(b => b.InscriptionID === inscId && b.TypeBilan === type) || null;
}

/** Bilans à faire, selon les seuils de date (arbitraires, à ajuster en équipe). */
export function bilansAFaire(date, v) {
  if (!v) return [];
  const out = [];
  for (const i of inscriptionsEnCours(v.ID)) {
    if (!bilanDe(i.ID, 'Mise en route')) out.push({ insc: i, type: 'Mise en route' });
    if (!bilanDe(i.ID, 'Intermédiaire') && date >= addDays(v.DateDebutRemob, 14)) out.push({ insc: i, type: 'Intermédiaire' });
    if (!bilanDe(i.ID, 'Final') && date >= addDays(v.DateFin, -10)) out.push({ insc: i, type: 'Final' });
  }
  return out;
}

export function actionsEnRetard(date, inscIds, responsable) {
  const set = inscIds && new Set(inscIds);
  return st().where('RS_Actions', a => !['Fait', 'Abandonnée'].includes(a.Statut) && a.Echeance && a.Echeance < date
    && (!set || set.has(a.InscriptionID)) && (!responsable || a.Responsable === responsable));
}

export function tachesDeLaSemaine(date, responsable) {
  const fin = addDays(mondayOf(date), 6);
  return sortBy(st().where('RS_Taches', t => t.Statut !== 'Terminée' && t.Echeance && t.Echeance <= fin
    && (!responsable || t.Responsable === responsable)), 'Echeance');
}

/**
 * Liste « À faire » de l'accueil.
 * Coordination : actions en retard, bilans, élèves sans suivi, devoirs ouverts, tâches.
 * Enseignant·e : limité à ses cours et à ce dont il/elle est responsable.
 */
export function aFaire(date, v, { restreint, coursIds }) {
  const items = [];
  const m = moi();
  const sk = semaineCle(date);
  const inscs = v ? inscriptionsEnCours(v.ID) : [];
  const inscIds = inscs.map(i => i.ID);

  for (const a of actionsEnRetard(date, inscIds, restreint ? m?.Title : null)) {
    items.push({ prio: 1, kind: 'Action en retard', title: a.Description, meta: `${nomEleve(eleve(a.EleveID))} · échéance ${a.Echeance.split('-').reverse().join('.')} · ${a.Responsable}`, late: true, go: ['action', { id: a.ID }] });
  }
  if (!restreint) {
    for (const b of bilansAFaire(date, v)) {
      items.push({ prio: 2, kind: 'Bilan à faire', title: `${b.type} · ${nomEleve(eleve(b.insc.EleveID))}`, meta: v.Title, go: ['bilan', { insc: b.insc.ID, type: b.type }] });
    }
  }
  if (v) {
    if (restreint) {
      for (const cid of coursIds) {
        const sans = sansSuivi(sk, inscs, cid);
        if (sans.length) items.push({ prio: 3, kind: 'Sans suivi cette semaine', title: `${cours(cid)?.Title} : ${sans.length} élève${sans.length > 1 ? 's' : ''}`, meta: sans.map(i => eleve(i.EleveID)?.Prenom).join(', '), go: ['groupe', { cours: cid }] });
      }
    } else {
      for (const i of sansSuivi(sk, inscs)) {
        items.push({ prio: 3, kind: 'Sans suivi cette semaine', title: nomEleve(eleve(i.EleveID)), meta: 'Aucune cotation depuis lundi', go: ['saisie', { eleve: i.EleveID }] });
      }
    }
    const dv = devoirsOuverts(inscIds, restreint ? coursIds : null);
    for (const [eid, list] of groupBy(dv, d => d.EleveID)) {
      items.push({ prio: 4, kind: 'Devoirs ouverts', title: `${nomEleve(eleve(eid))} : ${list.length} devoir${list.length > 1 ? 's' : ''}`, meta: list.map(d => cours(d.CoursID)?.Title).join(', '), go: ['dossier', { eleve: eid }] });
    }
  }
  for (const t of tachesDeLaSemaine(date, isCoord() ? null : m?.Title)) {
    const late = t.Echeance < date;
    items.push({ prio: late ? 1 : 5, kind: late ? 'Tâche en retard' : 'Tâche de la semaine', title: t.Title, meta: `${t.Responsable} · ${t.Echeance.split('-').reverse().join('.')}`, late, go: ['taches', { id: t.ID }] });
  }
  return items.sort((a, b) => a.prio - b.prio);
}

/** Synthèse hebdomadaire d'une inscription (R10) : semaines × cours, pastilles, aucune moyenne. */
export function synthese(insc) {
  const v = volee(insc.VoleeID);
  const weeks = weeksOfVolee(v).map((mon, k) => {
    const ref = mon < v.DateDebut ? v.DateDebut : mon;
    return { n: k + 1, monday: mon, sk: semaineCle(mon), phase: phaseOf(ref, v) };
  });
  const sv = st().where('RS_Suivis', s => s.InscriptionID === insc.ID);
  const byCours = groupBy(sv, s => s.CoursID);
  const rows = sortBy([...byCours.keys()].map(id => cours(id)).filter(Boolean), 'Title').map(c => ({
    cours: c,
    cells: weeks.map(w => sortBy(byCours.get(c.ID).filter(s => s.SemaineCle === w.sk), 'DateSuivi')),
  }));
  return { volee: v, weeks, rows };
}

/** Panneau « Ce que dit le dossier » pour les bilans (seuils indicatifs, à valider en équipe). */
export function preuves(insc, jusquau = refDate()) {
  // Seules les traces disponibles à la date du bilan comptent ; une ligne par branche.
  const ok = [], frag = [];
  const fmt = n => n.toFixed(1).replace('.', ',');
  const evals = st().where('RS_Evaluations', e => e.InscriptionID === insc.ID && e.DateEval <= jusquau);
  const parBranche = [...groupBy(sortBy(evals, 'DateEval'), e => e.CoursID)]
    .sort((a, b) => (cours(a[0])?.Title || '').localeCompare(cours(b[0])?.Title || '', 'fr'));
  for (const [cid, list] of parBranche) {
    const c = cours(cid)?.Title || '';
    const notes = list.filter(e => typeof e.Note === 'number');
    const formatif = list.filter(e => e.ResultatFormatif);
    if (notes.length) {
      const avg = notes.reduce((m, e) => m + e.Note * (e.Coefficient || 1), 0) / notes.reduce((m, e) => m + (e.Coefficient || 1), 0);
      const nEt = notes.filter(e => e.Etayage).length;
      const etaye = nEt === notes.length ? 'avec étayage' : nEt ? 'en partie avec étayage' : '';
      const detail = [notes.length > 1 ? `moyenne ${fmt(avg)}` : '', etaye].filter(Boolean).join(', ');
      (avg >= 4 ? ok : frag).push(`${c} : ${notes.map(e => fmt(e.Note)).join(' → ')}${detail ? ` (${detail})` : ''}`);
    } else if (formatif.length) {
      const r = formatif.map(e => e.ResultatFormatif.toLowerCase()).join(', ');
      (formatif.every(e => e.ResultatFormatif === 'Réussi seul') ? ok : formatif.some(e => e.ResultatFormatif === 'Pas encore') ? frag : ok).push(`${c} : ${r} (formatif)`);
    }
  }
  const sv = st().where('RS_Suivis', s => s.InscriptionID === insc.ID && s.DateSuivi <= jusquau);
  const bons = sv.filter(s => s.Comportement >= 3 && s.Travail >= 3).length;
  const bas = sv.filter(s => s.Comportement <= 2 || s.Travail <= 2);
  if (sv.length) ok.push(`${bons} séance${bons > 1 ? 's' : ''} sur ${sv.length} avec C et T à 3 ou 4`);
  if (bas.length) {
    const parCours = [...groupBy(bas, s => s.CoursID)].sort((a, b) => b[1].length - a[1].length).slice(0, 4).map(([cid, l]) => `${cours(cid)?.Title} (${l.length})`).join(', ');
    frag.push(`${bas.length} séance${bas.length > 1 ? 's' : ''} avec un niveau 1 ou 2, surtout : ${parCours}`);
  }
  const acts = st().where('RS_Actions', a => a.InscriptionID === insc.ID);
  for (const a of acts.filter(a => a.Statut === 'Fait' && (!a.DateCloture || a.DateCloture <= jusquau))) ok.push(`Action réalisée : ${a.Description}`);
  for (const a of acts.filter(a => !['Fait', 'Abandonnée'].includes(a.Statut) && a.Echeance && a.Echeance < jusquau)) frag.push(`Action en retard : ${a.Description}`);
  const dv = st().where('RS_Devoirs', d => d.InscriptionID === insc.ID && !d.SansConsequence && d.DateConstat <= jusquau);
  if (dv.length) {
    const rattr = dv.filter(d => d.Statut === 'Rattrapé').length;
    frag.push(`${dv.length} devoir${dv.length > 1 ? 's' : ''} non fait${dv.length > 1 ? 's' : ''} (hors décompression), dont ${rattr} rattrapé${rattr > 1 ? 's' : ''}`);
  } else ok.push('Aucun devoir non fait hors décompression');
  return { ok, frag };
}

export function enseignantNom(id) { return ens(id)?.Title || '—'; }
export function cpsDe(inscIds) {
  const set = new Set(inscIds);
  return sortBy(st().where('RS_CPS', c => set.has(c.InscriptionID)), 'DatePassation');
}
