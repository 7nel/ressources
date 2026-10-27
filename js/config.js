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
  // true : six élèves fictifs d'exemple, ARCHIVÉS, dans la volée terminée 2025-26 V5
  // (profils variés, notes dans toutes les branches, bilans et CPS complets).
  DONNEES_EXEMPLE: false,
  // Questionnaires CPS dans Microsoft Forms (compte edu.vs.ch). Valeurs tirées des liens « préremplis » :
  // id = paramètre id= du lien ; qCode / qMoment = noms des paramètres r… des questions Code et Moment.
  // Si un Forms est recréé, ses identifiants changent : recopier ici les valeurs du nouveau lien prérempli.
  CPS_FORMS: {
    Eleve: { id: 'sR1fqzjKEk2T-XIwC59q63B-25zljadCjuhRTc6jsgxUN1U1SFkxWkRRSzA1TUEzV0QyVFZDRVc4US4u', qCode: 'r3ac393ea9264429c99564d585afb5d67', qMoment: 'ra27170d7219c4b0d907c29d063595260' },
    Titulaire: { id: 'sR1fqzjKEk2T-XIwC59q63B-25zljadCjuhRTc6jsgxUNVVFUFRCSU02QUJYUlVBMFVSQjNMRTNaNi4u', qCode: 'rd9a1d883b78b4c979c0f561717d8d2d2', qMoment: 'r92b449f6870f41a6b549feea3eedf3cb' },
    Parents: { id: 'sR1fqzjKEk2T-XIwC59q63B-25zljadCjuhRTc6jsgxURFpIMzFGNUhTSjVRQzJOVDNUVFg5UFJQRi4u', qCode: 'rf87abe544b47459b9b7253328d7292ce', qMoment: 'r4fd943e092e6476ab5c3786905e627b2' },
  },
};
