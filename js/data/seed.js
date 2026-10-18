// Bac à sable : enseignant·es = initiales réelles de l'équipe ; ÉLÈVES FICTIFS (noms inventés, plantes des Alpes).
// Générées de façon déterministe : chaque testeur part du même jeu de données.
import { CONFIG } from '../config.js';
import { addDays, semaineCle, phaseOf, cleDoublon, DOMAINES, groupeCours } from '../domain.js';

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
  const [V5] = V; // 2025-26 V5 : volée d'exemple, complète
  if (!exemples) return { lists };
  buildExemples({ add, rnd, pick, clamp, T, C, coursByTitle, V5 });
  return { lists };
}

/* =====================================================================
   VOLÉE D'EXEMPLE : 2025-26 V5 (18.05–19.06.2026), six profils fictifs
   ===================================================================== */
const PROFILS = {
  // note : début → fin ; ct : cotation C/T début → fin ; cps : questionnaires entrée → sortie ; bou : boussole entrée → sortie
  stable: { label: 'sans évolution', note: [4.0, 4.0], ct: [2.6, 2.6], cps: [3.0, 3.05], bou: [2, 2] },
  petit1: { label: 'petite amélioration', note: [3.7, 4.2], ct: [2.3, 2.9], cps: [2.8, 3.2], bou: [2, 3] },
  petit2: { label: 'petite amélioration', note: [3.8, 4.3], ct: [2.5, 3.0], cps: [2.9, 3.3], bou: [2, 2] },
  net: { label: 'nette amélioration', note: [3.3, 5.1], ct: [1.9, 3.7], cps: [2.4, 3.9], bou: [1, 3] },
  aggrave: { label: 'aggravation', note: [4.5, 3.1], ct: [3.1, 1.5], cps: [3.3, 2.4], bou: [3, 2] },
  bon: { label: 'bon niveau stable', note: [5.0, 5.2], ct: [3.4, 3.7], cps: [3.7, 3.9], bou: [3, 3] },
};
const ELEVES_EX = [
  { p: 'Noah', n: 'Gentiane', deg: '9CO', cl: '9CO1', tit: 'Mme Saule', prof: 'stable' },
  { p: 'Maëlle', n: 'Myrtille', deg: '9CO', cl: '9CO4', tit: 'M. Frêne', prof: 'petit1' },
  { p: 'Timéo', n: 'Sorbier', deg: '11CO', cl: '11CO1', tit: 'Mme Aulne', prof: 'petit2' },
  { p: 'Léa', n: 'Edelweiss', deg: '10CO', cl: '10CO3', tit: 'M. Tilleul', prof: 'net' },
  { p: 'Kenan', n: 'Mélèze', deg: '10CO libérable', cl: '10CO5', tit: 'Mme Charme', prof: 'aggrave' },
  { p: 'Inès', n: 'Arolle', deg: '11CO', cl: '11CO2', tit: 'M. Peuplier', prof: 'bon' },
];
// Textes des bilans, par profil (faits observables, sans élément médical ni familial)
const BILANS_EX = {
  stable: {
    dom: [1, 2], obj: 'Rendre mes devoirs de français et de maths chaque semaine',
    appui: 'Ponctuel ; bonne relation avec le coach ; participe volontiers en théâtre et en sport',
    frag: 'Décroche sur les tâches écrites de plus de 15 minutes ; rarement de questions spontanées',
    avancee: 'Devoirs rendus 2 semaines sur 3. Notes stables autour de 4 (maths 4,0 ; français 3,9). Pas de progrès net, pas de recul.',
    ajust: 'Objectif maintenu ; ajout d\'un point d\'étape le mercredi avec le coach pour vérifier l\'agenda.',
    esquisse: 'Retour en 9CO1 à la rentrée avec un horaire complet ; suivi agenda à poursuivre.',
    plan: 'Retour complet en 9CO1 à la rentrée. Point avec la titulaire après 3 semaines. Agenda vérifié chaque mercredi en classe d\'origine.',
    sortie: 'Noter et rendre chaque devoir dans les délais',
  },
  petit1: {
    dom: [3, 1], obj: 'Demander de l\'aide avant de bloquer sur un exercice',
    appui: 'Soigneuse ; à l\'aise en arts visuels et en ACM ; accepte les conseils',
    frag: 'Se fige devant un exercice nouveau ; évite de parler devant le groupe',
    avancee: 'A demandé de l\'aide 4 fois cette semaine (0 la première). Notes en hausse en maths : 3,6 puis 4,0.',
    ajust: 'Ajouter : lever la main une fois par cours en français.',
    esquisse: 'Retour progressif : branches artistiques d\'abord, puis français et maths.',
    plan: 'Retour en 9CO4 avec une carte « je demande de l\'aide » validée avec le titulaire. Point après 2 semaines.',
    sortie: 'Demander de l\'aide à l\'enseignant·e au plus tard après 5 minutes de blocage',
  },
  petit2: {
    dom: [1, 5], obj: 'Organiser mon travail pour préparer les évaluations',
    appui: 'Motivé par l\'orientation (stage en mécanique) ; bon en sport ; ponctuel',
    frag: 'Prépare les évaluations la veille ; oublie le matériel une fois sur trois',
    avancee: 'Utilise une fiche de préparation pour 2 évaluations sur 3. Notes : 3,8 → 4,1 en moyenne.',
    ajust: 'Objectif maintenu ; fiche de préparation étendue à l\'allemand.',
    esquisse: 'Retour en 11CO1 ; lien avec la recherche de place d\'apprentissage.',
    plan: 'Retour en 11CO1. Fiche de préparation utilisée dans toutes les branches. Point orientation avec ET en septembre.',
    sortie: 'Préparer chaque évaluation avec la fiche, au moins 3 jours avant',
  },
  net: {
    dom: [3, 4], obj: 'Rester en classe toute la séance et terminer les tâches',
    appui: 'Curieuse ; très bonne en théâtre ; s\'appuie sur les adultes quand la relation est établie',
    frag: 'Quitte la classe quand une tâche paraît trop difficile ; travail non terminé',
    avancee: 'Plus aucune sortie de classe depuis 10 jours. Notes en nette hausse : 3,3 → 4,6 (maths, français, sciences).',
    ajust: 'Nouvel objectif : réussir une évaluation de niveau classe sans aide en maths.',
    esquisse: 'Retour en 10CO3 dès la rentrée, toutes branches.',
    plan: 'Retour complet en 10CO3. Évaluation de maths réussie seule (5,0) : à présenter au titulaire comme point d\'appui.',
    sortie: 'Garder une stratégie de pause en classe (respiration, puis reprise) au lieu de sortir',
  },
  aggrave: {
    dom: [3, 2], obj: 'Venir à chaque cours avec mon matériel',
    appui: 'Bonnes bases en maths ; s\'exprime bien à l\'oral',
    frag: 'Conflits avec des camarades ; travail irrégulier',
    avancee: 'Situation en recul : 3 devoirs non faits par semaine, cotations à 1-2 en fin de période. Notes : 4,5 → 3,6.',
    ajust: 'Objectif réduit : être présent·e et au travail les 20 premières minutes de chaque cours.',
    esquisse: 'Retour à discuter : une deuxième volée est à envisager.',
    plan: 'Pas de retour complet. Proposition d\'une deuxième volée en V1 ; retour partiel en sport et en musique en attendant.',
    sortie: 'Être au travail les 20 premières minutes de chaque cours',
  },
  bon: {
    dom: [5, 2], obj: 'Retrouver confiance pour reprendre le rythme de la classe',
    appui: 'Autonome ; bons résultats ; projet professionnel clair (ASE)',
    frag: 'Anxiété avant les évaluations écrites ; s\'isole du groupe',
    avancee: 'Notes stables à 5 et plus. Participe aux travaux de groupe depuis la semaine 2.',
    ajust: 'Objectif maintenu ; ajouter un exposé en français devant le groupe.',
    esquisse: 'Retour en 11CO2 sans aménagement particulier.',
    plan: 'Retour complet en 11CO2. Exposé réussi : à valoriser auprès de la titulaire.',
    sortie: 'Présenter un travail oral en classe d\'origine durant le premier mois',
  },
};
const OBS_BY_TREND = {
  up: ['A demandé de l\'aide au bon moment.', 'Travail terminé seul·e.', 'S\'est remis·e au travail sans rappel.', 'Participation spontanée à l\'oral.'],
  flat: ['Travail commencé, terminé avec un rappel.', 'Mise au travail lente en début de séance.', 'Matériel complet.', 'Peu de questions, travail moyen.'],
  down: ['Matériel oublié.', 'A quitté la tâche après 10 minutes.', 'Téléphone sorti malgré le rappel.', 'Conflit avec un camarade, réglé après la pause.', 'Refus de commencer l\'exercice.'],
};
const COACH_T = {
  'Décompression': ['Faire connaissance, règles de la classe', 'Objectif personnel : premières pistes', 'Ce qui m\'aide, ce qui me freine'],
  'Remobilisation': ['Planifier la semaine dans l\'agenda', 'Demander de l\'aide : quand et à qui', 'Préparer une évaluation'],
  'Ré-exposition': ['Plan de retour : horaire de la classe d\'origine', 'Préparer la rencontre avec le titulaire', 'Situations difficiles en classe : que faire ?'],
};
const SUJETS = {
  'Musique': ['Rythmes', 'Lecture de notes', 'Chant', 'Écoute'],
  'Mathématiques': ['Calcul mental', 'Fractions', 'Proportionnalité', 'Équations'],
  'Sciences': ['Cellule', 'Le système solaire', 'États de la matière', 'Énergie'],
  'Anglais': ['Vocabulaire', 'Present simple', 'Compréhension orale', 'Expression écrite'],
  'Méthodo / Orientation': ['Agenda', 'Portrait de métier', 'CV', 'Entretien simulé'],
  'Allemand': ['Wortschatz', 'Perfekt', 'Hörverstehen', 'Dialog'],
  'Français': ['Compréhension de texte', 'Orthographe', 'Production écrite', 'Exposé'],
  'Théâtre': ['Improvisation', 'Diction', 'Scène à deux', 'Présentation finale'],
  'ACM': ['Mesures et tracés', 'Couture', 'Projet bois', 'Finitions'],
  'Arts visuels': ['Perspective', 'Couleurs', 'Portrait', 'Projet libre'],
  'Sport': ['Endurance', 'Coordination', 'Jeux collectifs', 'Gymnastique'],
};
const ETAYAGE = ['Consignes reformulées oralement', 'Aide sollicitée par l\'élève', 'Temps supplémentaire de 10 minutes', 'Exemple résolu à disposition', 'Tâche découpée en étapes'];

function buildExemples({ add, rnd, pick, clamp, T, C, coursByTitle, V5 }) {
  const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
  const span = days(V5.DateDebut, V5.DateFin);
  const lerp = ([a, b], date) => a + (b - a) * Math.max(0, Math.min(1, days(V5.DateDebut, date) / span));
  const plus = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const SIGLES = ['ABR', 'BCH', 'CDU', 'DMO', 'EFA', 'FRO', 'GVI', 'HPE', 'JLA', 'KMA'];
  const CRE = '2026-05-15';
  const PL = T[0].Title;

  const E = ELEVES_EX.map(x => {
    const pr = PROFILS[x.prof];
    const e = add('RS_Eleves', { Title: `${x.n} ${x.p}`, Nom: x.n, Prenom: x.p, CleDoublon: cleDoublon(x.n, x.p), Statut: 'Archivé' }, CRE);
    const i = add('RS_Inscriptions', {
      Title: `${x.n} ${x.p} – ${V5.Title}`, EleveID: e.ID, VoleeID: V5.ID, CleUnique: `E${e.ID}-V${V5.ID}`,
      Degre: x.deg, ClasseOrigine: x.cl, Titulaire: x.tit,
      ProfFrancais: pick(SIGLES), ProfAllemand: pick(SIGLES), ProfAnglais: pick(SIGLES), ProfMaths: pick(SIGLES), ProfSciences: pick(SIGLES),
      StatutInscription: 'Terminée',
    }, CRE);
    // talent par branche : décalage fixe, pour que les branches ne soient pas toutes identiques
    const talent = Object.fromEntries(C.map(c => [c.rec.Title, (rnd() - 0.5) * 0.8]));
    if (x.prof === 'net') talent['Théâtre'] = 0.6;
    if (x.prof === 'aggrave') { talent['Mathématiques'] = 0.4; talent['Sport'] = 0.5; }
    if (x.prof === 'petit1') { talent['Arts visuels'] = 0.5; talent['ACM'] = 0.5; }
    return { ...x, pr, e, i, talent, trend: pr.note[1] - pr.note[0] > 0.3 ? 'up' : pr.note[1] - pr.note[0] < -0.3 ? 'down' : 'flat' };
  });

  /* ---- Suivis et devoirs, toute la volée ---- */
  for (let monday = V5.DateDebut; monday <= V5.DateFin; monday = plus(monday, 7)) {
    for (const c of C) {
      for (const day of c.days) {
        const date = plus(monday, day);
        if (date < V5.DateDebut || date > V5.DateFin) continue;
        const phase = phaseOf(date, V5);
        for (const s of E) {
          if (rnd() < (s.prof === 'aggrave' && date > '2026-06-05' ? 0.18 : 0.05)) continue; // absences
          const base = lerp(s.pr.ct, date);
          const comp = clamp(Math.round(base + (rnd() - 0.5) * 1.1), 1, 4);
          const trav = clamp(Math.round(base - 0.15 + (rnd() - 0.5) * 1.1), 1, 4);
          const coaching = c.rec.EstCoaching;
          add('RS_Suivis', {
            Title: `${s.p} ${s.n} · ${c.rec.Title} · ${date}`, EleveID: s.e.ID, InscriptionID: s.i.ID, CoursID: c.rec.ID, EnseignantID: c.rec.EnseignantID,
            DateSuivi: date, SemaineCle: semaineCle(date), Portee: c.portee, Phase: phase, Comportement: coaching ? null : comp, Travail: coaching ? null : trav,
            Observation: !coaching && rnd() < 0.25 ? pick(OBS_BY_TREND[comp <= 2 && s.trend === 'down' ? 'down' : s.trend]) : '',
            CoachTravaille: coaching ? pick(COACH_T[phase]) : '',
            CoachProgres: coaching ? (s.trend === 'down' && phase !== 'Décompression' ? 'Point de vigilance : objectif non tenu cette semaine.' : s.trend === 'up' ? 'Progrès : a tenu son objectif cette semaine.' : 'Stable : objectif tenu en partie.') : '',
          }, date);
          const p = { stable: 0.08, petit1: 0.07, petit2: 0.08, net: 0.1, aggrave: 0.15, bon: 0.02 }[s.prof] * (s.prof === 'net' ? (date < '2026-06-01' ? 1.6 : 0.3) : s.prof === 'aggrave' ? (date > '2026-06-01' ? 3.5 : 0.8) : 1);
          if (['Français', 'Mathématiques', 'Allemand', 'Anglais', 'Sciences'].includes(c.rec.Title) && rnd() < p) {
            add('RS_Devoirs', {
              Title: `${s.p} ${s.n} · ${c.rec.Title} · ${date}`, EleveID: s.e.ID, InscriptionID: s.i.ID, CoursID: c.rec.ID, EnseignantID: c.rec.EnseignantID,
              DateConstat: date, SemaineCle: semaineCle(date), Phase: phase, SansConsequence: phase === 'Décompression',
              Description: pick(['Exercices p. 34', 'Fiche de vocabulaire', 'Lecture du chapitre 3', 'Fiche de révision', 'Exercices 5 à 9']),
              Statut: date >= '2026-06-15' ? 'Ouvert' : rnd() < (s.prof === 'aggrave' ? 0.4 : 0.8) ? 'Rattrapé' : 'Non rattrapé',
              DateResolution: date >= '2026-06-15' ? null : plus(date, 2),
            }, date);
          }
        }
      }
    }
  }

  /* ---- Évaluations : toutes les branches (formatif en décompression, puis 2 notes étayées, puis 2 notes normales) ---- */
  const evalDates = ['2026-05-20', '2026-05-28', '2026-06-04', '2026-06-10', '2026-06-16'];
  C.filter(c => !c.rec.EstCoaching).forEach((c, k) => {
    const sujets = SUJETS[c.rec.Title] || ['Évaluation 1', 'Évaluation 2', 'Évaluation 3', 'Évaluation 4'];
    evalDates.forEach((d0, j) => {
      const date = plus(d0, (k % 3) - 1); // dates étalées selon la branche
      const phase = phaseOf(date, V5);
      const sujet = j === 0 ? `${sujets[0]} (diagnostic)` : sujets[Math.min(j - 1, sujets.length - 1)];
      for (const s of E) {
        const target = lerp(s.pr.note, date) + s.talent[c.rec.Title];
        const rec = {
          Title: `${s.p} ${s.n} · ${c.rec.Title} · ${sujet}`, EleveID: s.e.ID, InscriptionID: s.i.ID, CoursID: c.rec.ID, EnseignantID: c.rec.EnseignantID,
          DateEval: date, Phase: phase, Sujet: sujet, Coefficient: j === 4 ? 2 : 1, ResultatFormatif: '', Note: null, Etayage: '',
        };
        if (phase === 'Décompression') rec.ResultatFormatif = target >= 4.6 ? 'Réussi seul' : target >= 3.8 ? 'Avec aide' : 'Pas encore';
        else {
          rec.Note = clamp(Math.round((target + (rnd() - 0.5) * 0.5) * 10) / 10, 1, 6);
          if (phase === 'Remobilisation') rec.Etayage = pick(ETAYAGE);
        }
        add('RS_Evaluations', rec, date);
      }
    });
  });

  /* ---- Bilans complets ---- */
  for (const s of E) {
    const b = BILANS_EX[s.prof];
    const common = (type, date) => ({
      Title: `${s.p} ${s.n} · ${type}`, InscriptionID: s.i.ID, EleveID: s.e.ID, TypeBilan: type,
      CleUnique: `I${s.i.ID}-${{ 'Mise en route': 'MR', 'Intermédiaire': 'INT', 'Final': 'FIN' }[type]}`,
      DateBilan: date, Participants: `${s.p}, ${PL} (coaching), ${s.tit}${type === 'Final' ? ', ME (coordination)' : ''}`,
      DomainesPrioritaires: [], Objectif: '', PointsAppui: '', Fragilites: '', Avancee: '', AjustementObjectif: '', PlanRetour: '', ObjectifSortie: '',
      PassationTitulaire: false, DatePassation: null, DateSignatureEleve: date, DateValidationCoord: plus(date, 1),
    });
    add('RS_Bilans', { ...common('Mise en route', '2026-05-20'), DomainesPrioritaires: b.dom.map(d => DOMAINES[d - 1]), Objectif: b.obj, PointsAppui: b.appui, Fragilites: b.frag }, '2026-05-20');
    add('RS_Bilans', { ...common('Intermédiaire', '2026-06-03'), Avancee: b.avancee, AjustementObjectif: b.ajust, PlanRetour: b.esquisse }, '2026-06-03');
    add('RS_Bilans', { ...common('Final', '2026-06-16'), PlanRetour: b.plan, ObjectifSortie: b.sortie, PassationTitulaire: true, DatePassation: '2026-06-18' }, '2026-06-16');
  }

  /* ---- CPS : entrée et sortie pour chacun ---- */
  for (const s of E) {
    for (const [moment, date, t] of [['Entrée', '2026-05-19', 0], ['Sortie', '2026-06-17', 1]]) {
      const rec = { Title: `${s.p} ${s.n} – ${moment}`, EleveID: s.e.ID, InscriptionID: s.i.ID, DatePassation: date, Moment: moment };
      const q = s.pr.cps[0] + (s.pr.cps[1] - s.pr.cps[0]) * t;
      const b = s.pr.bou[t];
      for (let d = 1; d <= 5; d++) {
        const prio = BILANS_EX[s.prof].dom.includes(d) ? -0.35 : 0.1; // domaines prioritaires plus bas
        for (const [k, off] of [['Eleve', 0.15], ['Titulaire', -0.25], ['Parents', 0.05]]) {
          let v = q + prio + off + (rnd() - 0.5) * 0.5;
          if (s.prof === 'aggrave' && t === 1 && d === 3 && k === 'Eleve') v = 3.6; // l'élève se voit bien, le titulaire non : écart à discuter
          if (s.prof === 'aggrave' && t === 1 && d === 3 && k === 'Titulaire') v = 1.7;
          rec[`D${d}_${k}`] = clamp(Math.round(v * 100) / 100, 1, 5);
        }
        rec[`D${d}_Boussole`] = clamp(b + (prio < 0 && t === 0 ? -1 : 0), 1, 4);
      }
      add('RS_CPS', rec, date);
    }
  }

  /* ---- Actions (volée terminée : la plupart closes) ---- */
  const A = {
    stable: [['Vérifier l\'agenda chaque mercredi avec le coach', 'Élève', 'Fait'], ['Transmettre l\'horaire de retour à la titulaire', 'Titulaire', 'Fait']],
    petit1: [['Préparer une carte « je demande de l\'aide »', 'Élève', 'Fait'], ['Présenter la carte au titulaire', 'Titulaire', 'En cours']],
    petit2: [['Fiche de préparation pour chaque évaluation', 'Élève', 'Fait'], ['Rendez-vous orientation pour la place d\'apprentissage', 'ET', 'À faire']],
    net: [['Stratégie de pause en classe (respiration, reprise)', 'Élève', 'Fait'], ['Présenter la réussite en maths au titulaire', 'PL', 'Fait']],
    aggrave: [['Venir avec le matériel complet', 'Élève', 'Abandonnée'], ['Point avec la famille sur la deuxième volée', 'ME', 'À faire'], ['Retour partiel en sport et musique', 'Titulaire', 'En cours']],
    bon: [['Préparer un exposé de 5 minutes', 'Élève', 'Fait'], ['Confirmer le stage ASE', 'ET', 'Fait']],
  };
  for (const s of E) {
    A[s.prof].forEach(([desc, resp, st], k) => add('RS_Actions', {
      Title: desc.slice(0, 60), EleveID: s.e.ID, InscriptionID: s.i.ID, Description: desc, Responsable: resp, Statut: st,
      Origine: k === 0 ? 'Mise en route' : 'Bilan final', Echeance: k === 0 ? '2026-06-05' : '2026-06-26', NotesSuivi: '',
      DateCloture: ['Fait', 'Abandonnée'].includes(st) ? (k === 0 ? '2026-06-04' : '2026-06-17') : null,
    }, k === 0 ? '2026-05-20' : '2026-06-16'));
  }

  /* ---- Orientation (11CO) ---- */
  const ines = E.find(x => x.prof === 'bon'), timeo = E.find(x => x.prof === 'petit2');
  add('RS_Stages', { Title: 'Inès Arolle · ASE', EleveID: ines.e.ID, InscriptionID: ines.i.ID, Metier: 'Assistante socio-éducative', Entreprise: 'Crèche fictive Les Marmottes', Statut: 'Effectué', DateDebut: '2026-06-08', DateFin: '2026-06-10', Retour: 'Très à l\'aise avec les enfants ; ponctuelle.' }, '2026-06-01');
  add('RS_Stages', { Title: 'Timéo Sorbier · Polymécanicien', EleveID: timeo.e.ID, InscriptionID: timeo.i.ID, Metier: 'Polymécanicien', Entreprise: 'Atelier fictif SA', Statut: 'Effectué', DateDebut: '2026-06-10', DateFin: '2026-06-12', Retour: 'Motivé ; consignes orales bien suivies.' }, '2026-06-01');
  add('RS_DocsOrientation', { Title: 'Inès Arolle · CV', EleveID: ines.e.ID, TypeDoc: 'CV', Destinataire: '', Statut: 'Terminé', DateMaj: '2026-06-02', Remarque: '' }, '2026-06-02');
  add('RS_DocsOrientation', { Title: 'Timéo Sorbier · Lettre', EleveID: timeo.e.ID, TypeDoc: 'Lettre de motivation', Destinataire: 'Atelier fictif SA', Statut: 'En cours', DateMaj: '2026-06-15', Remarque: 'Relire la formule finale' }, '2026-06-15');
}
