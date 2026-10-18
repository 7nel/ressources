// Lecture minimale d'un classeur .xlsx (première feuille), sans bibliothèque externe.
// Suffit pour les classeurs de réponses Microsoft Forms : textes, nombres, dates (numéros de série Excel).
// Rien n'est envoyé ni conservé : le fichier est lu en mémoire.

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}

/** Fichiers du zip : Map nom → fonction asynchrone qui rend le contenu texte. */
function zipEntries(buf) {
  const b = new Uint8Array(buf);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Ce fichier n\'est pas un classeur Excel (.xlsx).');
  const count = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const files = new Map();
  const dec = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (u32(b, p) !== 0x02014b50) break;
    const method = u16(b, p + 10), csize = u32(b, p + 20);
    const nlen = u16(b, p + 28), xlen = u16(b, p + 30), clen = u16(b, p + 32), off = u32(b, p + 42);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
    files.set(name, async () => {
      const start = off + 30 + u16(b, off + 26) + u16(b, off + 28);
      const raw = b.subarray(start, start + csize);
      const data = method === 0 ? raw : method === 8 ? await inflate(raw) : null;
      if (!data) throw new Error('Compression non prise en charge.');
      return dec.decode(data);
    });
    p += 46 + nlen + xlen + clen;
  }
  return files;
}

const unxml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16))).replace(/&#(\d+);/g, (_, x) => String.fromCodePoint(Number(x)))
  .replace(/&amp;/g, '&');
const texts = xml => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t[^>]*\/>/g)].map(m => unxml(m[1] || '')).join('');
function colIndex(ref) {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Lignes de la première feuille : tableau de tableaux (texte ou nombre, null si vide). */
export async function lireXlsx(buf) {
  const files = zipEntries(buf);
  const shared = [];
  if (files.has('xl/sharedStrings.xml')) {
    const xml = await files.get('xl/sharedStrings.xml')();
    for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(texts(m[1]));
  }
  let sheet = 'xl/worksheets/sheet1.xml';
  if (!files.has(sheet)) sheet = [...files.keys()].filter(n => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0];
  if (!sheet) throw new Error('Aucune feuille dans le classeur.');
  const xml = await files.get(sheet)();
  const rows = [];
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1], body = cm[2] || '';
      const ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
      const t = (attrs.match(/\bt="(\w+)"/) || [])[1];
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let val = null;
      if (t === 's') val = v != null ? shared[Number(v)] ?? null : null;
      else if (t === 'inlineStr') val = texts(body);
      else if (t === 'str' || t === 'e') val = v != null ? unxml(v) : null;
      else if (t === 'b') val = v === '1';
      else if (v != null) val = Number(v);
      row[ref ? colIndex(ref) : row.length] = val;
    }
    rows.push(Array.from(row, x => (x === undefined ? null : x)));
  }
  return rows;
}

/** Numéro de série Excel (jours depuis 1899-12-30) → date ISO AAAA-MM-JJ. */
export function serieVersISO(v) {
  if (typeof v !== 'number') return typeof v === 'string' ? v.slice(0, 10) : null;
  const d = new Date(Math.round((v - 25569) * 86400000));
  return d.toISOString().slice(0, 10);
}
