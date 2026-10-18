// Adaptateur « bac à sable ».
// Mode « sans copie locale » (par défaut) : les données ne vivent qu'en mémoire pendant l'utilisation ;
// rien n'est écrit dans le navigateur. Elles viennent du dossier partagé à chaque ouverture.
// Mode « copie locale » : le navigateur garde une copie (pratique pour tester seul·e). Les champs portent les noms internes des colonnes SharePoint
// (Title, EleveID, SemaineCle…) pour que le passage à SharePoint soit direct.

import { LISTS } from './store.js';
import { buildSeed } from './seed.js';

const KEY = 'ressources_bac_a_sable_v3';
const FK = { EnseignantID: 'RS_Enseignants', VoleeID: 'RS_Volees', CoursID: 'RS_Cours', EleveID: 'RS_Eleves', InscriptionID: 'RS_Inscriptions' };
const MERGE_ORDER = ['RS_Enseignants', 'RS_Volees', 'RS_Cours', 'RS_Eleves', 'RS_Inscriptions', 'RS_Suivis', 'RS_Devoirs', 'RS_Evaluations', 'RS_Bilans', 'RS_Actions', 'RS_CPS', 'RS_Stages', 'RS_DocsOrientation', 'RS_Taches', 'RS_Travaux'];
const newUid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export class LocalAdapter {
  constructor({ memoryOnly = true } = {}) { this.db = null; this.memoryOnly = memoryOnly; }

  /** Active ou coupe la copie dans le navigateur ; la couper efface la copie existante. */
  setMemoryOnly(on) {
    this.memoryOnly = on;
    if (on) { try { localStorage.removeItem(KEY); } catch { /* ignoré */ } }
    else this.persist();
  }

  async init() {
    if (this.db) { this.persist(); return; } // déjà chargé (rechargement du cache après fusion)
    let raw = null;
    if (this.memoryOnly) { try { localStorage.removeItem(KEY); } catch { /* ignoré */ } }
    else { try { raw = localStorage.getItem(KEY); } catch { /* stockage bloqué : on reste en mémoire */ } }
    if (raw) {
      try { this.db = JSON.parse(raw); } catch { this.db = null; }
    }
    if (!this.db || !this.db.lists) this.db = buildSeed();
    for (const l of LISTS) this.db.lists[l] ||= [];
    this.ensureUids();
    this.persist();
  }

  /** Identifiant global (UID) : permet de fusionner les versions de plusieurs personnes. */
  ensureUids() {
    for (const l of LISTS) {
      for (const r of this.db.lists[l]) {
        if (r.UID) continue;
        r.UID = String(r.Created || '') < '2026-10-07' ? `seed-${l}-${r.ID}` : newUid();
      }
    }
  }

  persist() {
    if (this.memoryOnly) return;
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
    const rec = { ...item, ID: this.nextId(list), UID: newUid(), Created: now, Modified: now };
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
    this.ensureUids();
    this.persist();
  }

  /**
   * Fusionne les listes d'une autre version (fichier d'un·e collègue).
   * Même UID : la version modifiée le plus récemment l'emporte. Nouvel UID : ajouté avec un nouvel ID local.
   * Les liens (EleveID, InscriptionID…) sont renumérotés pour pointer vers les ID locaux.
   */
  mergeLists(incoming) {
    const stats = { ajoutes: 0, misAJour: 0 };
    const idMap = {};
    for (const list of MERGE_ORDER) {
      idMap[list] = new Map();
      const local = this.db.lists[list];
      const byUid = new Map(local.map(r => [r.UID, r]));
      for (const src of incoming[list] || []) {
        if (!src || !src.UID) continue;
        // Données d'exemple : générées par le code, identiques pour tous. On ne les fusionne pas
        // (un fichier d'une version précédente ne doit pas les ramener) ; on garde seulement la correspondance des ID.
        if (String(src.UID).startsWith('seed-')) {
          const ex = byUid.get(src.UID);
          if (ex) idMap[list].set(src.ID, ex.ID);
          continue;
        }
        const inc = { ...src };
        for (const [k, target] of Object.entries(FK)) {
          if (inc[k] != null && idMap[target]?.has(inc[k])) inc[k] = idMap[target].get(inc[k]);
        }
        if (list === 'RS_Inscriptions') inc.CleUnique = `E${inc.EleveID}-V${inc.VoleeID}`;
        if (list === 'RS_Bilans' && inc.CleUnique) inc.CleUnique = `I${inc.InscriptionID}-${inc.CleUnique.split('-').pop()}`;
        const ex = byUid.get(inc.UID);
        if (ex) {
          idMap[list].set(src.ID, ex.ID);
          if (String(inc.Modified || '') > String(ex.Modified || '')) {
            Object.assign(ex, inc, { ID: ex.ID });
            stats.misAJour++;
          }
        } else {
          const id = this.nextId(list);
          idMap[list].set(src.ID, id);
          const rec = { ...inc, ID: id };
          local.push(rec);
          byUid.set(rec.UID, rec);
          stats.ajoutes++;
        }
      }
    }
    this.persist();
    return stats;
  }

  async reset() {
    this.db = buildSeed();
    this.ensureUids();
    this.persist();
  }
}
