// Bac à sable : enseignant·es = initiales réelles de l'équipe ; ÉLÈVES FICTIFS (noms inventés, plantes des Alpes).
// Générées de façon déterministe : chaque testeur part du même jeu de données.
import { CONFIG } from '../config.js';
import { addDays, semaineCle, phaseOf, cleDoublon, DOMAINES } from '../domain.js';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSeed({ exemples = CONFIG.DONNEES_EXEMPLE } = {}) {
  const rnd = mulberry32(20261017);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
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
    rec: add('RS_Cours', { Title: title, EnseignantID: T[t].ID, EstCoaching: coach, Couleur: col }), portee, days,
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
  const [V5prev, V1] = V;

  /* ---------- Élèves (fictifs) ---------- */
  const SIGLES = ['ABR', 'BCH', 'CDU', 'DMO', 'EFA', 'FRO', 'GVI', 'HPE', 'JLA', 'KMA'];
  const mkEleve = (Prenom, Nom, Statut) => add('RS_Eleves', { Title: `${Nom} ${Prenom}`, Nom, Prenom, CleDoublon: cleDoublon(Nom, Prenom), Statut }, '2026-08-25');
  const mkInsc = (e, v, Degre, ClasseOrigine, Titulaire, Statut) => add('RS_Inscriptions', {
    Title: `${e.Nom} ${e.Prenom} – ${v.Title}`, EleveID: e.ID, VoleeID: v.ID, CleUnique: `E${e.ID}-V${v.ID}`,
    Degre, ClasseOrigine, Titulaire,
    ProfFrancais: pick(SIGLES), ProfAllemand: pick(SIGLES), ProfAnglais: pick(SIGLES), ProfMaths: pick(SIGLES), ProfSciences: pick(SIGLES),
    StatutInscription: Statut,
  }, addDays(v.DateDebut, -5));

  const PROFILS = {
    progress: [2.2, 2.9, 3.3], stable: [3.0, 3.0, 3.1], good: [3.3, 3.6, 3.7], dip: [2.6, 3.0, 1.8], fragile: [2.4, 2.6, 2.3],
  };
  const NOTE = { progress: 4.3, stable: 4.5, good: 5.2, dip: 4.1, fragile: 3.5 };
  const E = [
    ['Léa', 'Edelweiss', '10CO', '10CO3', 'M. Tilleul', 'progress'],
    ['Noah', 'Gentiane', '9CO', '9CO1', 'Mme Saule', 'stable'],
    ['Inès', 'Arolle', '11CO', '11CO2', 'M. Peuplier', 'good'],
    ['Kenan', 'Mélèze', '10CO libérable', '10CO5', 'Mme Charme', 'dip'],
    ['Maëlle', 'Myrtille', '9CO', '9CO4', 'M. Frêne', 'progress'],
    ['Timéo', 'Sorbier', '11CO', '11CO1', 'Mme Aulne', 'fragile'],
  ].map(([p, n, deg, cl, tit, prof]) => {
    const e = mkEleve(p, n, 'Actif');
    return { e, deg, cl, tit, prof, i: null };
  });
  // Anciens : deux élèves de la volée précédente, dont Timéo qui revient pour une 2e volée.
  const jules = mkEleve('Jules', 'Génépi', 'Ancien');
  const sara = mkEleve('Sara', 'Lavande', 'Archivé');
  const timeo = E[5];
  const iJules = mkInsc(jules, V5prev, '10CO', '10CO2', 'M. Orme', 'Terminée');
  mkInsc(sara, V5prev, '9CO', '9CO3', 'Mme Bruyère', 'Terminée');
  const iTimeoPrev = mkInsc(timeo.e, V5prev, '10CO', '10CO1', 'Mme Aulne', 'Terminée');
  for (const s of E) s.i = mkInsc(s.e, V1, s.deg, s.cl, s.tit, 'En cours');

  /* ---------- Pools de textes (observables, sans données sensibles) ---------- */
  const OBS = [
    'A demandé de l\'aide au bon moment.', 'Travail commencé seul, terminé avec un rappel.',
    'Mise au travail lente en début de séance.', 'Participation spontanée à l\'oral.',
    'A quitté la tâche après 10 minutes, revenu après une courte pause.', 'Matériel oublié.',
    'A aidé un camarade sans qu\'on le lui demande.', 'Consigne relue seul avant de demander.',
    'Téléphone sorti deux fois malgré le rappel.', 'A terminé l\'exercice de niveau classe.',
  ];
  const COACH_T = {
    'Décompression': ['Faire connaissance, règles de la classe', 'Objectif personnel : premières pistes', 'Ce qui m\'aide, ce qui me freine'],
    'Remobilisation': ['Planifier la semaine dans l\'agenda', 'Demander de l\'aide : quand et à qui', 'Préparer l\'évaluation de maths', 'Gérer une consigne longue'],
    'Ré-exposition': ['Plan de retour : horaire de la classe d\'origine', 'Préparer la rencontre avec le titulaire', 'Situations difficiles en classe : que faire ?'],
  };
  const COACH_P = [
    'A rempli l\'agenda seul·e.', 'Point de vigilance : fatigue en début de semaine.', 'Sait nommer deux personnes ressources.',
    'Progrès : demande de l\'aide plus tôt.', 'Point de vigilance : évite les tâches écrites longues.', 'Objectif reformulé avec ses mots.',
  ];
  const DEVOIRS = ['Exercices p. 34', 'Fiche de vocabulaire', 'Lecture du chapitre 3', 'Fiche de révision', 'Rédaction de 10 lignes', 'Exercices 5 à 9'];
  const ETAYAGE = ['Consignes reformulées oralement', 'Aide sollicitée par l\'élève deux fois', 'Temps supplémentaire de 10 minutes', 'Exemple résolu à disposition', 'Calculatrice autorisée'];

  /* ---------- Suivis et devoirs de V1 (jusqu'au mardi 06.10) ---------- */
  const LIMITE = '2026-10-06';
  const lvl = (base, off = 0) => clamp(Math.round(base + off + (rnd() - 0.5) * 1.6), 1, 4);
  const phaseIdx = p => ['Décompression', 'Remobilisation', 'Ré-exposition'].indexOf(p);

  for (let monday = V1.DateDebut; monday <= LIMITE; monday = addDays(monday, 7)) {
    for (const c of C) {
      if (c.rec.Title === 'Méthodo / Orientation' && monday < V1.DateDebutReexpo) continue;
      for (const day of c.days) {
        const date = addDays(monday, day);
        if (date > LIMITE || date < V1.DateDebut) continue;
        const phase = phaseOf(date, V1);
        for (const s of E) {
          if (s.e.Prenom === 'Maëlle' && date >= '2026-10-05') continue; // absente lundi-mardi : « sans suivi »
          if (rnd() < 0.07) continue; // absences ponctuelles
          const base = PROFILS[s.prof][phaseIdx(phase)];
          let comp = lvl(base), trav = lvl(base, -0.2);
          if (s.prof === 'dip' && date >= '2026-10-05') { comp = date === '2026-10-05' && c.rec.Title === 'Français' ? 1 : clamp(comp, 1, 2); trav = clamp(trav, 1, 2); }
          const coaching = c.rec.EstCoaching;
          add('RS_Suivis', {
            Title: `${s.e.Prenom} ${s.e.Nom} · ${c.rec.Title} · ${date}`,
            EleveID: s.e.ID, InscriptionID: s.i.ID, CoursID: c.rec.ID, EnseignantID: c.rec.EnseignantID,
            DateSuivi: date, SemaineCle: semaineCle(date), Portee: c.portee, Phase: phase,
            Comportement: comp, Travail: trav,
            Observation: !coaching && rnd() < 0.22 ? pick(OBS) : '',
            CoachTravaille: coaching ? pick(COACH_T[phase]) : '',
            CoachProgres: coaching ? pick(COACH_P) : '',
          }, date);
          // Devoirs non faits
          const isHw = ['Français', 'Mathématiques', 'Allemand', 'Anglais'].includes(c.rec.Title);
          const forced = monday === '2026-10-05' && ((s.e.Prenom === 'Noah' && ['Français', 'Mathématiques'].includes(c.rec.Title))
            || (s.e.Prenom === 'Kenan' && ['Français', 'Mathématiques'].includes(c.rec.Title))
            || (s.e.Prenom === 'Timéo' && c.rec.Title === 'Mathématiques'));
          const random = monday < '2026-10-05' && isHw && rnd() < (s.prof === 'fragile' || s.prof === 'dip' ? 0.18 : 0.06);
          if (forced || random) {
            const sansConseq = phase === 'Décompression';
            add('RS_Devoirs', {
              Title: `${s.e.Prenom} ${s.e.Nom} · ${c.rec.Title} · ${date}`,
              EleveID: s.e.ID, InscriptionID: s.i.ID, CoursID: c.rec.ID, EnseignantID: c.rec.EnseignantID,
              DateConstat: date, SemaineCle: semaineCle(date), Phase: phase, SansConsequence: sansConseq,
              Description: pick(DEVOIRS),
              Statut: forced ? 'Ouvert' : (rnd() < 0.75 ? 'Rattrapé' : 'Non rattrapé'),
              DateResolution: forced ? null : addDays(date, 2),
            }, date);
          }
        }
      }
    }
  }

  /* ---------- Évaluations ---------- */
  const mkEval = (s, inscr, volee, coursTitle, date, sujet, coef = 1) => {
    const c = coursByTitle[coursTitle];
    const phase = phaseOf(date, volee);
    const rec = {
      Title: `${s.e.Prenom} ${s.e.Nom} · ${coursTitle} · ${sujet}`,
      EleveID: s.e.ID, InscriptionID: inscr.ID, CoursID: c.ID, EnseignantID: c.EnseignantID,
      DateEval: date, Phase: phase, Sujet: sujet, Coefficient: coef, ResultatFormatif: '', Note: null, Etayage: '',
    };
    if (phase === 'Décompression') {
      const b = NOTE[s.prof];
      rec.ResultatFormatif = b >= 4.8 ? 'Réussi seul' : b >= 4 ? (rnd() < .5 ? 'Réussi seul' : 'Avec aide') : (rnd() < .5 ? 'Avec aide' : 'Pas encore');
    } else {
      rec.Note = clamp(Math.round((NOTE[s.prof] + (rnd() - 0.5) * 1.0) * 10) / 10, 1, 6);
      if (phase === 'Remobilisation') rec.Etayage = pick(ETAYAGE);
    }
    add('RS_Evaluations', rec, date);
  };
  for (const s of E) {
    mkEval(s, s.i, V1, 'Français', '2026-09-03', 'Compréhension de texte');
    mkEval(s, s.i, V1, 'Mathématiques', '2026-09-02', 'Calcul mental');
    mkEval(s, s.i, V1, 'Mathématiques', '2026-09-16', 'Fractions');
    mkEval(s, s.i, V1, 'Français', '2026-09-24', 'Production écrite');
    mkEval(s, s.i, V1, 'Allemand', '2026-10-02', 'Vocabulaire unité 2', 0.5);
    mkEval(s, s.i, V1, 'Sciences', '2026-09-30', 'Le système solaire');
    if (rnd() < 0.7) mkEval(s, s.i, V1, 'Mathématiques', '2026-10-05', 'Proportionnalité');
  }
  mkEval(timeo, iTimeoPrev, V5prev, 'Mathématiques', '2026-06-03', 'Nombres relatifs');
  mkEval(timeo, iTimeoPrev, V5prev, 'Français', '2026-06-15', 'Lettre formelle');

  /* ---------- Bilans ---------- */
  const OBJ = {
    Léa: 'Rendre mes devoirs de maths chaque semaine', Noah: 'Oser poser une question en classe',
    Inès: 'Choisir un métier à tester en stage', Kenan: 'Rester en classe toute la séance',
    Maëlle: 'Organiser mon sac et mon agenda seule', Timéo: 'Reprendre confiance en maths',
  };
  const mkBilan = (s, inscr, type, date, extra) => add('RS_Bilans', {
    Title: `${s.e.Prenom} ${s.e.Nom} · ${type}`, InscriptionID: inscr.ID, EleveID: s.e.ID,
    TypeBilan: type, CleUnique: `I${inscr.ID}-${{ 'Mise en route': 'MR', 'Intermédiaire': 'INT', 'Final': 'FIN' }[type]}`,
    DateBilan: date, Participants: `${s.e.Prenom}, PL (coaching), ${s.tit}`,
    DomainesPrioritaires: [], Objectif: '', PointsAppui: '', Fragilites: '', Avancee: '', AjustementObjectif: '',
    PlanRetour: '', ObjectifSortie: '', PassationTitulaire: false, DatePassation: null,
    DateSignatureEleve: date, DateValidationCoord: addDays(date, 1), ...extra,
  }, date);
  for (const s of E) {
    mkBilan(s, s.i, 'Mise en route', '2026-09-03', {
      DomainesPrioritaires: [DOMAINES[Math.floor(rnd() * 5)], DOMAINES[Math.floor(rnd() * 5)]].filter((d, k, a) => a.indexOf(d) === k),
      Objectif: OBJ[s.e.Prenom], PointsAppui: 'Bonne relation avec le coach ; à l\'aise à l\'oral', Fragilites: 'Se décourage face aux tâches écrites longues',
    });
    if (['Léa', 'Noah', 'Inès', 'Maëlle'].includes(s.e.Prenom)) {
      mkBilan(s, s.i, 'Intermédiaire', '2026-09-25', {
        Avancee: 'Devoirs rendus 3 semaines sur 4 ; note de 4,5 en fractions avec aide sollicitée.',
        AjustementObjectif: 'Garder l\'objectif, ajouter : préparer les évaluations avec une fiche.',
        PlanRetour: 'Retour progressif : maths et français en classe d\'origine dès la semaine 7.',
      });
    }
  }
  const tPrev = { ...timeo, tit: 'Mme Aulne' };
  mkBilan(tPrev, iTimeoPrev, 'Mise en route', '2026-05-20', { Objectif: 'Venir à l\'école tous les jours', DomainesPrioritaires: [DOMAINES[2]], PointsAppui: 'Intérêt pour la mécanique', Fragilites: 'Retards le matin' });
  mkBilan(tPrev, iTimeoPrev, 'Intermédiaire', '2026-06-02', { Avancee: 'Présent tous les jours depuis 2 semaines.', AjustementObjectif: 'Ajouter : rendre un travail de maths par semaine.', PlanRetour: 'Retour en 11CO à la rentrée, avec suivi.' });
  mkBilan(tPrev, iTimeoPrev, 'Final', '2026-06-17', { PlanRetour: 'Retour en classe d\'origine à la rentrée ; point avec la titulaire en septembre.', ObjectifSortie: 'Demander de l\'aide en maths avant les évaluations', PassationTitulaire: true, DatePassation: '2026-06-18' });

  /* ---------- CPS ---------- */
  const mkCPS = (s, inscr, date, moment, lvlQ, lvlB) => {
    const rec = { Title: `${s.e.Prenom} ${s.e.Nom} – ${moment}`, EleveID: s.e.ID, InscriptionID: inscr.ID, DatePassation: date, Moment: moment };
    for (let d = 1; d <= 5; d++) {
      for (const k of ['Eleve', 'Titulaire', 'Parents']) {
        const off = k === 'Titulaire' ? -0.5 : k === 'Parents' ? 0.2 : 0;
        rec[`D${d}_${k}`] = clamp(Math.round((lvlQ + off + (rnd() - 0.5) * 1.6) * 100) / 100, 1, 5);
      }
      rec[`D${d}_Boussole`] = clamp(Math.round(lvlB + (rnd() - 0.5) * 1.6), 1, 4);
    }
    return add('RS_CPS', rec, date);
  };
  mkCPS(timeo, iTimeoPrev, '2026-05-19', 'Entrée', 2.6, 2);
  mkCPS(timeo, iTimeoPrev, '2026-06-17', 'Sortie', 3.2, 3);
  for (const s of E.filter(x => ['Léa', 'Noah', 'Kenan', 'Timéo'].includes(x.e.Prenom))) {
    mkCPS(s, s.i, '2026-09-02', 'Entrée', s.prof === 'good' ? 3.8 : s.prof === 'fragile' ? 2.9 : 3.2, s.prof === 'fragile' ? 2 : 3);
  }

  /* ---------- Actions ---------- */
  const A = [
    ['Léa', 'Noter les devoirs dans l\'agenda chaque jour', 'Élève', 'En cours', '2026-10-09', 'Mise en route'],
    ['Noah', 'Préparer une liste de questions pour le titulaire', 'Élève', 'Fait', '2026-09-18', 'Mise en route'],
    ['Kenan', 'Point avec la famille sur l\'organisation des devoirs', 'Parents', 'À faire', '2026-10-02', 'Mise en route'],
    ['Inès', 'Rechercher deux métiers à explorer en stage', 'Élève', 'Fait', '2026-09-25', 'Mise en route'],
    ['Maëlle', 'Rencontrer l\'enseignant·e de maths de la classe d\'origine', 'CM', 'À faire', '2026-10-09', 'Bilan intermédiaire'],
    ['Timéo', 'Reprendre les exercices du chapitre en cours en maths', 'Élève', 'En cours', '2026-10-05', 'Mise en route'],
    ['Léa', 'Transmettre l\'horaire de retour au titulaire', 'Titulaire', 'À faire', '2026-10-14', 'Bilan intermédiaire'],
  ];
  for (const [p, desc, resp, st, ech, orig] of A) {
    const s = E.find(x => x.e.Prenom === p);
    add('RS_Actions', {
      Title: desc.slice(0, 60), EleveID: s.e.ID, InscriptionID: s.i.ID, Description: desc, Responsable: resp,
      Statut: st, Origine: orig, Echeance: ech, NotesSuivi: '', DateCloture: st === 'Fait' ? addDays(ech, -1) : null,
    }, '2026-09-03');
  }

  /* ---------- Tâches de l'équipe ---------- */
  const TA = [
    ['Préparer la séance de rentrée V2', 'PL', 'À faire', '2026-10-09'],
    ['Envoyer les notes de V1 aux titulaires', 'OG', 'À faire', '2026-10-14'],
    ['Réserver la salle de théâtre pour V2', 'OG', 'À faire', '2026-10-05'],
    ['Rédiger les ancrages des 4 niveaux (proposition)', 'ME', 'En cours', '2026-10-30'],
    ['Commander le matériel d\'arts visuels', 'VO', 'Terminée', '2026-09-20'],
    ['Préparer une évaluation de maths de niveau classe', 'CM', 'À faire', '2026-10-08'],
  ];
  for (const [t, r, st, ech] of TA) {
    add('RS_Taches', { Title: t, Description: '', Responsable: r, Statut: st, CreePar: 'PL', Echeance: ech, DateCloture: st === 'Terminée' ? ech : null, EleveID: null }, '2026-09-01');
  }

  /* ---------- Orientation (entreprises fictives, sans coordonnées) ---------- */
  const ines = E[2];
  add('RS_Stages', { Title: 'Inès Arolle · ASE', EleveID: ines.e.ID, InscriptionID: ines.i.ID, Metier: 'Assistante socio-éducative', Entreprise: 'Crèche fictive Les Marmottes', Statut: 'Prévu', DateDebut: '2026-10-12', DateFin: '2026-10-14', Retour: '' }, '2026-09-28');
  add('RS_Stages', { Title: 'Inès Arolle · Laborantine', EleveID: ines.e.ID, InscriptionID: ines.i.ID, Metier: 'Laborantine', Entreprise: '', Statut: 'Demandé', DateDebut: null, DateFin: null, Retour: '' }, '2026-09-30');
  add('RS_Stages', { Title: 'Timéo Sorbier · Polymécanicien', EleveID: timeo.e.ID, InscriptionID: iTimeoPrev.ID, Metier: 'Polymécanicien', Entreprise: 'Atelier fictif SA', Statut: 'Effectué', DateDebut: '2026-06-10', DateFin: '2026-06-12', Retour: 'Ponctuel, très motivé ; à l\'aise avec les consignes orales.' }, '2026-06-01');
  add('RS_DocsOrientation', { Title: 'Inès Arolle · CV', EleveID: ines.e.ID, TypeDoc: 'CV', Destinataire: '', Statut: 'Terminé', DateMaj: '2026-09-29', Remarque: '' }, '2026-09-29');
  add('RS_DocsOrientation', { Title: 'Inès Arolle · Lettre', EleveID: ines.e.ID, TypeDoc: 'Lettre de motivation', Destinataire: 'Crèche fictive Les Marmottes', Statut: 'En cours', DateMaj: '2026-10-01', Remarque: 'Relire la formule finale' }, '2026-10-01');
  add('RS_DocsOrientation', { Title: 'Timéo Sorbier · CV', EleveID: timeo.e.ID, TypeDoc: 'CV', Destinataire: '', Statut: 'En cours', DateMaj: '2026-06-05', Remarque: '' }, '2026-06-05');

  void iJules;
  if (!exemples) {
    // Départ à vide : on garde seulement les listes de référence (enseignant·es, cours, volées).
    for (const l of Object.keys(lists)) if (!['RS_Enseignants', 'RS_Cours', 'RS_Volees'].includes(l)) lists[l] = [];
  }
  return { lists };
}
