// Adaptateur SharePoint (Microsoft Graph) — PRÊT MAIS NON ACTIVÉ.
//
// À activer seulement quand l'informatique cantonale a :
//   1. enregistré l'application dans le tenant (Entra ID → Inscriptions d'applications,
//      type « Application monopage », URI de redirection = adresse GitHub Pages de l'app) ;
//   2. accordé la permission déléguée Microsoft Graph (Sites.ReadWrite.All, ou mieux Sites.Selected
//      limitée au site RessourceS) et donné son consentement si le tenant l'exige ;
//   3. créé le site d'équipe et ses listes (mêmes noms de listes et de colonnes que le modèle Phase 3).
//
// Ensuite : remplir config.js, ajouter la bibliothèque MSAL (voir LISEZMOI), et dans app.js
// remplacer `new LocalAdapter()` par `new SharePointAdapter(CONFIG.sharepoint)`.
//
// Les droits réels restent ceux du site SharePoint : l'app n'affiche que ce que la personne
// connectée a le droit de lire. Aucun secret n'est stocké dans le code (application publique).

const GRAPH = 'https://graph.microsoft.com/v1.0';
const MULTI_CHOICE = { RS_Bilans: ['DomainesPrioritaires'] };
const DATE_FIELDS = new Set([
  'DateDebut', 'DateDebutRemob', 'DateDebutReexpo', 'DateFin', 'DateSuivi', 'DateConstat', 'DateResolution',
  'DateEval', 'DateBilan', 'DatePassation', 'DateSignatureEleve', 'DateValidationCoord', 'Echeance',
  'DateCloture', 'DateMaj',
]);
const READ_ONLY = new Set(['ID', 'id', 'UID', 'Created', 'Modified', 'Author', 'Editor', '@odata.etag', 'ContentType', 'Attachments', 'Edit', 'LinkTitle', 'LinkTitleNoMenu', 'DocIcon', 'ItemChildCount', 'FolderChildCount', '_UIVersionString', '_ComplianceFlags', '_ComplianceTag', '_ComplianceTagWrittenTime', '_ComplianceTagUserId', 'AppAuthorLookupId', 'AppEditorLookupId', 'AuthorLookupId', 'EditorLookupId']);

/** Les colonnes « Date sans heure » reviennent en UTC (ex. 2026-10-06T22:00:00Z pour le 7 octobre). */
function toLocalDate(v) {
  if (!v) return null;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date(v));
}

export class SharePointAdapter {
  constructor(cfg) {
    this.cfg = cfg; // { clientId, tenantId, hostname, sitePath }
    this.listIds = {};
  }

  async init() {
    if (!window.msal) throw new Error('Bibliothèque MSAL absente (voir LISEZMOI).');
    this.msal = new window.msal.PublicClientApplication({
      auth: {
        clientId: this.cfg.clientId,
        authority: `https://login.microsoftonline.com/${this.cfg.tenantId}`,
        redirectUri: window.location.origin + window.location.pathname,
      },
      cache: { cacheLocation: 'sessionStorage' }, // jeton effacé à la fermeture de l'onglet
    });
    await this.msal.initialize();
    const res = await this.msal.handleRedirectPromise();
    this.account = res?.account || this.msal.getAllAccounts()[0];
    if (!this.account) {
      await this.msal.loginRedirect({ scopes: this.cfg.scopes });
      return new Promise(() => {}); // la page va être rechargée
    }
    const site = await this.call(`${GRAPH}/sites/${this.cfg.hostname}:/${this.cfg.sitePath}`);
    this.siteId = site.id;
    let url = `${GRAPH}/sites/${this.siteId}/lists?$select=id,displayName,name`;
    while (url) {
      const page = await this.call(url);
      for (const l of page.value) { this.listIds[l.displayName] = l.id; this.listIds[l.name] ||= l.id; }
      url = page['@odata.nextLink'];
    }
  }

  currentUserEmail() { return this.account?.username || null; }

  async token() {
    try {
      return (await this.msal.acquireTokenSilent({ scopes: this.cfg.scopes, account: this.account })).accessToken;
    } catch {
      await this.msal.acquireTokenRedirect({ scopes: this.cfg.scopes, account: this.account });
      return new Promise(() => {});
    }
  }

  async call(url, opts = {}) {
    const r = await fetch(url, {
      ...opts,
      headers: { Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    if (!r.ok) throw new Error(`SharePoint ${r.status} : ${(await r.text()).slice(0, 300)}`);
    return r.status === 204 ? null : r.json();
  }

  listUrl(list) {
    const id = this.listIds[list];
    if (!id) throw new Error(`Liste ${list} introuvable sur le site`);
    return `${GRAPH}/sites/${this.siteId}/lists/${id}`;
  }

  fromGraph(list, item) {
    const f = { ...item.fields };
    const out = { ID: Number(item.id), Created: item.createdDateTime, Modified: item.lastModifiedDateTime };
    for (const [k, v] of Object.entries(f)) {
      if (k.startsWith('@') || k.endsWith('@odata.type') || READ_ONLY.has(k)) continue;
      out[k] = DATE_FIELDS.has(k) ? toLocalDate(v) : v;
    }
    return out;
  }

  toGraph(list, rec) {
    const fields = {};
    for (const [k, v] of Object.entries(rec)) {
      if (READ_ONLY.has(k) || v === undefined) continue;
      fields[k] = v;
      if ((MULTI_CHOICE[list] || []).includes(k)) fields[`${k}@odata.type`] = 'Collection(Edm.String)';
    }
    return fields;
  }

  async getAll(list) {
    // Charge toute la liste par pages de 999 (Graph n'a pas la limite de délégation de Power Apps).
    // Au-delà de quelques milliers de suivis, il faudra filtrer par volée (colonnes indexées).
    const out = [];
    let url = `${this.listUrl(list)}/items?expand=fields&$top=999`;
    while (url) {
      const page = await this.call(url);
      for (const it of page.value) out.push(this.fromGraph(list, it));
      url = page['@odata.nextLink'];
    }
    return out;
  }

  async add(list, item) {
    const created = await this.call(`${this.listUrl(list)}/items`, {
      method: 'POST', body: JSON.stringify({ fields: this.toGraph(list, item) }),
    });
    return this.fromGraph(list, created);
  }

  async update(list, id, patch) {
    await this.call(`${this.listUrl(list)}/items/${id}/fields`, { method: 'PATCH', body: JSON.stringify(this.toGraph(list, patch)) });
    const it = await this.call(`${this.listUrl(list)}/items/${id}?expand=fields`);
    return this.fromGraph(list, it);
  }

  exportJSON() { return null; }
  async importJSON() { throw new Error('Import désactivé en mode SharePoint.'); }
  async reset() { throw new Error('Réinitialisation désactivée en mode SharePoint.'); }
}
