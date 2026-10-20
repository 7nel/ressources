// Bilan de la CR : évolution pendant le passage, agrégée et anonyme, sur une ou plusieurs volées.
// Il décrit ce qui change pendant le passage ; il ne prouve pas que la CR en est la cause.
import { S, volees, refDate, nav } from '../state.js';
import { h, card, btn, empty, notice, badge } from '../ui.js';
import { fmtDate, daysBetween } from '../domain.js';
import { bilanCR, PROFILS_CR, SEUIL_PROFIL, SEUIL_CPS_HAUSSE } from '../queries.js';

const state = { choix: null }; // identifiants de volées choisis (null = pas encore initialisé)
const fmt1 = v => v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
const fmt2 = v => v == null ? '—' : v.toFixed(2).replace('.', ',');
const signe = v => v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2).replace('.', ',')}`;
const sur = (n, total) => `${n} sur ${total}`;
const COURT = ['Décomp.', 'Remob.', 'Ré-expo.'];
const COULEUR_FAMILLE = { 'Branches': 'var(--cat1)', 'Projet': 'var(--cat2)', 'Méthodo / Orientation': 'var(--cat3)' };

/** Volées proposées : celles qui ont au moins une inscription. */
const voleesAvecEleves = () => {
  const ids = new Set(S.store.all('RS_Inscriptions').map(i => i.VoleeID));
  return volees().filter(v => ids.has(v.ID));
};
const terminee = v => v.DateFin < refDate();

function ramp(v) {
  const jours = [daysBetween(v.DateDebut, v.DateDebutRemob), daysBetween(v.DateDebutRemob, v.DateDebutReexpo), daysBetween(v.DateDebutReexpo, v.DateFin) + 1];
  const noms = ['Décompression', 'Remobilisation', 'Ré-exposition'];
  return h('div', { class: 'bcr-volee' },
    h('div', { class: 'bcr-volee-titre' }, h('strong', null, v.Title), h('span', { class: 'small muted' }, `${fmtDate(v.DateDebut)} – ${fmtDate(v.DateFin)}`), !terminee(v) && badge('en cours : provisoire', 'warn')),
    h('div', { class: 'ramp', role: 'img', 'aria-label': noms.map((n, k) => `${n} ${Math.round(jours[k] / 7 * 10) / 10} semaines`).join(', ') },
      noms.map((n, k) => h('div', { class: `p${k + 1}`, title: `${n} · ${fmt1(jours[k] / 7)} sem.`, style: { flex: `${jours[k]} 1 0` } },
        jours[k] / (jours[0] + jours[1] + jours[2]) < 0.25 ? `${COURT[k]} · ${fmt1(jours[k] / 7)}` : `${n} · ${fmt1(jours[k] / 7)} sem.`))));
}

function profilsCard(b) {
  const total = b.nActives - b.sansProfil;
  const max = Math.max(1, ...Object.values(b.profils));
  return card('Évolution des cotations pendant le passage', {
    hint: `Pour chaque élève : moyenne de (C + T) / 2 de la dernière semaine cotée moins celle de la première semaine, décompression comprise. Petite amélioration dès +${String(SEUIL_PROFIL.petite).replace('.', ',')}, nette dès +${String(SEUIL_PROFIL.nette).replace('.', ',')} (seuils arbitraires).`,
  }, total ? h('div', { class: 'bcr-profils' }, PROFILS_CR.map(p => h('div', { class: 'bcr-profil' },
    h('span', { class: 'bcr-profil-nom' }, p.label),
    h('span', { class: 'bcr-barre', 'aria-hidden': 'true' }, h('span', { class: p.key === 'recul' ? 'warn' : '', style: { width: `${b.profils[p.key] / max * 100}%` } })),
    h('strong', { class: 'bcr-profil-n' }, sur(b.profils[p.key], total))))) : empty('Pas assez de semaines cotées pour décrire une évolution.'),
  b.sansProfil ? h('p', { class: 'hint' }, `${b.sansProfil} élève${b.sansProfil > 1 ? 's' : ''} sans évolution calculable (moins de deux semaines cotées).`) : null);
}

/** Petit graphique : une ligne par famille, trois phases en abscisse. */
function ctChart(b, cle, titre) {
  const W = 330, H = 190, pl = 28, pr = 10, pt = 10, pb = 44;
  const x = k => pl + (W - pl - pr) * (0.15 + 0.35 * k);
  const y = v => pt + (H - pt - pb) * (1 - (v - 1) / 3);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${titre} moyen par phase et par famille de cours, de 1 à 4">`;
  for (let n = 1; n <= 4; n++) s += `<line x1="${pl}" x2="${W - pr}" y1="${y(n)}" y2="${y(n)}" stroke="var(--line)"/><text x="${pl - 8}" y="${y(n) + 4}" text-anchor="end" font-size="12" fill="var(--muted)">${n}</text>`;
  ['Décompression', 'Remobilisation', 'Ré-exposition'].forEach((p, k) => {
    s += `<text x="${x(k)}" y="${H - pb + 18}" text-anchor="middle" font-size="12" fill="var(--ink)">${p === 'Décompression' ? 'Décomp.' : p === 'Remobilisation' ? 'Remob.' : 'Ré-expo.'}</text>`;
  });
  for (const r of b.ct) {
    const pts = r.phases.map((p, k) => p.n ? [x(k), y(p[cle])] : null);
    const col = COULEUR_FAMILLE[r.groupe];
    for (let k = 0; k < 2; k++) if (pts[k] && pts[k + 1]) s += `<line x1="${pts[k][0]}" y1="${pts[k][1]}" x2="${pts[k + 1][0]}" y2="${pts[k + 1][1]}" stroke="${col}" stroke-width="2.5" stroke-linecap="round"/>`;
    pts.forEach(pt_ => { if (pt_) s += `<circle cx="${pt_[0]}" cy="${pt_[1]}" r="4.5" fill="${col}" stroke="var(--card)" stroke-width="1.5"/>`; });
  }
  return h('figure', { class: 'bcr-fig' }, h('figcaption', null, titre), h('div', { class: 'chart', svg: s + '</svg>' }));
}

function cotationsCard(b) {
  if (!b.ct.length) return card('Cotations par phase', {}, empty('Aucune cotation pour ces volées.'));
  const legende = h('div', { class: 'legend' }, b.ct.map(r => h('span', { class: 'legend-item bcr-key' }, h('span', { class: 'swatch', style: { background: COULEUR_FAMILLE[r.groupe] } }), r.groupe)));
  const tab = h('div', { class: 'scroll-x' }, h('table', { class: 'tbl bcr-large' },
    h('thead', null, h('tr', null, h('th', null, 'Famille'), ['Décompression', 'Remobilisation', 'Ré-exposition'].map(p => h('th', { class: 'num' }, p)))),
    h('tbody', null, b.ct.map(r => h('tr', null, h('th', { scope: 'row' }, r.groupe),
      r.phases.map(p => h('td', { class: 'num' }, p.n ? h('span', null, h('strong', null, `C ${fmt1(p.c)} · T ${fmt1(p.t)}`), h('div', { class: 'small muted' }, `${p.n} élève${p.n > 1 ? 's' : ''}`)) : '—')))))));
  return card('Cotations par phase et par famille de cours', { hint: 'Moyennes des élèves (chaque élève compte pour un) : comportement C et travail T, de 1 à 4. Le coaching n\'est pas coté.' },
    legende, h('div', { class: 'bcr-figs' }, ctChart(b, 'c', 'Comportement (C)'), ctChart(b, 't', 'Travail (T)')), tab);
}

function notesCard(b) {
  return card('Notes', { hint: 'Moyenne pondérée de chaque élève. La décompression est formative : elle n\'a pas de note.' },
    b.notes.some(n => n.n) ? h('div', { class: 'scroll-x' }, h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, h('th', null, 'Phase'), h('th', { class: 'num' }, 'Moyenne des élèves'), h('th', { class: 'num' }, 'Élèves à 4 ou plus'))),
      h('tbody', null, b.notes.map(n => h('tr', null, h('th', { scope: 'row' }, n.phase), h('td', { class: 'num' }, fmt1(n.moy)), h('td', { class: 'num' }, n.n ? sur(n.suffisants, n.n) : '—')))))) : empty('Aucune note pour ces volées.'));
}

function cpsCard(b) {
  const n = Math.max(0, ...b.cps.map(c => c.n));
  return card('Compétences psychosociales (CPS)', { hint: `Moyenne des trois questionnaires (élève, titulaire, parents), de 1 à 5, entre l'entrée et la sortie, pour les élèves qui ont les deux passations. Un domaine est « en hausse » dès +${String(SEUIL_CPS_HAUSSE).replace('.', ',')} (seuil arbitraire). Pas de moyenne globale.` },
    n ? h('div', { class: 'scroll-x' }, h('table', { class: 'tbl bcr-large' },
      h('thead', null, h('tr', null, h('th', null, 'Domaine'), ['Entrée', 'Sortie', 'Évolution', 'Élèves en hausse'].map(t => h('th', { class: 'num' }, t)))),
      h('tbody', null, b.cps.map(c => h('tr', null, h('th', { scope: 'row' }, c.nom), h('td', { class: 'num' }, fmt2(c.entree)), h('td', { class: 'num' }, fmt2(c.sortie)),
        h('td', { class: 'num' }, c.n ? signe(c.sortie - c.entree) : '—'), h('td', { class: 'num' }, c.n ? sur(c.hausse, c.n) : '—')))))) : empty('Aucun élève n\'a encore les deux passations (entrée et sortie).'));
}

function bilansCard(b) {
  return card('Bilans réalisés', {}, h('div', { class: 'bcr-profils' }, b.bilans.map(x => h('div', { class: 'bcr-profil' },
    h('span', { class: 'bcr-profil-nom' }, x.type), h('span', { class: 'bcr-barre', 'aria-hidden': 'true' }, h('span', { style: { width: `${x.sur ? x.fait / x.sur * 100 : 0}%` } })), h('strong', { class: 'bcr-profil-n' }, sur(x.fait, x.sur))))));
}

export function render() {
  const dispo = voleesAvecEleves();
  if (state.choix == null) {
    const avecSuivis = new Set(S.store.all('RS_Suivis').map(x => x.VoleeID ?? S.store.get('RS_Inscriptions', x.InscriptionID)?.VoleeID));
    const derniere = [...dispo].filter(v => terminee(v) && avecSuivis.has(v.ID)).at(-1) || [...dispo].filter(terminee).at(-1) || dispo.at(-1);
    state.choix = derniere ? [derniere.ID] : [];
  }
  state.choix = state.choix.filter(id => dispo.some(v => v.ID === id));
  const redraw = () => nav('bilancr');
  const bascule = id => { state.choix = state.choix.includes(id) ? state.choix.filter(x => x !== id) : [...state.choix, id]; redraw(); };
  const choisies = dispo.filter(v => state.choix.includes(v.ID));

  const selecteur = card('Volées à analyser', { cls: 'no-print', hint: 'Plusieurs volées s\'additionnent : les élèves sont comptés ensemble, sans comparaison.' },
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Volées' }, dispo.map(v => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(state.choix.includes(v.ID)), onClick: () => bascule(v.ID),
    }, v.Title, h('span', { class: 'meta' }, terminee(v) ? 'terminée' : 'en cours')))),
    h('div', { class: 'btn-row', style: { marginTop: '10px' } },
      btn('Toutes les volées terminées', () => { state.choix = dispo.filter(terminee).map(v => v.ID); redraw(); }, 'ghost sm'),
      btn('Toutes', () => { state.choix = dispo.map(v => v.ID); redraw(); }, 'ghost sm')));

  const head = h('div', { class: 'page-head' },
    h('div', null, h('h1', null, 'Bilan de la CR'),
      h('div', { class: 'sub' }, 'Évolution des élèves pendant leur passage en classe ressource. Données agrégées et anonymes.')),
    h('div', { class: 'btn-row no-print' }, btn('Imprimer / PDF', () => window.print(), 'secondary')));

  if (!choisies.length) return h('div', { class: 'page' }, head, selecteur, card(null, {}, empty('Choisissez au moins une volée.')));

  const b = bilanCR(choisies.map(v => v.ID));
  const e = b.effectifs;
  const provisoire = choisies.some(v => !terminee(v));
  const tuile = (num, lab) => h('div', { class: 'tile' }, h('div', { class: 'num' }, String(num)), h('div', { class: 'lab' }, lab));

  return h('div', { class: 'page bilan-cr' },
    head,
    h('p', { class: 'print-only small' }, `Volées : ${choisies.map(v => v.Title).join(', ')} · édité le ${fmtDate(refDate())}`),
    selecteur,
    provisoire && notice('Une volée en cours est comprise : ses chiffres sont provisoires.', 'info'),
    card('Phases', { hint: 'Les trois phases de chaque volée choisie, à l\'échelle de sa durée.' }, h('div', { class: 'bcr-volees' }, choisies.map(ramp))),
    card('Élèves accueillis', {}, h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' } },
      tuile(e.total, 'inscriptions'), tuile(e.terminees, 'terminées'), tuile(e.enCours, 'en cours'), tuile(e.interrompues, 'interrompues'))),
    profilsCard(b), cotationsCard(b), notesCard(b), cpsCard(b), bilansCard(b),
    h('p', { class: 'hint' }, 'Ces chiffres décrivent une évolution pendant le passage en CR. Ils ne disent pas que la CR en est la cause : d\'autres facteurs jouent. Avec de petits effectifs, lire les nombres d\'élèves plutôt que les moyennes.'));
}
