# RessourceS — version web de test

Application de suivi des élèves de la Classe RessourceS, reprise de l'app Power Apps.
**Version de test : données fictives uniquement.**

## 1. Publier sur GitHub Pages (≈ 10 minutes)

1. Sur github.com : **New repository** → nom `ressources` → *Public* → **Create repository**.
   (Dépôt privé : GitHub Pages l'accepte avec un compte payant ou l'offre étudiante GitHub Education.)
2. **Add file → Upload files** → glisser **le contenu** du dossier (`index.html`, `css/`, `fonts/`, `icons/`, `js/`, `manifest.webmanifest`, `LISEZMOI.md`), pas le dossier lui-même → **Commit changes**.
3. **Settings → Pages** → *Source* : **Deploy from a branch** → branche `main`, dossier `/ (root)` → **Save**.
4. Après 1 à 2 minutes, l'adresse s'affiche en haut de la page Pages, par exemple
   `https://7nel.github.io/ressources/`. C'est le lien à envoyer aux collègues.

Pour mettre à jour : **Add file → Upload files** à nouveau, avec les fichiers modifiés.

> Ouvrir `index.html` en double-cliquant ne fonctionne pas (le navigateur bloque les modules).
> Il faut passer par GitHub Pages, ou un petit serveur local : `python3 -m http.server` dans le dossier.

## 2. Ce que les collègues doivent savoir

- Chacun·e choisit **ses initiales** au premier lancement (PL, ME, CM, ET, DAH, OG, DA, VO, XG) : cela simule la connexion Microsoft et affiche ses propres cours. PL et ME ont le rôle coordination.
- **Date** : l'app s'ouvre à la date du jour ; un clic sur la date de l'accueil permet d'en choisir une autre.
- **Échange avec l'équipe** (menu de gauche) : voir la section 2 bis.
- **Passer d'un élève à l'autre** : depuis le dossier, l'orientation, le coaching, les CPS et les bilans, la barre en haut (« ‹ Prénom Nom   2 sur 6 · volée   Prénom Nom › ») ouvre l'élève voisin sur le même écran, par ordre alphabétique de la volée. Raccourcis : **Alt+Maj+←** et **Alt+Maj+→** (inactifs dans un champ de saisie). Si un formulaire est modifié, l'app demande d'enregistrer ou non avant de changer d'élève.
- **Profil** : clic sur ses initiales en bas du menu (ou en haut sur téléphone). **Mode clair / sombre** : bouton lune / soleil à côté.
- **Aucun vrai nom d'élève**, même pour essayer : le code est public et la version de test n'est pas validée (LIPDA).

## 2 ter. Navigateur et installation comme application

- **Navigateur recommandé : Microsoft Edge ou Google Chrome, sur ordinateur.** Ce sont les seuls à pouvoir lire et écrire
  directement dans le dossier OneDrive (chargement à l'ouverture ; enregistrement automatique dans l'app installée, manuel dans un onglet).
- **Installer comme une application** (fenêtre à part, icône dans le menu Démarrer ou le Dock) :
  - Edge : menu `…` → Applications → **Installer RessourceS** (ou l'icône ⊕ dans la barre d'adresse).
  - Chrome : icône d'installation dans la barre d'adresse, ou menu `⋮` → Caster, enregistrer et partager → **Installer la page en tant qu'application**.
  - iPhone/iPad (Safari) : Partager → **Sur l'écran d'accueil**. Android (Chrome) : menu → **Installer l'application**.
    Sur téléphone, l'échange reste manuel (pas d'accès direct au dossier).
- L'application installée se met à jour seule : c'est toujours la version publiée sur GitHub.

## 2 bis. Échange provisoire par OneDrive

Créer un dossier OneDrive partagé avec l'équipe (ex. « RessourceS – échange ») et le synchroniser sur chaque ordinateur
(OneDrive → « Ajouter un raccourci à Mon OneDrive » puis synchronisation).

**Chrome ou Edge sur ordinateur (recommandé, presque sans manipulation)**
- 1re fois : « Sauvegarder ma version » → choisir le dossier partagé → autoriser.
- Ensuite, **dans l'app installée** (voir 2 ter) : **enregistrement automatique**, 1,5 s après chaque modification et à la fermeture de la fenêtre.
  Avant chaque écriture, l'app relit tout le dossier (son propre fichier compris) et le fusionne : une version plus récente,
  venue d'un autre appareil ou d'un·e collègue, est intégrée et jamais écrasée. Si des changements arrivent pendant une saisie, l'écran n'est pas redessiné ; il le sera au suivant.
- **Dans un onglet** Chrome ou Edge (app non installée) : enregistrement manuel. « Sauvegarder ma version » écrit `RessourceS_<initiales>.json` dans le dossier après avoir intégré les versions des collègues ;
  « Non enregistré » reste affiché et un avertissement apparaît à la fermeture.
- Si le navigateur a retiré l'autorisation du dossier, l'enregistrement automatique s'arrête et affiche « Échec d'enregistrement » : un clic sur « Sauvegarder » redonne l'accès.
- À l'ouverture, les versions de l'équipe se chargent seules si le navigateur a gardé l'autorisation ;
  sinon un clic sur « Charger les versions » suffit.

**Téléphone**
- « Sauvegarder » ouvre le menu de partage avec le nom exact du fichier : « Enregistrer dans Fichiers » (ou l'app OneDrive) → dossier partagé → **Remplacer**.
- Si le téléphone ajoute « (1) » au nom, l'app lit quand même ce fichier ; la prochaine sauvegarde depuis un ordinateur (Chrome/Edge) fusionne et supprime ces copies.

**Safari, Firefox**
- « Sauvegarder ma version » télécharge `RessourceS_<initiales>.json` : le glisser dans le dossier partagé (remplacer l'ancien).
- « Charger les versions » : sélectionner tous les fichiers du dossier (Ctrl+A / Cmd+A).

**État de la sauvegarde** (menu à gauche ; barre du haut sur téléphone, où un clic sur l'état ouvre l'explication complète) :
« Non enregistré », « Enregistrement… », « ✓ Enregistré » (le fichier du dossier a été relu et comparé ; l'app ne peut pas vérifier que OneDrive l'a déjà transmis aux collègues),
« ↓ Copie téléchargée » (Safari, Firefox, téléphone : à déposer dans le dossier partagé, qui n'est pas à jour tant que ce n'est pas fait) ou « Échec d'enregistrement »
(y compris quand une copie de secours a été téléchargée : le dossier n'a rien reçu). Un échec reste affiché jusqu'à ce qu'une écriture réussisse ;
cliquer sur « Sauvegarder » pour réessayer. Les changements d'état sont annoncés aux lecteurs d'écran (zone d'annonce discrète) ; non vérifié avec VoiceOver ou TalkBack.

**Alerte du dossier relié** (Chrome ou Edge sur ordinateur, dossier relié) : un bandeau en haut de l'écran signale
- un dossier **figé** : pendant une volée, aucune version d'un·e collègue n'a changé depuis 3 jours d'école (seuil pratique, à ajuster). C'est ce qui arrive quand OneDrive duplique ou déconnecte le dossier et que l'app lit l'ancienne copie (cas du 2 au 11 novembre 2026) ;
- un dossier **introuvable** : OneDrive l'a renommé, déplacé ou recréé.

Le bandeau propose « Changer de dossier » (relier le bon « appCR », puis l'app le charge) et, pour un dossier figé, « Ignorer » (masqué jusqu'à la prochaine version reçue). Les collègues y lisent aussi « prévenez PL ».
« Dossier et collègues », sous l'état de la sauvegarde, montre le dossier relié et la date de la dernière version de chacun·e : on y voit aussi qui n'enregistre pas.

**Réglages > Données de ce navigateur** : « Remplacer par un fichier… » vérifie le fichier en entier avant de toucher aux données
(un fichier invalide, incomplet ou vide est refusé, vos données restent intactes) et demande confirmation en indiquant ce que contient le fichier.
« Réinitialiser les données » remplace tout par la base de départ : enseignant·es, cours et volées, sans aucun élève.

Règles de fusion : rien n'est jamais supprimé ; si deux personnes modifient le même élément, la modification la plus récente l'emporte.
**Aucune copie dans le navigateur** (réglage « Ne rien garder dans ce navigateur », activé par défaut) :
les données ne vivent qu'en mémoire pendant l'utilisation. À la fermeture de l'onglet, rien ne reste sur l'appareil ;
à l'ouverture, l'app relit le dossier partagé. Le réglage peut être désactivé pour tester seul·e.

Un point orange signale des modifications non sauvegardées ; le navigateur avertit si on ferme la page avant d'avoir sauvegardé.

⚠ Solution provisoire, pour données fictives uniquement : des fichiers JSON dans un dossier ne protègent pas des données réelles d'élèves.

## 2 quater. Questionnaires CPS par Microsoft Forms

- Trois Forms (élève, titulaire, parents), compte edu.vs.ch, sans connexion demandée. Leurs réponses arrivent seules dans
  `CPS_Eleve.xlsx`, `CPS_Titulaire.xlsx`, `CPS_Parents.xlsx`, dans le sous-dossier **CPS** du dossier d'échange.
- **QR codes** : dossier de l'élève → Plus → Compétences psychosociales (CPS) → « QR codes Forms ». Choisir le moment (Entrée / Sortie / Autre), imprimer,
  remettre chaque fiche en main propre. Le code de l'élève (6 caractères) est créé à la première impression et partagé avec l'équipe.
- **Intégrer** : CPS → « Réponses Forms » (Chrome/Edge : lecture directe du dossier ; ailleurs : choisir les 3 classeurs).
  Le site calcule les 5 scores (items inversés 6 − x) et ne garde que ces scores. Doublons et codes inconnus sont signalés.
- **Fiche imprimable** : bouton « Fiche » sur chaque réponse (30 items + scores), relue dans le classeur, pour le dossier papier.
- La boussole reste saisie à la main (« + Saisie à la main »).
- Si un Forms est recréé : recopier `id`, `qCode`, `qMoment` de son nouveau lien prérempli dans `js/config.js` (CPS_FORMS).

## 3. Contenu

| Menu | Écrans |
|---|---|
| Accueil | Rampe de la volée, tuiles (dont devoirs à rendre et évaluations de la semaine), accès rapide aux cours, niveau 1 de la semaine, ce qui va mieux, retenue du vendredi, absences (vision globale, voir 4 ter), À faire |
| Élèves | Liste, nouvel élève (alerte de doublon), dossier : chronologie des deux dernières semaines (suivis, absences, devoirs non faits, évaluations et actions échues, jour par jour), synthèse hebdomadaire avec légende des niveaux, tous les suivis, évaluations, devoirs, actions, bilans, inscription (repliée). Le bouton « + Nouveau suivi » est toujours en haut ; le menu **Plus** regroupe orientation, fiche coaching imprimable, CPS, modification du dossier, nouvelle inscription et clôture. Après « Rattrapé » ou « Non rattrapé », le message propose **Annuler** pendant 9 secondes ; bouton « Bilan CR » en haut (coordination) : évolution des élèves pendant leur passage, agrégée et anonyme, sur une ou plusieurs volées (additionnées, sans comparaison) : phases de chaque volée, élèves accueillis, profils d'évolution (une pastille par élève, « 3 sur 8 ») avec une phrase « En bref », cotations C/T par phase et par famille, notes, CPS entrée/sortie par domaine, heures d'absence (total, moyenne par élève, élèves sans absence, par phase), bilans réalisés. Visible par toute l'équipe. Boutons « Exporter (CSV) » (tableau pour Excel : séparateur « ; », virgule décimale, UTF-8) et « Imprimer / PDF », tous deux sans nom d'élève, pour le rapport de fonctionnement. Une volée en cours est marquée provisoire |
| Saisie | Saisie de groupe (cotations ou évaluation), saisie individuelle, évaluation selon la phase (R5), absences (voir 4 ter) |
| Notes | Filtres, moyennes pondérées, graphique ; Ma branche |
| Suivi | Une semaine à la fois (semaine en cours par défaut, boutons semaine précédente / suivante dans la volée) : un tableau avec une ligne par élève et une colonne par cours coté (pastilles C et T), avec sous chaque nom le décompte de la semaine des retards et du matériel manquant, une colonne « Absences » (heures de la semaine et total depuis le début de la volée), puis une colonne « Actions (A) et observations (O) » : actions en cours (échéance en tête, retards signalés) et observations écrites de la semaine. Les élèves à discuter (niveau 1, action en retard) sont en tête ; un bouton passe à l'ordre alphabétique. Au-dessus du tableau, un volet repliable « Tendance depuis le début de la volée » montre une petite courbe par élève (moyenne hebdomadaire de C en trait plein et de T en pointillé, de 1 à 4), avec un fond par semaine passée : rouge translucide si l'élève a manqué plus de la moitié des heures de classe de la semaine (sans les Cours normaux) ou n'a aucune cotation, orange translucide s'il a plus de 7 h d'absence dans la semaine. Vue limitée à vos cours et à vos actions en « Ma vue » |
| Organisation | Trois onglets. **Pour moi** : mes tâches, les actions sur les élèves dont je suis responsable, les devoirs à contrôler et les évaluations à saisir de mes cours, groupés par échéance (maintenant, cette semaine, plus tard, sans échéance) ; tâches et actions se terminent d'un clic (✓). **Devoirs et évaluations** : choix « Mes cours », « Tous les cours » ou un cours ; à contrôler, devoirs non rendus par élève (rattrapé / non rattrapé), à venir semaine par semaine et, pour un seul cours, ce qui est déjà fait dans la volée (nombre de résultats saisis). **Équipe** : tâches et actions ouvertes de tout le monde, par responsable, ou terminées. Boutons « + Tâche », « + Devoir », « + Évaluation ». Les anciennes adresses `#/taches` et `#/travaux` ouvrent l'onglet correspondant |
| (hors menu) | Page de réglages pour la coordination, par l'adresse `…/ressources/#/parametres` : volées, enseignant·es, cours et familles, libellés des niveaux, dossier d'échange |

Règles reprises du cahier des charges : R1 à R13 (phase calculée, retenue, doublons, correction 7 jours, moyenne C/T hebdomadaire par famille en indicateur de tendance, CPS 4 regards…).

Absent pour l'instant : pièces jointes (PDF de bilan signé, classeur CPS) ; elles viendront avec SharePoint.

## 4. Passage à SharePoint (plus tard)

Le code est organisé pour que seul l'« adaptateur de données » change :

- `js/data/local-adapter.js` : bac à sable actuel (navigateur).
- `js/data/sharepoint-adapter.js` : déjà écrit, **non activé**, lit et écrit les listes SharePoint via Microsoft Graph.
  Les champs portent exactement les noms internes du modèle de données Phase 3 (`EleveID`, `SemaineCle`…).

Prérequis côté informatique cantonale (à leur transmettre) :
1. Inscription d'une application « monopage » (SPA) dans Entra ID, URI de redirection = l'adresse GitHub Pages.
2. Permission déléguée Microsoft Graph `Sites.ReadWrite.All` (ou `Sites.Selected` limitée au site RessourceS), avec consentement administrateur si exigé.
3. Un site d'équipe SharePoint avec les 16 listes `RS_…` (dont `RS_Travaux` : `Title`, `Type`, `CoursID`, `EnseignantID`, `Echeance`, `SemaineCle`, `Statut` ; `RS_Absences` : `Title`, `EleveID`, `InscriptionID`, `CoursID`, `EnseignantID`, `DateAbsence` (date sans heure), `SemaineCle`, `Phase`, `Duree` (Heure, Demi-journée, Journée), `Moment` (Matin, Après-midi, vide pour une journée) ; créées à la main, pas par import CSV ; index sur `EleveID`, `InscriptionID`, `SemaineCle`).
4. Validation du préposé à la protection des données.

Ensuite : remplir `js/config.js` (`MODE: 'sharepoint'`, identifiants), ajouter la bibliothèque MSAL
(`@azure/msal-browser`, à héberger dans le dépôt) dans `index.html`. La personne est alors reconnue par son
e-mail dans `RS_Enseignants` ; les permissions réelles restent celles du site SharePoint.

## 4 ter. Absences

- **Saisie de groupe** : sur la ligne de l'élève, cocher « absent », puis **heure**, **demi-journée** ou **journée** ; pour une heure ou une demi-journée, **matin** ou **après-midi** (le mercredi : matin seulement). C et T disparaissent de la ligne : un élève absent n'est pas coté. Pour une semaine passée, changer la date en haut de l'écran. « Modifier » rouvre une absence déjà saisie (décocher « absent » la retire) ; même règle que les suivis : l'auteur·e pendant 7 jours, ensuite la coordination.
- **Saisie individuelle** : case « Élève absent », mêmes choix.
- **Décompte** : matin 4 h, après-midi 3 h, journée 7 h ; le mercredi, 4 h au plus. Une heure compte 1 h. Plusieurs saisies le même jour (plusieurs cours) se combinent : une journée couvre tout, une demi-journée couvre les heures saisies dans la même demi-journée, et les heures d'une demi-journée ne dépassent pas sa durée.
- **Grille horaire** (pour toute l'année, dans `js/domain.js`, `GRILLE`) : lundi Allemand, Maths, Français, Méthodo / Orientation, après-midi ACM (3 h) ; mardi Cours normaux, Maths, Français, Sciences, après-midi Musique (3 h) ; mercredi Cours normaux, Maths, Dessin (2 h) ; jeudi Cours normaux, Maths, Anglais, Français, après-midi Sport (3 h) ; vendredi Cours normaux (2 h), Sciences, Français, après-midi Théâtre (2 h) et Bilan. L'étude n'est pas comptée.
- **Par branche** : une journée ou une demi-journée se répartit sur les périodes de la grille. Une heure va à la branche du cours où elle a été saisie (reconnu à son titre : « Mathématiques » → Maths, « Arts visuels » → Dessin…) ; saisie hors grille (coaching) ou dans un cours qui n'a pas lieu à ce moment, elle compte en « Non précisé ». Le total par branche est toujours égal au total.
- Le décompte s'affiche sur l'**accueil** (carte « Absences », pendant une volée : heures de la semaine et nombre d'élèves absents, heures depuis le début de la volée, moyenne par élève et élèves sans absence, puis la liste des élèves absents, les plus absents en tête, avec les trois branches les plus touchées et les heures de la semaine et de la volée ; tous les élèves de la volée, même en « Ma vue », puisqu'une absence concerne l'élève et pas un cours ; les absences datées après la date affichée ne comptent pas ; pas de seuil d'alerte), dans le **dossier** (carte « Absences » : un **calendrier** de la volée, une ligne par semaine jusqu'à la semaine en cours et une case par demi-journée (pleine pour une demi-journée ou une journée, cerclée avec le nombre d'heures sinon, hachurée hors de la volée, en pointillé à venir) ; le total de chaque semaine à droite ; en bas, pour chaque demi-journée, le nombre de semaines où elle a été manquée (en couleur quand c'est au moins une semaine sur deux) ; un clic sur une semaine affiche ses jours (date, heures, durée et initiales de qui a saisi, « Retirer » avec Annuler) et sa vue « Par branche », les deux semaines les plus récentes avec absences étant ouvertes d'office ; sous le calendrier, « Par branche, depuis le début » repliée, une branche par ligne avec ses heures et une barre proportionnelle ; dans la chronologie, « journée · PL » sans nom de cours), dans le **Suivi** (colonne « Absences ») et dans le **Bilan CR** (agrégé, export CSV compris).
- **Synthèse hebdomadaire du dossier** : une ligne « Absences (heures) » en tête du tableau ; « absent » à la place du point quand l'élève a manqué toutes les heures de classe de la semaine ; sous chaque moyenne, le nombre de cotations. Quand l'élève a manqué **au moins 30 %** des heures de classe depuis le début de la volée, une phrase le dit au-dessus du graphique : « Absent X h sur Y h de classe (Z %), hors cours normaux. Les cotations ne décrivent que les heures où l'élève était là. » Heures de classe : la grille sans les Cours normaux (27 h par semaine). Limite : l'app ne connaît pas les jours fériés, qui comptent comme des jours de classe.
- **« Sans suivi cette semaine »** : un élève absent, selon la grille, à toutes les périodes déjà passées de la semaine (hors Cours normaux) n'est pas signalé. Pour un cours : pas de signal s'il a manqué toutes les leçons passées de ce cours ; pour le coaching (hors grille), la règle de toutes les périodes s'applique.
- Un élève sans pastille ni case « absent » n'est toujours pas enregistré : seule la case compte une absence.
- Les fichiers d'échange d'avant cette version n'ont pas de liste d'absences : ils s'importent et se fusionnent normalement.

## 4 bis. Familles de cours et coaching

- Chaque cours appartient à une famille : **Branches** (français, maths, sciences, langues), **Projet** (ACM, arts visuels,
  musique, sport, théâtre) ou **Méthodo / Orientation**. page de réglages (`#/parametres`) → Cours → Famille. La synthèse du dossier affiche la
  moyenne hebdomadaire de C et de T par famille, avec un graphique de tendance.
- **C** cote le respect, **T** la mise au travail. La ponctualité et le matériel ne sont pas cotés : ce sont deux cases à cocher (« en retard », « matériel manquant »), en saisie individuelle comme en saisie de groupe. La saisie de groupe a aussi un commentaire par élève, ouvert au clic (« + commentaire »), enregistré dans `Observation`.
- SharePoint : ajouter à la liste `RS_Suivis` deux colonnes Oui/Non `Retard` et `MaterielManquant`.
- Le **coaching** n'a ni cotation C/T ni note : seulement le suivi écrit (travaillé, progrès / vigilance).
- SharePoint : ajouter à la liste `RS_Cours` une colonne Choix `Groupe` (Branches, Projet, Méthodo / Orientation).

## 5. Points à vérifier

- Bilan CR : l'écran décrit une évolution pendant le passage, pas un effet causal de la CR. Seuils arbitraires : évolution = moyenne de (C+T)/2 de la dernière semaine cotée moins celle de la première (décompression comprise), amélioration dès +0,5 (nette dès +1,0), « en baisse » dès −0,5, entre les deux « sans évolution » ; domaine CPS « en hausse » dès +0,3. Chaque élève compte pour un (moyenne par élève, puis entre élèves). Avec peu de semaines cotées, le profil est sensible aux variations d'une semaine à l'autre.

- Dates de phases des volées V2 à V5 : proposition, à corriger dans la page de réglages (`#/parametres`) → Volées.
- Seuils arbitraires : écart CPS ≥ 1,5 ; bilan intermédiaire « à faire » dès remobilisation + 14 jours ; final dans les 10 derniers jours.
- Les polices Atkinson Hyperlegible et Lexend sont hébergées dans le dépôt (`fonts/`) : aucune requête vers un service externe.
- Le sigle CPS est développé « compétences psychosociales » dans le menu du dossier : à confirmer.
