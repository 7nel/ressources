// Magasin de données de l'app.
// Les écrans ne parlent qu'à ce magasin. Le magasin parle à un « adaptateur » :
//   - LocalAdapter      : bac à sable, données dans le navigateur (version de test)
//   - SharePointAdapter : listes SharePoint via Microsoft Graph (après validation de l'informatique)
// Changer d'adaptateur ne demande aucune modification des écrans.

import { checkMergeShape } from './import-validation.js';

export const LISTS = [
  'RS_Enseignants', 'RS_Cours', 'RS_Eleves', 'RS_Volees', 'RS_Inscriptions',
  'RS_Suivis', 'RS_Devoirs', 'RS_Evaluations', 'RS_Bilans', 'RS_Actions',
  'RS_CPS', 'RS_Stages', 'RS_DocsOrientation', 'RS_Taches', 'RS_Travaux',
];

export class Store {
  constructor(adapter) {
    this.adapter = adapter;
    this.cache = {};
  }

  async init() {
    await this.adapter.init?.();
    for (const l of LISTS) this.cache[l] = await this.adapter.getAll(l);
  }

  all(list) { return this.cache[list] || []; }
  get(list, id) { return id == null ? null : this.all(list).find(x => x.ID === Number(id)) || null; }
  where(list, fn) { return this.all(list).filter(fn); }

  async add(list, item) {
    const created = await this.adapter.add(list, item);
    this.cache[list].push(created);
    this.onWrite?.();
    return created;
  }

  async addMany(list, items) {
    const out = [];
    for (const it of items) out.push(await this.add(list, it)); // séquentiel : plus sûr pour SharePoint
    return out;
  }

  async update(list, id, patch) {
    const updated = await this.adapter.update(list, id, patch);
    const arr = this.cache[list];
    const i = arr.findIndex(x => x.ID === id);
    if (i >= 0) arr[i] = updated;
    this.onWrite?.();
    return updated;
  }

  /* Outils du bac à sable (sans effet en mode SharePoint) */
  exportJSON() { return this.adapter.exportJSON?.(); }
  /** Contrôle un fichier sans rien modifier (voir LocalAdapter.previewImport). */
  previewImport(json) { return this.adapter.previewImport(json); }
  async importJSON(json) { await this.adapter.importJSON(json); await this.init(); this.onWrite?.(); }
  /** Fusionne une version d'un·e collègue (bac à sable uniquement). */
  async mergeJSON(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (!data?.lists) throw new Error('Fichier non reconnu');
    checkMergeShape(data.lists); // une liste mal formée ferait échouer la fusion en cours de route
    const stats = this.adapter.mergeLists(data.lists);
    await this.init();
    return stats;
  }
  async reset() { await this.adapter.reset(); await this.init(); }
}
