// Échange provisoire entre collègues par un dossier OneDrive partagé.
//
// Chaque personne a UN fichier dans le dossier : RessourceS_<initiales>.json (sa version complète).
// « Charger » fusionne tous les fichiers du dossier : un élément modifié par deux personnes
// garde la version la plus récente ; rien n'est jamais supprimé.
//
// Deux modes, choisis automatiquement :
//  - Dossier relié (Chrome / Edge sur ordinateur, dossier OneDrive synchronisé) : l'app lit et écrit
//    directement dans le dossier. Sauvegarder = 1 clic ; charger = automatique à l'ouverture
//    (ou 1 clic si le navigateur redemande l'autorisation).
//  - Sinon (Safari, Firefox, téléphone, aperçu) : le fichier est téléchargé, à déposer dans le dossier ;
//    pour charger, on sélectionne les fichiers du dossier (Ctrl+A).

import { S, moi, isSandbox } from './state.js';
import { toast, h, modal } from './ui.js';

const META_KEY = 'ressources_echange_v1';
const meta = { dirty: false, lastSave: null, lastLoad: null, folderName: null };
let dirHandle = null;
let loadedThisSession = false;

try { Object.assign(meta, JSON.parse(localStorage.getItem(META_KEY) || '{}')); } catch { /* défaut */ }
const saveMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* ignoré */ } };

export const getMeta = () => meta;
export const isDirty = () => meta.dirty;
export const wasLoadedThisSession = () => loadedThisSession;
export function markDirty() {
  if (!meta.dirty) { meta.dirty = true; saveMeta(); window.dispatchEvent(new Event('rs:sync')); }
  scheduleAutosave();
}

/* ---------- Sauvegarde automatique (dossier relié et autorisé uniquement) ---------- */
let autoTimer = null;
function scheduleAutosave() {
  if (!isSandbox() || !supportsFolder()) return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(autosave, 1500);
}
async function autosave() {
  try {
    const handle = await getFolder();
    if (!handle || (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') return;
    await writeOwnFile(handle);
    meta.dirty = false; meta.lastSave = new Date().toISOString(); meta.auto = true; saveMeta();
    window.dispatchEvent(new Event('rs:sync'));
  } catch { /* reste « non sauvegardé » : le bouton reprend la main */ }
}
async function writeOwnFile(handle) {
  const fh = await handle.getFileHandle(myFileName(), { create: true });
  const w = await fh.createWritable();
  await w.write(payload());
  await w.close();
}
export function dismissLoad() { loadedThisSession = true; }

/** Le dossier relié n'est possible que dans Chrome/Edge sur ordinateur, hors cadre intégré. */
export function supportsFolder() {
  try { return 'showDirectoryPicker' in window && window.self === window.top; } catch { return false; }
}

/* ---------- Mémoire du dossier choisi (IndexedDB) ---------- */
function idb(mode, fn) {
  return new Promise((res, rej) => {
    const req = indexedDB.open('ressources-echange', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onerror = () => rej(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction('kv', mode);
      const r = fn(tx.objectStore('kv'));
      tx.oncomplete = () => res(r?.result);
      tx.onerror = () => rej(tx.error);
    };
  });
}
async function getFolder() {
  if (dirHandle) return dirHandle;
  try { dirHandle = await idb('readonly', st => st.get('dossier')) || null; } catch { dirHandle = null; }
  return dirHandle;
}
export async function chooseFolder() {
  const handle = await window.showDirectoryPicker({ id: 'ressources-echange', mode: 'readwrite' });
  dirHandle = handle;
  meta.folderName = handle.name; saveMeta();
  try { await idb('readwrite', st => st.put(handle, 'dossier')); } catch { /* le dossier sera redemandé */ }
  return handle;
}
async function permission(handle, interactive) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if (!interactive) return false;
  return (await handle.requestPermission(opts)) === 'granted';
}
async function folderReady(interactive) {
  let handle = await getFolder();
  if (!handle) {
    if (!interactive) return null;
    handle = await chooseFolder();
  }
  return (await permission(handle, interactive)) ? handle : null;
}

/* ---------- Fichiers ---------- */
export function myFileName() {
  const who = (moi()?.Title || 'inconnu').normalize('NFD').replace(/[^\w-]/g, '');
  return `RessourceS_${who}.json`;
}
function payload() {
  return JSON.stringify({
    format: 'RessourceS-version', version: 2, auteur: moi()?.Title || null, enregistre: new Date().toISOString(),
    lists: S.store.adapter.db.lists,
  });
}
const isVersionFile = name => /^RessourceS_.*\.json$/i.test(name);

async function mergeTexts(texts) {
  const total = { fichiers: 0, ajoutes: 0, misAJour: 0, erreurs: 0 };
  for (const t of texts) {
    try {
      const st = await S.store.mergeJSON(t);
      total.fichiers++; total.ajoutes += st.ajoutes; total.misAJour += st.misAJour;
    } catch { total.erreurs++; }
  }
  return total;
}
function report(t, silent) {
  meta.lastLoad = new Date().toISOString(); saveMeta();
  loadedThisSession = true;
  const changes = t.ajoutes + t.misAJour;
  if (!silent || changes || t.erreurs) {
    toast(`${t.fichiers} version${t.fichiers > 1 ? 's' : ''} chargée${t.fichiers > 1 ? 's' : ''} : ${changes ? `${t.ajoutes} ajout${t.ajoutes > 1 ? 's' : ''}, ${t.misAJour} mise${t.misAJour > 1 ? 's' : ''} à jour` : 'rien de nouveau'}${t.erreurs ? ` · ${t.erreurs} fichier${t.erreurs > 1 ? 's' : ''} illisible${t.erreurs > 1 ? 's' : ''}` : ''}`, t.erreurs ? 'err' : 'ok');
  }
  window.dispatchEvent(new Event('rs:refresh'));
}

async function readFolder(handle) {
  const texts = [];
  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && isVersionFile(entry.name)) texts.push(await (await entry.getFile()).text());
  }
  return texts;
}

/**
 * Copies de mon fichier créées par un téléphone ou un navigateur (« RessourceS_PL (1).json », « RessourceS_PL-2.json »…).
 * Elles sont fusionnées avant d'être supprimées : on ne perd rien, le dossier reste propre.
 */
async function supprimerMesDoublons(handle) {
  const mine = myFileName().replace(/\.json$/i, '');
  const re = new RegExp(`^${mine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ _-]*(\\(\\d+\\)|\\d+)?\\s*\\.json$`, 'i');
  let n = 0;
  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && entry.name !== myFileName() && re.test(entry.name)) {
      try { await handle.removeEntry(entry.name); n++; } catch { /* fichier verrouillé : on le laisse */ }
    }
  }
  return n;
}

/* ---------- Actions ---------- */
export async function sauvegarder() {
  if (!isSandbox()) return;
  if (supportsFolder()) {
    try {
      const handle = await folderReady(true);
      if (!handle) { toast('Accès au dossier refusé : la version n\'a pas été enregistrée.', 'err'); return; }
      // On intègre d'abord les versions des autres, pour que son propre fichier soit complet.
      const t = await mergeTexts(await readFolder(handle));
      await writeOwnFile(handle);
      const doublons = await supprimerMesDoublons(handle); // déjà fusionnés ci-dessus
      if (doublons) toast(`${doublons} ancienne${doublons > 1 ? 's' : ''} copie${doublons > 1 ? 's' : ''} de votre fichier supprimée${doublons > 1 ? 's' : ''} (contenu conservé).`);
      meta.dirty = false; meta.lastSave = new Date().toISOString(); saveMeta();
      loadedThisSession = true; meta.lastLoad = meta.lastSave;
      toast(`Version enregistrée dans « ${handle.name} »${t.ajoutes + t.misAJour ? ` (et ${t.ajoutes + t.misAJour} changement${t.ajoutes + t.misAJour > 1 ? 's' : ''} des collègues intégré${t.ajoutes + t.misAJour > 1 ? 's' : ''})` : ''}`);
      window.dispatchEvent(new Event('rs:refresh'));
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return; // choix du dossier annulé
      toast(`Enregistrement dans le dossier impossible (${e.message}). Téléchargement à la place.`, 'err');
    }
  }
  const contenu = payload();
  // Téléphone : la feuille de partage garde le nom exact du fichier ; en l'enregistrant dans le
  // dossier OneDrive (app Fichiers ou OneDrive), choisir « Remplacer ».
  try {
    const file = new File([contenu], myFileName(), { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: myFileName() });
      meta.dirty = false; meta.lastSave = new Date().toISOString(); saveMeta();
      toast(`Enregistrez « ${myFileName()} » dans le dossier partagé et choisissez « Remplacer ».`);
      window.dispatchEvent(new Event('rs:sync'));
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return; // partage annulé
  }
  const blob = new Blob([contenu], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: myFileName() });
  document.body.appendChild(a); a.click(); a.remove();
  meta.dirty = false; meta.lastSave = new Date().toISOString(); saveMeta();
  toast(`« ${myFileName()} » téléchargé : déposez-le dans le dossier partagé en remplaçant l'ancien. Si le nom a changé (« (1) »…), pas de souci : l'app le lit quand même et nettoie au prochain enregistrement depuis un ordinateur.`);
  window.dispatchEvent(new Event('rs:sync'));
}

export async function charger() {
  if (!isSandbox()) return;
  if (supportsFolder()) {
    try {
      const handle = await folderReady(true);
      if (!handle) { toast('Accès au dossier refusé.', 'err'); return; }
      report(await mergeTexts(await readFolder(handle)));
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
      toast(`Lecture du dossier impossible (${e.message}). Choisissez les fichiers à la main.`, 'err');
    }
  }
  // Chargement manuel : rappeler de prendre TOUS les fichiers, pas seulement le sien.
  const choisir = () => {
    const inp = h('input', { type: 'file', accept: '.json,application/json', multiple: true, style: { display: 'none' } });
    inp.addEventListener('change', async () => {
      const files = [...inp.files];
      const texts = await Promise.all(files.map(f => f.text()));
      inp.remove();
      if (!texts.length) return;
      report(await mergeTexts(texts));
      if (files.length === 1) {
        const seulLeMien = files[0].name.toLowerCase().startsWith(myFileName().replace(/\.json$/i, '').toLowerCase());
        toast(seulLeMien
          ? 'Seul votre fichier a été chargé : vous ne voyez pas les saisies des collègues. Rechargez en sélectionnant tous les fichiers du dossier.'
          : 'Un seul fichier chargé. Pour voir tout le travail de l\'équipe, sélectionnez tous les fichiers du dossier.', 'err');
      }
    });
    document.body.appendChild(inp);
    inp.click();
  };
  modal('Charger les versions de l\'équipe', h('div', { class: 'form' },
    h('p', null, 'Dans le dossier OneDrive partagé, sélectionnez ', h('strong', null, 'tous les fichiers « RessourceS_… »'), ', pas seulement le vôtre : chaque fichier contient le travail d\'un·e collègue.'),
    h('ul', { class: 'small', style: { margin: 0, paddingLeft: '20px' } },
      h('li', null, 'Ordinateur : ouvrez le dossier, puis Ctrl+A (Windows) ou Cmd+A (Mac), puis Ouvrir.'),
      h('li', null, 'Téléphone : « Sélectionner » en haut à droite, touchez chaque fichier, puis Ouvrir.')),
    h('p', { class: 'hint' }, 'Rien n\'est remplacé : les versions sont additionnées, la modification la plus récente l\'emporte.')),
  [{ label: 'Annuler', variant: 'secondary' }, { label: 'Choisir les fichiers', onClick: () => { choisir(); } }]);
}

/** À l'ouverture : si le dossier est relié et déjà autorisé, charge sans rien demander. */
export async function chargerAuDemarrage() {
  if (!isSandbox() || !supportsFolder()) return false;
  try {
    const handle = await folderReady(false);
    if (!handle) return false;
    report(await mergeTexts(await readFolder(handle)), true);
    return true;
  } catch { return false; }
}

export async function autosaveActive() {
  const st = await folderStatus();
  return st.mode === 'dossier' && st.relie && st.autorise;
}

export async function folderStatus() {
  if (!supportsFolder()) return { mode: 'fichiers' };
  const handle = await getFolder();
  if (!handle) return { mode: 'dossier', relie: false };
  let ok = false;
  try { ok = (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch { /* ignoré */ }
  return { mode: 'dossier', relie: true, nom: handle.name, autorise: ok };
}
