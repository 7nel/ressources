// Bilan de la CR : évolution pendant le passage, agrégée et anonyme, sur une ou plusieurs volées.
// Il décrit ce qui change pendant le passage ; il ne prouve pas que la CR en est la cause.
import { S, volees, refDate, nav } from '../state.js';
import { h, card, btn, empty, notice, badge, esc } from '../ui.js';
import { fmtDate, daysBetween } from '../domain.js';
import { bilanCR, PROFILS_CR, SEUIL_PROFIL, SEUIL_CPS_HAUSSE } from '../queries.js';

const state = { choix: null }; // identifiants de volées choisis (null = pas encore initialisé)
const fmt1 = v => v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
const fmt2 = v => v == null ? '—' : v.toFixed(2).replace('.', ',');
const signe = v => v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2).replace('.', ',')}`;
const sur = (n, total) => `${n} sur ${total}`;
const pl = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const nb = v => String(Math.round(v * 10) / 10).replace('.', ',');
const semaines = v => `${nb(v)} ${Math.round(v * 10) / 10 === 1 ? 'semaine' : 'semaines'}`;
const COURT = ['Décomp.', 'Remob.', 'Ré-expo.'];
const COULEUR_FAMILLE = { 'Branches': 'var(--cat1)', 'Projet': 'var(--cat2)', 'Méthodo / Orientation': 'var(--cat3)' };
const NB_PASTILLES_MAX = 24; // au-delà, une barre sur le total remplace les pastilles

/** Volées proposées : celles qui ont au moins une inscription. */
const voleesAvecEleves = () => {
  const ids = new Set(S.store.all('RS_Inscriptions').map(i => i.VoleeID));
  return volees().filter(v => ids.has(v.ID));
};
const terminee = v => v.DateFin < refDate();

/** Tableau accessible : légende lisible par lecteur d’écran ; les tableaux larges défilent dans leur carte. */
function tableau(legende, large, head, body) {
  const t = h('table', { class: `tbl${large ? ' bcr-large' : ''}` }, h('caption', { class: 'sr-only' }, legende), head, body);
  return h('div', null, h('div', { class: 'scroll-x' }, t),
    large && h('p', { class: 'hint bcr-defile no-print' }, 'Faites défiler le tableau pour voir toutes les colonnes →'));
}

function ramp(v) {
  const jours = [daysBetween(v.DateDebut, v.DateDebutRemob), daysBetween(v.DateDebutRemob, v.DateDebutReexpo), daysBetween(v.DateDebutReexpo, v.DateFin) + 1];
  const total = jours[0] + jours[1] + jours[2];
  const noms = ['Décompression', 'Remobilisation', 'Ré-exposition'];
  return h('div', { class: 'bcr-volee' },
    h('div', { class: 'bcr-volee-titre' }, h('strong', null, v.Title), h('span', { class: 'small muted' }, `${fmtDate(v.DateDebut)} – ${fmtDate(v.DateFin)}`), !terminee(v) && badge('en cours : provisoire', 'warn')),
    h('div', { class: 'ramp', role: 'list', 'aria-label': `Phases de la volée ${v.Title}` },
      noms.map((n, k) => h('div', { class: `p${k + 1}`, role: 'listitem', 'aria-label': `${n}, ${semaines(jours[k] / 7)}`, style: { flex: `${jours[k]} 1 0` } },
        h('span', null, jours[k] / total < 0.25 ? COURT[k] : n), h('span', { class: 'ramp-duree' }, `${nb(jours[k] / 7)} sem.`)))));
}

/** Une pastille par élève (n pleines sur total) ; au-delà de 24 élèves, une barre sur le total. */
function pastilles(n, total) {
  if (total > NB_PASTILLES_MAX) return h('span', { class: 'bcr-barre', 'aria-hidden': 'true' }, h('span', { style: { width: `${total ? n / total * 100 : 0}%` } }));
  return h('span', { class: 'bcr-dots', 'aria-hidden': 'true' }, Array.from({ length: total }, (_, i) => h('span', { class: i < n ? 'bcr-dot on' : 'bcr-dot' })));
}
const ligne = (nom, n, total) => h('div', { class: 'bcr-profil' },
  h('span', { class: 'bcr-profil-nom' }, nom), pastilles(n, total), h('strong', { class: 'bcr-profil-n' }, sur(n, total)));

function enBref(b) {
  const total = b.nActives - b.sansProfil, p = b.profils;
  const phrase = total
    ? `Sur ${pl(total, 'élève', 'élèves')} dont l’évolution est calculable : ${p.nette + p.petite} en amélioration${p.nette ? ` (dont ${p.nette} nettement)` : ''}, ${p.stable} sans évolution, ${p.recul} en baisse.`
    : 'Pas assez de semaines cotées pour décrire une évolution.';
  return card('En bref', {},
    h('p', { class: 'bcr-bref' }, phrase),
    h('p', null, 'Ces chiffres décrivent une évolution pendant le passage en CR. Ils ne disent pas que la CR en est la cause : d’autres facteurs jouent. Avec de petits effectifs, lire les nombres d’élèves plutôt que les moyennes.'));
}

function profilsCard(b) {
  const total = b.nActives - b.sansProfil;
  return card('Évolution des cotations pendant le passage', {
    hint: `Pour chaque élève : moyenne de (C + T) / 2 de la dernière semaine cotée moins celle de la première, décompression comprise. Amélioration dès +${nb(SEUIL_PROFIL.petite)} (nette dès +${nb(SEUIL_PROFIL.nette)}), baisse dès −${nb(SEUIL_PROFIL.petite)}, entre les deux : sans évolution (seuils arbitraires).`,
  }, total ? h('div', { class: 'bcr-profils' }, PROFILS_CR.map(p => ligne(p.label, b.profils[p.key], total))) : empty('Pas assez de semaines cotées pour décrire une évolution.'),
  total && total < 10 ? h('p', { class: 'hint' }, 'Moins de 10 élèves : lire les nombres, pas les proportions.') : null,
  b.sansProfil ? h('p', { class: 'hint' }, `${pl(b.sansProfil, 'élève', 'élèves')} sans évolution calculable (moins de deux semaines cotées).`) : null);
}

/** Marqueur propre à chaque famille (cercle, carré, triangle) : la forme double la couleur. */
function marqueur(forme, x, y, col) {
  const st = `fill="${col}" stroke="var(--card)" stroke-width="1.5"`;
  if (forme === 1) return `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" rx="1.5" ${st}/>`;
  if (forme === 2) return `<polygon points="${x},${y - 6} ${x + 6},${y + 4.5} ${x - 6},${y + 4.5}" ${st}/>`;
  return `<circle cx="${x}" cy="${y}" r="5" ${st}/>`;
}

/** Petit graphique : une ligne par famille, trois phases en abscisse. */
function ctChart(b, cle, titre) {
  const W = 330, H = 190, pl_ = 28, pr = 10, pt = 10, pb = 44;
  const x = k => pl_ + (W - pl_ - pr) * (0.15 + 0.35 * k);
  const y = v => pt + (H - pt - pb) * (1 - (v - 1) / 3);
  const valeurs = b.ct.map(r => `${r.groupe} : ${r.phases.filter(p => p.n).map(p => `${p.phase.toLowerCase()} ${fmt1(p[cle])}`).join(', ')}`).join(' ; ');
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${titre}, moyenne de 1 à 4 par phase et par famille de cours. ${valeurs}.`)}">`;
  for (let n = 1; n <= 4; n++) s += `<line x1="${pl_}" x2="${W - pr}" y1="${y(n)}" y2="${y(n)}" stroke="var(--line)"/><text x="${pl_ - 8}" y="${y(n) + 4}" text-anchor="end" font-size="13" fill="var(--muted)">${n}</text>`;
  COURT.forEach((p, k) => { s += `<text x="${x(k)}" y="${H - pb + 19}" text-anchor="middle" font-size="13" fill="var(--ink)">${p}</text>`; });
  b.ct.forEach((r, i) => {
    const pts = r.phases.map((p, k) => p.n ? [x(k), y(p[cle])] : null);
    const col = COULEUR_FAMILLE[r.groupe];
    for (let k = 0; k < 2; k++) if (pts[k] && pts[k + 1]) s += `<line x1="${pts[k][0]}" y1="${pts[k][1]}" x2="${pts[k + 1][0]}" y2="${pts[k + 1][1]}" stroke="${col}" stroke-width="2.5" stroke-linecap="round"/>`;
    pts.forEach(pt_ => { if (pt_) s += marqueur(i % 3, pt_[0], pt_[1], col); });
  });
  return h('figure', { class: 'bcr-fig' }, h('figcaption', null, titre), h('div', { class: 'chart', svg: s + '</svg>' }));
}

function cotationsCard(b) {
  if (!b.ct.length) return card('Cotations par phase', {}, empty('Aucune cotation pour ces volées.'));
  const legende = h('div', { class: 'legend' }, b.ct.map((r, i) => h('span', { class: 'legend-item bcr-key' }, h('span', { class: `swatch forme${i % 3}`, style: { background: COULEUR_FAMILLE[r.groupe] } }), r.groupe)));
  const tab = tableau('Cotations moyennes C et T par famille de cours et par phase', true,
    h('thead', null, h('tr', null, h('th', null, 'Famille'), ['Décompression', 'Remobilisation', 'Ré-exposition'].map(p => h('th', { class: 'num' }, p)))),
    h('tbody', null, b.ct.map(r => h('tr', null, h('th', { scope: 'row' }, r.groupe),
      r.phases.map(p => h('td', { class: 'num' }, p.n ? h('span', null, h('strong', null, `C ${fmt1(p.c)} · T ${fmt1(p.t)}`), h('div', { class: 'small muted' }, pl(p.n, 'élève', 'élèves'))) : '—'))))));
  return card('Cotations par phase et par famille de cours', { hint: 'Moyennes des élèves (chaque élève compte pour un) : comportement C et travail T, de 1 à 4. Le coaching n’est pas coté. Avec peu d’élèves, des écarts de quelques dixièmes ne sont pas interprétables : lire d’abord le tableau.' },
    legende, h('div', { class: 'bcr-figs' }, ctChart(b, 'c', 'Comportement (C)'), ctChart(b, 't', 'Travail (T)')), tab);
}

function notesCard(b) {
  return card('Notes', { hint: 'Moyenne pondérée de chaque élève. 4 est le seuil de suffisance. La décompression est formative : elle n’a pas de note.' },
    b.notes.some(n => n.n) ? tableau('Notes par phase', false,
      h('thead', null, h('tr', null, h('th', null, 'Phase'), h('th', { class: 'num' }, 'Moyenne des élèves'), h('th', { class: 'num' }, 'Élèves à 4 ou plus'))),
      h('tbody', null, b.notes.map(n => h('tr', null, h('th', { scope: 'row' }, n.phase), h('td', { class: 'num' }, fmt1(n.moy)), h('td', { class: 'num' }, n.n ? sur(n.suffisants, n.n) : '—'))))) : empty('Aucune note pour ces volées.'));
}

function cpsCard(b) {
  const n = Math.max(0, ...b.cps.map(c => c.n));
  return card('Compétences psychosociales (CPS)', { hint: `Moyenne des trois questionnaires (élève, titulaire, parents), de 1 à 5, entre l’entrée et la sortie, pour les élèves qui ont les deux passations. Un domaine est « en hausse » dès +${nb(SEUIL_CPS_HAUSSE)} (seuil arbitraire). Pas de moyenne globale.` },
    n ? tableau('CPS : moyennes à l’entrée et à la sortie, par domaine', true,
      h('thead', null, h('tr', null, h('th', null, 'Domaine'), ['Entrée', 'Sortie', 'Évolution', 'Élèves en hausse'].map(t => h('th', { class: 'num' }, t)))),
      h('tbody', null, b.cps.map(c => h('tr', null, h('th', { scope: 'row' }, c.nom), h('td', { class: 'num' }, fmt2(c.entree)), h('td', { class: 'num' }, fmt2(c.sortie)),
        h('td', { class: 'num' }, c.n ? signe(c.sortie - c.entree) : '—'), h('td', { class: 'num' }, c.n ? sur(c.hausse, c.n) : '—'))))) : empty('Aucun élève n’a encore les deux passations (entrée et sortie).'));
}

function bilansCard(b) {
  return card('Bilans réalisés', {}, h('div', { class: 'bcr-profils' }, b.bilans.map(x => ligne(x.type, x.fait, x.sur))));
}

/** CSV du bilan (agrégé, sans nom d’élève) : séparateur « ; », virgule décimale, BOM UTF-8 pour Excel. */
export function csvBilan(b, choisies, date) {
  const num = (v, d = 2) => v == null ? '' : Number(v).toFixed(d).replace('.', ',');
  const esc = c => { const t = String(c ?? ''); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = [['Section', 'Rubrique', 'Détail', 'Valeur', 'Élèves concernés', 'Sur']];
  const add = (...r) => rows.push(r);
  add('Général', 'Volées', choisies.map(v => v.Title).join(' + '), '', '', '');
  add('Général', 'Édité le', fmtDate(date), '', '', '');
  add('Général', 'Provisoire', choisies.some(v => !terminee(v)) ? 'oui (volée en cours)' : 'non', '', '', '');
  const e = b.effectifs;
  add('Élèves accueillis', 'Inscriptions', '', e.total, '', ''); add('Élèves accueillis', 'Terminées', '', e.terminees, '', '');
  add('Élèves accueillis', 'En cours', '', e.enCours, '', ''); add('Élèves accueillis', 'Interrompues', '', e.interrompues, '', '');
  const calculables = b.nActives - b.sansProfil;
  for (const p of PROFILS_CR) add('Évolution des cotations', p.label, 'moyenne (C+T)/2, dernière semaine cotée moins première', '', b.profils[p.key], calculables);
  add('Évolution des cotations', 'Sans évolution calculable', 'moins de deux semaines cotées', '', b.sansProfil, b.nActives);
  for (const r of b.ct) for (const p of r.phases) if (p.n) {
    add('Cotations par phase', r.groupe, `${p.phase} · comportement (C)`, num(p.c), p.n, '');
    add('Cotations par phase', r.groupe, `${p.phase} · travail (T)`, num(p.t), p.n, '');
  }
  for (const n of b.notes) if (n.n) add('Notes', n.phase, 'moyenne des élèves ; élèves à 4 ou plus', num(n.moy), n.suffisants, n.n);
  for (const c of b.cps) if (c.n) {
    add('CPS', c.nom, 'moyenne à l’entrée', num(c.entree), '', c.n); add('CPS', c.nom, 'moyenne à la sortie', num(c.sortie), '', c.n);
    add('CPS', c.nom, 'évolution ; élèves en hausse', num(c.sortie - c.entree), c.hausse, c.n);
  }
  for (const x of b.bilans) add('Bilans réalisés', x.type, '', '', x.fait, x.sur);
  add('Seuils (arbitraires)', 'Petite amélioration dès', '', num(SEUIL_PROFIL.petite, 1), '', ''); add('Seuils (arbitraires)', 'Nette amélioration dès', '', num(SEUIL_PROFIL.nette, 1), '', '');
  add('Seuils (arbitraires)', 'Domaine CPS en hausse dès', '', num(SEUIL_CPS_HAUSSE, 1), '', '');
  return '\uFEFF' + rows.map(r => r.map(esc).join(';')).join('\r\n') + '\r\n';
}

function telecharger(b, choisies) {
  const date = refDate();
  const nom = `bilan-cr_${choisies.map(v => v.Title.replace(/\s+/g, '-')).join('_')}_${date}.csv`;
  const url = URL.createObjectURL(new Blob([csvBilan(b, choisies, date)], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: nom });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const selecteur = card('Volées à analyser', { cls: 'no-print', hint: 'Plusieurs volées s’additionnent : les élèves sont comptés ensemble, sans comparaison.' },
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Volées' }, dispo.map(v => h('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(state.choix.includes(v.ID)), onClick: () => bascule(v.ID),
    }, v.Title, h('span', { class: 'meta' }, terminee(v) ? 'terminée' : 'en cours')))),
    h('div', { class: 'btn-row', style: { marginTop: '10px' } },
      btn('Toutes les volées terminées', () => { state.choix = dispo.filter(terminee).map(v => v.ID); redraw(); }, 'ghost sm'),
      btn('Toutes', () => { state.choix = dispo.map(v => v.ID); redraw(); }, 'ghost sm'),
      btn('Aucune', () => { state.choix = []; redraw(); }, 'ghost sm')));

  const b = choisies.length ? bilanCR(choisies.map(v => v.ID)) : null;
  const head = h('div', { class: 'page-head' },
    h('div', null, h('h1', null, 'Bilan de la CR'),
      h('div', { class: 'sub' }, 'Évolution des élèves pendant leur passage en classe ressource. Données agrégées et anonymes.')),
    h('div', { class: 'btn-row no-print' },
      btn('Exporter (CSV)', () => telecharger(b, choisies), 'secondary', { disabled: !b, title: b ? null : 'Choisissez d’abord une volée' }),
      btn('Imprimer / PDF', () => window.print(), 'secondary')));

  if (!choisies.length) return h('div', { class: 'page' }, head, selecteur, card(null, {}, empty('Choisissez au moins une volée.')));

  const e = b.effectifs;
  const provisoire = choisies.some(v => !terminee(v));

  return h('div', { class: 'page bilan-cr' },
    head,
    h('p', { class: 'print-only small' }, `Volées : ${choisies.map(v => v.Title).join(', ')} · édité le ${fmtDate(refDate())}${provisoire ? ' · provisoire (volée en cours)' : ''}`),
    selecteur,
    provisoire && notice('Une volée en cours est comprise : ses chiffres sont provisoires.', 'info'),
    card('Volées choisies', { hint: 'Les trois phases de chaque volée, à l’échelle de sa durée.' },
      h('div', { class: 'bcr-volees' }, choisies.map(ramp)),
      h('p', { class: 'bcr-effectifs' }, [pl(e.total, 'inscription', 'inscriptions'), pl(e.terminees, 'terminée', 'terminées'), `${e.enCours} en cours`, pl(e.interrompues, 'interrompue', 'interrompues')].join(' · '))),
    enBref(b), profilsCard(b), cotationsCard(b), notesCard(b), cpsCard(b), bilansCard(b));
}
