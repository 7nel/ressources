// Échange provisoire entre collègues par un dossier OneDrive partagé.
//
// Chaque personne a UN fichier dans le dossier : RessourceS_<initiales>.json (sa version complète).
// « Charger » fusionne tous les fichiers du dossier : un élément modifié par deux personnes
// garde la version la plus récente ; rien n'est jamais supprimé.
//
// Deux modes, choisis automatiquement :
//  - Dossier relié (Chrome / Edge sur ordinateur, dossier OneDrive synchronisé) : l'app lit et écrit
//    directement dans le dossier. Sauvegarder = 1 clic ; charger = automatique à l'ouverture
//    (ou 1 clic si le navigateur redemande l'autorisation). Dans l'app INSTALLÉE, l'enregistrement est
//    aussi automatique : relecture et fusion du dossier, puis écriture de son fichier.
//  - Sinon (Safari, Firefox, téléphone, aperçu) : le fichier est téléchargé, à déposer dans le dossier ;
//    pour charger, on sélectionne les fichiers du dossier (Ctrl+A).

import { S, moi, isSandbox } from './state.js';
import { toast, h, modal } from './ui.js';
import { saisieEnCours } from './voisins.js';

const META_KEY = 'ressources_echange_v1';
// dirty : des modifications ne sont enregistrées nulle part de sûr. lastSave : dernière écriture CONFIRMÉE dans le dossier partagé.
// lastDownload : dernier fichier téléchargé ou partagé (ce n'est pas une synchronisation). error : cause de l'échec en cours.
// secours : un fichier de secours a été téléchargé après un échec du dossier. Aucune donnée d'élève n'est conservée ici.
const meta = { dirty: false, lastSave: null, lastLoad: null, folderName: null, lastDownload: null, error: null, secours: false };
// Écriture automatique, rétablie le 2026-10-26 dans l'app installée seulement. Suspendue le 2026-10-24 parce qu'elle remplaçait
// le fichier sans relire le dossier et pouvait écraser le travail d'un autre appareil : elle relit et fusionne désormais tout
// le dossier (son propre fichier compris) avant d'écrire, comme « Sauvegarder ». Pour la couper : passer ce drapeau à false.
export const ECRITURE_AUTO = true;
let rev = 0;      // compte les modifications : une sauvegarde n'efface « non enregistré » que si rien n'a changé depuis l'envoi
let saving = false;
let dirHandle = null;
let loadedThisSession = false;

try { Object.assign(meta, JSON.parse(localStorage.getItem(META_KEY) || '{}')); } catch { /* défaut */ }
const saveMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* ignoré */ } };

export const getMeta = () => meta;
export const isDirty = () => meta.dirty;
export const wasLoadedThisSession = () => loadedThisSession;
const emit = () => window.dispatchEvent(new Event('rs:sync'));
export function markDirty() {
  rev++;
  const change = !meta.dirty || meta.secours;
  meta.dirty = true; meta.secours = false; // une saisie après un téléchargement de secours n'est plus couverte par ce fichier
  if (change) { saveMeta(); emit(); }
  scheduleAutosave();
}

/**
 * État affiché, un seul à la fois : jamais « enregistré » sans écriture confirmée dans le dossier.
 * `court` : libellé de la barre étroite ; `label` : phrase complète (menu, fenêtre d'aide, lecteurs d'écran) qui commence par le libellé court.
 */
export function syncState() {
  if (saving) return { kind: 'saving', court: 'Enregistrement…', label: 'Enregistrement… en cours dans le dossier' };
  if (meta.error) return meta.secours
    ? { kind: 'secours', court: 'Échec d\'enregistrement', label: 'Échec d\'enregistrement dans le dossier : une copie de secours a été téléchargée, mais le dossier partagé n\'est pas à jour', detail: meta.error }
    : { kind: 'error', court: 'Échec d\'enregistrement', label: 'Échec d\'enregistrement', detail: meta.error };
  if (meta.dirty) return { kind: 'dirty', court: 'Non enregistré', label: 'Non enregistré : des modifications ne sont pas encore dans le dossier' };
  if (meta.lastSave && (!meta.lastDownload || meta.lastSave >= meta.lastDownload)) return { kind: 'saved', court: 'Enregistré', label: 'Enregistré dans le dossier (contenu relu et identique)', at: meta.lastSave };
  if (meta.lastDownload) return { kind: 'download', court: 'Copie téléchargée', label: 'Copie téléchargée, à déposer dans le dossier partagé : le dossier n\'est pas à jour tant que ce n\'est pas fait', at: meta.lastDownload };
  return { kind: 'none', court: 'Non enregistré', label: 'Non enregistré : rien n\'a encore été enregistré dans le dossier' };
}

/** Écriture confirmée dans le dossier : seul cas où l'erreur disparaît. `r` = numéro de modification envoyé. */
function reussite(r) {
  meta.error = null; meta.secours = false;
  meta.lastSave = new Date().toISOString();
  meta.dirty = rev !== r; // modifié pendant l'écriture : reste « non enregistré »
  saveMeta(); emit();
  if (meta.dirty) scheduleAutosave();
}
function echec(message, { notifier = false } = {}) {
  const premiere = !meta.error;
  meta.error = message; meta.dirty = true; saveMeta(); emit();
  if (notifier && premiere) toast(`Enregistrement automatique impossible : ${message}. Vos modifications ne sont pas dans le dossier partagé : cliquez sur « Sauvegarder » pour réessayer.`, 'err', undefined, { visuel: true });
}

/* ---------- Sauvegarde automatique (app installée, dossier relié et autorisé uniquement) ---------- */
/** App installée (fenêtre à part) : Chrome et Edge l'ouvrent en « standalone » d'après le manifeste. */
export function estInstallee() {
  try { return ['standalone', 'window-controls-overlay', 'minimal-ui'].some(m => window.matchMedia?.(`(display-mode: ${m})`).matches); } catch { return false; }
}
/** L'enregistrement automatique peut-il fonctionner ici (le dossier doit encore être relié et autorisé) ? */
export const autoPossible = () => ECRITURE_AUTO && isSandbox() && supportsFolder() && estInstallee();

let autoTimer = null;
function scheduleAutosave() {
  if (!autoPossible()) return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(autosave, 1500);
}
export async function autosave() {
  autoTimer = null;
  if (saving) { autoTimer = setTimeout(autosave, 1500); return; } // une écriture est déjà en cours : on repasse après
  let handle;
  try { handle = await getFolder(); } catch { handle = null; }
  if (!handle) return; // aucun dossier relié : « non enregistré » reste affiché, le bouton reprend la main
  saving = true; emit();
  try {
    if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('autorisation du dossier à renouveler');
    // Relire et fusionner TOUT le dossier avant d'écrire : une version plus récente de son propre fichier
    // (autre appareil) ou des collègues est intégrée, jamais écrasée.
    const t = await mergeTexts(await readFolder(handle));
    const r = await writeOwnFile(handle);
    saving = false; reussite(r);
    const n = t.ajoutes + t.misAJour;
    if (n) {
      toast(`${n} changement${n > 1 ? 's' : ''} du dossier intégré${n > 1 ? 's' : ''} pendant l'enregistrement.`);
      // pas de nouvel affichage pendant une saisie : il effacerait les champs en cours ; l'écran suivant sera à jour
      if (!saisieEnCours()) window.dispatchEvent(new Event('rs:refresh'));
    }
  } catch (e) {
    saving = false;
    echec(e?.message || 'écriture impossible', { notifier: true });
  }
}
// Fermeture ou changement d'onglet avec une écriture en attente : on n'attend pas le délai.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && autoTimer) { clearTimeout(autoTimer); autosave(); }
});
/**
 * Écrit mon fichier puis RELIT son contenu complet et le compare, caractère par caractère, à ce qui a été envoyé.
 * Ce que cela confirme : le fichier du dossier local contient exactement cette version à l'instant de la relecture.
 * Ce que cela ne confirme pas : que OneDrive l'a déjà transmis aux autres appareils ou collègues.
 * Renvoie le numéro de modification qui a été écrit.
 */
async function writeOwnFile(handle) {
  const r = rev;
  const contenu = payload();
  const fh = await handle.getFileHandle(myFileName(), { create: true });
  const w = await fh.createWritable();
  await w.write(contenu);
  await w.close();
  const relu = await (await fh.getFile()).text();
  if (relu !== contenu) throw new Error('le fichier relu après écriture ne correspond pas à la version envoyée');
  return r;
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
/** Écriture dans le dossier partagé. Ne touche à l'état affiché que par son résultat. */
async function versDossier() {
  try {
    const handle = await folderReady(true);
    if (!handle) return { refus: true };
    // On intègre d'abord les versions des autres, pour que son propre fichier soit complet.
    const t = await mergeTexts(await readFolder(handle));
    const r = await writeOwnFile(handle);
    const doublons = await supprimerMesDoublons(handle); // déjà fusionnés ci-dessus
    return { ok: true, handle, t, r, doublons };
  } catch (e) {
    if (e?.name === 'AbortError') return { annule: true }; // choix du dossier annulé
    return { echec: e?.message || 'écriture impossible' };
  }
}

export async function sauvegarder() {
  if (!isSandbox() || saving) return;
  let secours = null; // cause de l'échec du dossier, si on bascule sur le téléchargement
  if (supportsFolder()) {
    saving = true; emit();
    let res;
    try { res = await versDossier(); } finally { saving = false; }
    if (res.annule) { emit(); return; }
    if (res.ok) {
      const { t, doublons, handle } = res;
      reussite(res.r);
      loadedThisSession = true; meta.lastLoad = meta.lastSave; saveMeta();
      if (doublons) toast(`${doublons} ancienne${doublons > 1 ? 's' : ''} copie${doublons > 1 ? 's' : ''} de votre fichier supprimée${doublons > 1 ? 's' : ''} (contenu conservé).`);
      const n = t.ajoutes + t.misAJour;
      toast(`Version enregistrée dans « ${handle.name} »${n ? ` (et ${n} changement${n > 1 ? 's' : ''} des collègues intégré${n > 1 ? 's' : ''})` : ''}${t.erreurs ? ` · ${t.erreurs} fichier${t.erreurs > 1 ? 's' : ''} illisible${t.erreurs > 1 ? 's' : ''} ignoré${t.erreurs > 1 ? 's' : ''}` : ''}`, t.erreurs ? 'err' : 'ok');
      window.dispatchEvent(new Event('rs:refresh'));
      return;
    }
    if (res.refus) {
      echec('accès au dossier refusé');
      toast('Accès au dossier refusé : la version n\'a pas été enregistrée.', 'err', undefined, { visuel: true });
      return;
    }
    secours = res.echec;
    echec(`écriture dans le dossier impossible (${secours})`);
    toast(`Enregistrement dans le dossier impossible (${secours}). Un fichier de secours est téléchargé : ce n'est pas une synchronisation, le dossier partagé n'a pas reçu votre version.`, 'err', undefined, { visuel: true });
  }
  const r = rev;
  const contenu = payload();
  const fin = () => { // fichier remis à l'utilisateur·trice : jamais présenté comme enregistré dans le dossier
    meta.lastDownload = new Date().toISOString();
    if (secours) meta.secours = true; // l'échec du dossier reste affiché, « non enregistré » aussi
    else meta.dirty = rev !== r;
    saveMeta(); emit();
  };
  // Téléphone : la feuille de partage garde le nom exact du fichier ; en l'enregistrant dans le
  // dossier OneDrive (app Fichiers ou OneDrive), choisir « Remplacer ».
  try {
    const file = new File([contenu], myFileName(), { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: myFileName() });
      fin();
      toast(`Enregistrez « ${myFileName()} » dans le dossier partagé et choisissez « Remplacer ». Tant que ce n'est pas fait, le dossier n'est pas à jour.`);
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return; // partage annulé
  }
  const blob = new Blob([contenu], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: myFileName() });
  document.body.appendChild(a); a.click(); a.remove();
  fin();
  toast(`« ${myFileName()} » téléchargé : déposez-le dans le dossier partagé en remplaçant l'ancien. Tant que ce n'est pas fait, le dossier n'est pas à jour. Si le nom a changé (« (1) »…), pas de souci : l'app le lit quand même et nettoie au prochain enregistrement depuis un ordinateur.`, secours ? 'err' : 'ok');
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

/** Dossier d'échange relié et autorisé (Chrome/Edge), pour lire les classeurs Forms CPS ; null sinon. */
export async function dossierEchange(interactive = false) {
  if (!supportsFolder()) return null;
  try { return await folderReady(interactive); } catch (e) { if (e?.name === 'AbortError') return null; throw e; }
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
  if (!autoPossible()) return false;
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
