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
  // Date simulée par défaut : fin de la volée d'exemple 2025-26 V5. Chacun·e peut la changer dans Réglages.
  DATE_SIMULEE_DEFAUT: '2026-06-17',
  // true : six élèves fictifs d'exemple dans la volée 2025-26 V5 (profils variés, bilans et CPS complets).
  DONNEES_EXEMPLE: true,
};
