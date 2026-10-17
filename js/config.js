// Configuration de l'app.
// MODE = 'bac-a-sable' : données fictives dans le navigateur (version de test).
// MODE = 'sharepoint'  : à activer seulement après validation de l'informatique cantonale
//                        et du préposé à la protection des données.

export const CONFIG = {
  MODE: 'bac-a-sable',
  sharepoint: {
    clientId: '',      // fourni par l'informatique (ID d'application)
    tenantId: '',      // ID du tenant cantonal
    hostname: '',      // ex. xxxx.sharepoint.com
    sitePath: '',      // ex. sites/RessourceS
    scopes: ['Sites.ReadWrite.All'],
  },
  // Date simulée par défaut : premier jour de V2. Chacun·e peut la changer dans Réglages.
  DATE_SIMULEE_DEFAUT: '2026-10-26',
  // true : six élèves fictifs d'exemple, ARCHIVÉS, dans la volée terminée 2025-26 V5
  // (profils variés, notes dans toutes les branches, bilans et CPS complets).
  DONNEES_EXEMPLE: true,
};
