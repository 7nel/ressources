// Adaptateur « bac à sable » : chaque navigateur garde sa propre copie des données fictives.
// Rien ne quitte l'appareil. Les champs portent les noms internes des colonnes SharePoint
// (Title, EleveID, SemaineCle…) pour que le passage à SharePoint soit direct.

import { LISTS } from './store.js';
import { buildSeed } from './seed.js';

const KEY = 'ressources_bac_a_sable_v2';

export class LocalAdapter {
  constructor() { this.db = null; }

  async init() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch { /* stockage bloqué : on reste en mémoire */ }
    if (raw) {
      try { this.db = JSON.parse(raw); } catch { this.db = null; }
    }
    if (!this.db || !this.db.lists) this.db = buildSeed();
    for (const l of LISTS) this.db.lists[l] ||= [];
    this.persist();
  }

  persist() {
    try { localStorage.setItem(KEY, JSON.stringify(this.db)); }
    catch { this.storageError = true; }
  }

  nextId(list) {
    const arr = this.db.lists[list];
    return arr.reduce((m, x) => Math.max(m, x.ID), 0) + 1;
  }

  async getAll(list) { return structuredClone(this.db.lists[list]); }

  async add(list, item) {
    const now = new Date().toISOString();
    const rec = { ...item, ID: this.nextId(list), Created: now, Modified: now };
    this.db.lists[list].push(rec);
    this.persist();
    return structuredClone(rec);
  }

  async update(list, id, patch) {
    const arr = this.db.lists[list];
    const i = arr.findIndex(x => x.ID === id);
    if (i < 0) throw new Error(`Élément ${id} introuvable dans ${list}`);
    arr[i] = { ...arr[i], ...patch, ID: id, Modified: new Date().toISOString() };
    this.persist();
    return structuredClone(arr[i]);
  }

  exportJSON() { return JSON.stringify({ format: 'RessourceS-bac-a-sable', version: 1, exporte: new Date().toISOString(), ...this.db }, null, 1); }

  async importJSON(json) {
    const data = JSON.parse(json);
    if (!data.lists) throw new Error('Fichier non reconnu');
    this.db = { lists: data.lists };
    for (const l of LISTS) this.db.lists[l] ||= [];
    this.persist();
  }

  async reset() {
    this.db = buildSeed();
    this.persist();
  }
}
