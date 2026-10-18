// Fiches QR des questionnaires Forms CPS : une par source, à imprimer et remettre en main propre.
import { S, nav, back, insc, eleve, volee } from '../state.js';
import { h, card, btn, seg, notice, toast } from '../ui.js';
import { SOURCES, MOMENTS, lienForms, codeInscription } from '../cps-forms.js';
import { qrSVG } from '../qr.js';

const TEXTES = {
  Eleve: {
    titre: 'Questionnaire élève',
    corps: 'Scanne ce code avec l\'appareil photo de ton téléphone, ou ouvre le lien sur un ordinateur. Réponds seul·e et honnêtement : il n\'y a pas de bonne ou de mauvaise réponse. Environ 10 minutes.',
  },
  Titulaire: {
    titre: 'Questionnaire titulaire',
    corps: 'Merci de répondre selon ce que vous observez en classe ces dernières semaines. Scannez le code ou ouvrez le lien. Environ 10 minutes.',
  },
  Parents: {
    titre: 'Questionnaire parents',
    corps: 'Merci de répondre selon ce que vous observez à la maison ces dernières semaines. Une seule réponse par famille. Scannez le code avec l\'appareil photo de votre téléphone. Environ 10 minutes.',
  },
};

export async function render(params) {
  const i = insc(params.insc);
  if (!i) return h('div', { class: 'page' }, notice('Inscription introuvable.', 'danger'));
  const e = eleve(i.EleveID);
  const v = volee(i.VoleeID);
  const deja = new Set(S.store.where('RS_CPS', c => c.InscriptionID === i.ID).map(c => c.Moment));
  const moment = MOMENTS.includes(params.moment) ? params.moment : (deja.has('Entrée') ? 'Sortie' : 'Entrée');
  const code = await codeInscription(i);
  const qui = `${e.Prenom} ${String(e.Nom || '').slice(0, 1)}.`;
  const sources = SOURCES.filter(s => !params.src || s.key === params.src);

  const fiches = sources.map(s => {
    const url = lienForms(s.key, code, moment);
    if (!url) return card(TEXTES[s.key].titre, {}, notice(`Forms ${s.label.toLowerCase()} non configuré (js/config.js, CPS_FORMS).`, 'danger'));
    return h('section', { class: 'card qr-fiche' },
      h('div', { class: 'qr-img', svg: qrSVG(url, { label: `QR code du ${TEXTES[s.key].titre.toLowerCase()}` }) }),
      h('div', { class: 'qr-txt' },
        h('div', { class: 'small muted' }, 'Classe RessourceS · compétences psychosociales'),
        h('h2', null, TEXTES[s.key].titre),
        s.key !== 'Eleve' && h('p', null, h('strong', null, `Pour : ${qui}`)),
        h('p', null, TEXTES[s.key].corps),
        h('p', { class: 'small' }, 'Code ', h('strong', { class: 'mono' }, code), ` · ${moment}`, ' — déjà rempli dans le questionnaire, ne pas le modifier.'),
        h('div', { class: 'btn-row no-print' },
          btn('Copier le lien', async () => {
            try { await navigator.clipboard.writeText(url); toast('Lien copié'); } catch { toast('Copie impossible : ouvrez le lien et copiez l\'adresse.', 'err'); }
          }, 'secondary'),
          h('a', { class: 'btn ghost', href: url, target: '_blank', rel: 'noopener' }, 'Ouvrir'))));
  });

  return h('div', { class: 'page' },
    h('div', { class: 'no-print' },
      h('button', { type: 'button', class: 'back', onClick: () => back('cps', { eleve: e.ID }) }, '‹ Retour'),
      h('div', { class: 'page-head' },
        h('div', null, h('h1', null, `QR codes CPS · ${e.Prenom} ${e.Nom}`), h('div', { class: 'sub' }, `${v?.Title || ''} · code ${code}`)),
        h('div', { class: 'btn-row' }, btn('Imprimer', () => window.print()))),
      h('div', { class: 'row', style: { alignItems: 'center', gap: '12px', flexWrap: 'wrap', margin: '8px 0 16px' } },
        h('span', { class: 'small' }, 'Moment'),
        seg(MOMENTS, moment, m => nav('cpsqr', { insc: i.ID, moment: m, src: params.src }), 'Moment de la passation'),
        seg([{ value: '', label: 'Les 3' }, ...SOURCES.map(s => ({ value: s.key, label: s.label }))], params.src || '', s => nav('cpsqr', { insc: i.ID, moment, src: s }), 'Questionnaires à imprimer')),
      h('p', { class: 'hint' }, 'Remettez chaque fiche en main propre : le questionnaire ne demande pas de connexion, le code est le seul lien avec l\'élève.')),
    h('div', { class: 'qr-list' }, fiches));
}
