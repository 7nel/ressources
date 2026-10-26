import { S, nav, back, insc, eleve, volee, nomEleve, refDate, phaseInscription } from '../state.js';
import { h, card, btn, field, input, textarea, checkbox, notice, toast, empty, phaseBadge } from '../ui.js';
import { DOMAINES, TYPES_BILAN, fmtDate } from '../domain.js';
import { bilanDe, preuves } from '../queries.js';
import { enteteEleve } from '../voisins.js';

const KEY = { 'Mise en route': 'MR', 'Intermédiaire': 'INT', 'Final': 'FIN' };

export function render(params) {
  const i = insc(params.insc);
  if (!i) return h('div', { class: 'page' }, notice('Inscription introuvable.', 'danger'));
  const e = eleve(i.EleveID);
  const v = volee(i.VoleeID);
  const type = params.type && KEY[params.type] ? params.type
    : (TYPES_BILAN.map(t => t.label).find(t => !bilanDe(i.ID, t)) || 'Final');
  const existing = bilanDe(i.ID, type);
  const b = existing ? { ...existing } : {
    DateBilan: refDate(), Participants: `${e.Prenom}, ${i.Titulaire}`, DomainesPrioritaires: [], Objectif: '', PointsAppui: '', Fragilites: '',
    Avancee: '', AjustementObjectif: '', PlanRetour: '', ObjectifSortie: '', PassationTitulaire: false, DatePassation: null,
    DateSignatureEleve: null, DateValidationCoord: null,
  };
  const mr = bilanDe(i.ID, 'Mise en route');
  const it = bilanDe(i.ID, 'Intermédiaire');
  const t = (k, ph) => textarea(b[k] || '', { placeholder: ph || '', onInput: ev => { b[k] = ev.target.value; } });
  const d = k => input('date', b[k] || '', { onChange: ev => { b[k] = ev.target.value || null; } });
  const errBox = h('div');

  const tabs = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Type de bilan' }, TYPES_BILAN.map(x => h('button', {
    type: 'button', role: 'tab', 'aria-selected': String(x.label === type), 'aria-pressed': String(x.label === type),
    onClick: () => nav('bilan', { insc: i.ID, type: x.label }),
  }, `${bilanDe(i.ID, x.label) ? '✓ ' : ''}${x.label}`)));

  let specific;
  if (type === 'Mise en route') {
    specific = [
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Domaines prioritaires (boussole)'),
        h('div', { style: { display: 'flex', flexDirection: 'column' } }, DOMAINES.map(dm => checkbox(dm, b.DomainesPrioritaires?.includes(dm), on => {
          const set = new Set(b.DomainesPrioritaires || []); on ? set.add(dm) : set.delete(dm); b.DomainesPrioritaires = DOMAINES.filter(x => set.has(x));
        })))),
      field('Objectif personnel (co-construit avec l\'élève)', t('Objectif', 'Formulé avec les mots de l\'élève')),
      h('div', { class: 'row' }, field('Points d\'appui', t('PointsAppui')), field('Fragilités', t('Fragilites', 'Observables scolaires, sans élément médical ni familial'))),
    ];
  } else if (type === 'Intermédiaire') {
    specific = [
      field('Avancée : réussites étayées sur preuves', t('Avancee', 'Ce que le dossier montre (voir le panneau ci-contre)')),
      field('Ajustement de l\'objectif', t('AjustementObjectif')),
      field('Esquisse du plan de retour', t('PlanRetour')),
    ];
  } else {
    specific = [
      field('Plan de retour (consolidé)', t('PlanRetour')),
      field('Objectif en intégration (objectif de sortie)', t('ObjectifSortie')),
      h('div', { class: 'row', style: { alignItems: 'flex-end' } },
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Passation au titulaire'), checkbox('Passation faite', b.PassationTitulaire, on => { b.PassationTitulaire = on; })),
        field('Date de la passation', d('DatePassation'))),
    ];
  }

  async function save() {
    if (!b.DateBilan) { errBox.replaceChildren(notice('La date du bilan est obligatoire.', 'danger')); return false; }
    const rec = {
      ...b, Title: `${nomEleve(e)} · ${type}`, InscriptionID: i.ID, EleveID: e.ID, TypeBilan: type, CleUnique: `I${i.ID}-${KEY[type]}`,
    };
    delete rec.ID; delete rec.Created; delete rec.Modified;
    if (existing) await S.store.update('RS_Bilans', existing.ID, rec);
    else await S.store.add('RS_Bilans', rec);
    toast(`Bilan « ${type} » enregistré`);
    nav('bilan', { insc: i.ID, type });
  }

  const reminder = type !== 'Mise en route' && card('Rappel', { cls: 'flat' },
    mr ? [h('p', null, h('strong', null, 'Objectif personnel : '), mr.Objectif || '—'),
      mr.DomainesPrioritaires?.length ? h('p', { class: 'small muted' }, `Domaines prioritaires : ${mr.DomainesPrioritaires.join(' · ')}`) : null] : empty('Pas de bilan de mise en route.'),
    type === 'Final' && it?.AjustementObjectif ? h('p', null, h('strong', null, 'Ajustement : '), it.AjustementObjectif) : null,
    type === 'Final' && it?.PlanRetour ? h('p', null, h('strong', null, 'Esquisse du plan de retour : '), it.PlanRetour) : null);

  let preuvesCard = null;
  if (type !== 'Mise en route') {
    const p = preuves(i, existing?.DateBilan || refDate());
    preuvesCard = card('Ce que dit le dossier', { cls: 'preuves', hint: `Traces jusqu'au ${fmtDate(existing?.DateBilan || refDate())}, une ligne par branche (moyenne pondérée ≥ 4 : réussite). Seuils indicatifs, à valider en équipe ; aucune moyenne de C/T.` },
      h('div', { class: 'grid grid-2' },
        h('div', null, h('h3', null, 'Réussites'), p.ok.length ? h('ul', null, p.ok.map(x => h('li', null, x))) : empty('—')),
        h('div', null, h('h3', null, 'Fragilités'), p.frag.length ? h('ul', null, p.frag.map(x => h('li', null, x))) : empty('—'))));
  }

  return h('div', { class: 'page' },
    enteteEleve({ route: 'bilan', eleveId: e.ID, inscId: i.ID, params: (x, xi) => ({ insc: xi.ID, type: params.type }), enregistrer: save, retour: { label: '‹ Retour au dossier', onClick: () => back('dossier', { eleve: e.ID, insc: i.ID }) } }),
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, `Bilans · ${nomEleve(e)}`), h('div', { class: 'sub' }, `${v.Title} · `, phaseBadge(phaseInscription(i)))),
      tabs),
    h('div', { class: 'cols-dossier' },
      h('div', { class: 'stack' },
        card(`${type}${existing ? '' : ' (nouveau)'}`, { hint: 'Élaboré par les enseignant·es de la classe ressource.' }, h('div', { class: 'form' },
          h('div', { class: 'row' }, field('Date', d('DateBilan')), field('Participants', input('text', b.Participants, { onInput: ev => { b.Participants = ev.target.value; } }))),
          specific,
          h('div', { class: 'row' },
            field('Signé par l\'élève le', d('DateSignatureEleve')),
            field('Validé par la coordination le', d('DateValidationCoord'))),
          h('p', { class: 'hint' }, 'PDF signé en pièce jointe : disponible quand l\'app sera reliée à SharePoint.'),
          errBox,
          h('div', { class: 'btn-row' }, btn('Enregistrer', save), btn('Imprimer', () => window.print(), 'secondary'))))),
      h('div', { class: 'stack' }, reminder, preuvesCard)));
}
