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
  // Date simulée par défaut en mode test (mercredi de la semaine 6 de V1, ré-exposition).
  // Chaque testeur peut la changer dans Paramètres.
  DATE_SIMULEE_DEFAUT: '2026-10-07',
};
