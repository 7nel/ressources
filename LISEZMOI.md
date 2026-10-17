# RessourceS — version web de test

Application de suivi des élèves de la Classe RessourceS, reprise de l'app Power Apps.
**Version de test : données fictives uniquement.**

## 1. Publier sur GitHub Pages (≈ 10 minutes)

1. Sur github.com : **New repository** → nom `ressources` → *Public* → **Create repository**.
   (Dépôt privé : GitHub Pages l'accepte avec un compte payant ou l'offre étudiante GitHub Education.)
2. **Add file → Upload files** → glisser **le contenu** du dossier (`index.html`, `css/`, `js/`, `LISEZMOI.md`), pas le dossier lui-même → **Commit changes**.
3. **Settings → Pages** → *Source* : **Deploy from a branch** → branche `main`, dossier `/ (root)` → **Save**.
4. Après 1 à 2 minutes, l'adresse s'affiche en haut de la page Pages, par exemple
   `https://7nel.github.io/ressources/`. C'est le lien à envoyer aux collègues.

Pour mettre à jour : **Add file → Upload files** à nouveau, avec les fichiers modifiés.

> Ouvrir `index.html` en double-cliquant ne fonctionne pas (le navigateur bloque les modules).
> Il faut passer par GitHub Pages, ou un petit serveur local : `python3 -m http.server` dans le dossier.

## 2. Ce que les collègues doivent savoir

- Chacun·e choisit **ses initiales** au premier lancement (PL, ME, CM, ET, DAH, OG, DA, VO, XG) : cela simule la connexion Microsoft et affiche ses propres cours. PL et ME ont le rôle coordination.
- **Élèves d'exemple** : six élèves fictifs **archivés** dans la volée terminée 2025-26 V5 (Élèves → filtre « Archivé » ; Notes → volée « 2025-26 V5 »). Profils : sans évolution, deux petites améliorations, nette amélioration, aggravation, bon niveau stable. Notes dans toutes les branches, bilans et CPS complets. Pour les retirer : `DONNEES_EXEMPLE: false` dans `js/config.js`.
- **Réglages → Date simulée** : par défaut le 26.10.2026 (début de V2). Les boutons
  « Décompression », « Remobilisation », « Ré-exposition » permettent de tester chaque phase.
- **Échange avec l'équipe** (menu de gauche) : voir la section 2 bis.
- **Réglages → Tout effacer** : repart à vide sur cet appareil.
- **Aucun vrai nom d'élève**, même pour essayer : le code est public et la version de test n'est pas validée (LIPDA).

## 2 ter. Navigateur et installation comme application

- **Navigateur recommandé : Microsoft Edge ou Google Chrome, sur ordinateur.** Ce sont les seuls à pouvoir lire et écrire
  directement dans le dossier OneDrive (sauvegarde automatique, chargement à l'ouverture).
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
- Ensuite : **sauvegarde automatique** dans le dossier après chaque saisie (`RessourceS_<initiales>.json`).
  « Sauvegarder ma version » reste disponible (il intègre aussi les versions des collègues).
- À l'ouverture, les versions de l'équipe se chargent seules si le navigateur a gardé l'autorisation ;
  sinon un clic sur « Charger les versions » suffit.

**Téléphone**
- « Sauvegarder » ouvre le menu de partage avec le nom exact du fichier : « Enregistrer dans Fichiers » (ou l'app OneDrive) → dossier partagé → **Remplacer**.
- Si le téléphone ajoute « (1) » au nom, l'app lit quand même ce fichier ; la prochaine sauvegarde depuis un ordinateur (Chrome/Edge) fusionne et supprime ces copies.

**Safari, Firefox**
- « Sauvegarder ma version » télécharge `RessourceS_<initiales>.json` : le glisser dans le dossier partagé (remplacer l'ancien).
- « Charger les versions » : sélectionner tous les fichiers du dossier (Ctrl+A / Cmd+A).

Règles de fusion : rien n'est jamais supprimé ; si deux personnes modifient le même élément, la modification la plus récente l'emporte.
**Aucune copie dans le navigateur** (réglage « Ne rien garder dans ce navigateur », activé par défaut) :
les données ne vivent qu'en mémoire pendant l'utilisation. À la fermeture de l'onglet, rien ne reste sur l'appareil ;
à l'ouverture, l'app relit le dossier partagé. Le réglage peut être désactivé pour tester seul·e.

Un point orange signale des modifications non sauvegardées ; le navigateur avertit si on ferme la page avant d'avoir sauvegardé.

⚠ Solution provisoire, pour données fictives uniquement : des fichiers JSON dans un dossier ne protègent pas des données réelles d'élèves.

## 3. Contenu

| Menu | Écrans |
|---|---|
| Accueil | Rampe de la volée, tuiles, « Mes cours », alertes « désengagé », colle du vendredi, À faire |
| Élèves | Liste, nouvel élève (alerte de doublon), dossier : synthèse hebdomadaire, suivis, devoirs, évaluations, actions, bilans, CPS, orientation, fiche coaching imprimable |
| Saisie | Saisie de groupe (cotations ou évaluation), saisie individuelle, évaluation selon la phase (R5) |
| Notes | Filtres, moyennes pondérées, graphique ; Ma branche |
| Tâches | Mes tâches, toutes, terminées |
| Réglages | Profil, date simulée, libellés des niveaux, volées, enseignant·es, cours, données |

Règles reprises du cahier des charges : R1 à R13 (phase calculée, colle, doublons, correction 7 jours, pas de moyenne C/T, CPS 4 regards…).

Absent pour l'instant : pièces jointes (PDF de bilan signé, classeur CPS) ; elles viendront avec SharePoint.

## 4. Passage à SharePoint (plus tard)

Le code est organisé pour que seul l'« adaptateur de données » change :

- `js/data/local-adapter.js` : bac à sable actuel (navigateur).
- `js/data/sharepoint-adapter.js` : déjà écrit, **non activé**, lit et écrit les listes SharePoint via Microsoft Graph.
  Les champs portent exactement les noms internes du modèle de données Phase 3 (`EleveID`, `SemaineCle`…).

Prérequis côté informatique cantonale (à leur transmettre) :
1. Inscription d'une application « monopage » (SPA) dans Entra ID, URI de redirection = l'adresse GitHub Pages.
2. Permission déléguée Microsoft Graph `Sites.ReadWrite.All` (ou `Sites.Selected` limitée au site RessourceS), avec consentement administrateur si exigé.
3. Un site d'équipe SharePoint avec les 14 listes `RS_…` (créées à la main, pas par import CSV ; index sur `EleveID`, `InscriptionID`, `SemaineCle`).
4. Validation du préposé à la protection des données.

Ensuite : remplir `js/config.js` (`MODE: 'sharepoint'`, identifiants), ajouter la bibliothèque MSAL
(`@azure/msal-browser`, à héberger dans le dépôt) dans `index.html`. La personne est alors reconnue par son
e-mail dans `RS_Enseignants` ; les permissions réelles restent celles du site SharePoint.

## 5. Points à vérifier

- Dates de phases des volées V2 à V5 : proposition, à corriger dans Réglages → Volées.
- Seuils arbitraires : écart CPS ≥ 1,5 ; bilan intermédiaire « à faire » dès remobilisation + 14 jours ; final dans les 10 derniers jours.
- La police Atkinson Hyperlegible est chargée depuis Google Fonts (l'adresse IP du visiteur est transmise à Google).
  Pour la version réelle, l'héberger dans le dépôt.
