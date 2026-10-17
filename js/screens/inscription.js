import { S, nav, back, eleve, insc, volee, volees, refDate, nomEleve, voleeAt } from '../state.js';
import { h, card, btn, field, select, input, notice, toast, checkbox } from '../ui.js';
import { DEGRES, STATUTS_INSCRIPTION, cleDoublon, nextVolee, fmtDate } from '../domain.js';

export function render(params) {
  const editing = params.insc ? insc(params.insc) : null;
  let eleveId = editing ? editing.EleveID : (params.eleve ? Number(params.eleve) : null);
  const ref = refDate();
  const defaultVolee = voleeAt(ref) || nextVolee(ref, volees()) || volees().at(-1);

  /* ---- Élève ---- */
  const nom = input('text', '', { autocomplete: 'off', required: true });
  const prenom = input('text', '', { autocomplete: 'off', required: true });
  const dupBox = h('div');
  let homonymeOk = false;
  const checkDup = () => {
    homonymeOk = false;
    if (!nom.value.trim() || !prenom.value.trim()) { dupBox.replaceChildren(); return; }
    const key = cleDoublon(nom.value, prenom.value);
    const matches = S.store.where('RS_Eleves', e => e.CleDoublon === key);
    if (!matches.length) { dupBox.replaceChildren(); return; }
    dupBox.replaceChildren(h('div', { class: 'notice warn' },
      h('p', null, h('strong', null, 'Attention : un dossier existe déjà avec ce nom (R2).')),
      ...matches.map(e => h('div', { class: 'btn-row', style: { marginBottom: '6px' } },
        h('span', null, `${nomEleve(e)} · ${e.Statut}`),
        btn('Utiliser ce dossier', () => nav('inscription', { eleve: e.ID }), 'small'))),
      checkbox('C\'est une autre personne (homonyme) : créer un nouveau dossier', false, v => { homonymeOk = v; })));
  };
  nom.addEventListener('input', checkDup);
  prenom.addEventListener('input', checkDup);

  /* ---- Inscription ---- */
  const e0 = eleveId ? eleve(eleveId) : null;
  const vSel = select(volees().map(v => ({ value: v.ID, label: `${v.Title} (${fmtDate(v.DateDebut, { year: false })}–${fmtDate(v.DateFin)})` })), editing ? editing.VoleeID : defaultVolee?.ID);
  const deg = select(['', ...DEGRES], editing?.Degre || '');
  const classe = input('text', editing?.ClasseOrigine, { placeholder: 'ex. 10CO3' });
  const tit = input('text', editing?.Titulaire, { placeholder: 'Prénom Nom' });
  const profs = ['Francais', 'Allemand', 'Anglais', 'Maths', 'Sciences'].map(k => ({ k, el: input('text', editing?.[`Prof${k}`], { placeholder: 'sigle', style: 'max-width:140px' }) }));
  const statut = select(STATUTS_INSCRIPTION, editing?.StatutInscription || 'En cours');
  const errBox = h('div');

  async function save() {
    const errs = [];
    if (!eleveId) {
      if (!nom.value.trim() || !prenom.value.trim()) errs.push('Nom et prénom sont obligatoires.');
      const dup = S.store.where('RS_Eleves', e => e.CleDoublon === cleDoublon(nom.value, prenom.value));
      if (dup.length && !homonymeOk) errs.push('Un dossier existe déjà : utilisez-le ou cochez « homonyme ».');
    }
    if (!deg.value) errs.push('Le degré est obligatoire.');
    if (!classe.value.trim()) errs.push('La classe d\'origine est obligatoire.');
    if (!tit.value.trim()) errs.push('Le ou la titulaire est obligatoire.');
    const vid = Number(vSel.value);
    if (eleveId) {
      const clash = S.store.all('RS_Inscriptions').find(i => i.EleveID === eleveId && i.VoleeID === vid && i.ID !== editing?.ID);
      if (clash) errs.push('Cet élève est déjà inscrit à cette volée.');
    }
    if (errs.length) { errBox.replaceChildren(notice(errs.join(' '), 'danger')); errBox.scrollIntoView({ block: 'center' }); return; }

    let e = eleveId ? eleve(eleveId) : null;
    if (!e) {
      const n = nom.value.trim(), p = prenom.value.trim();
      e = await S.store.add('RS_Eleves', { Title: `${n} ${p}`, Nom: n, Prenom: p, CleDoublon: cleDoublon(n, p), Statut: 'Actif' });
    } else if (e.Statut !== 'Actif' && statut.value === 'En cours') {
      await S.store.update('RS_Eleves', e.ID, { Statut: 'Actif' });
    }
    const v = volee(vid);
    const rec = {
      Title: `${e.Nom} ${e.Prenom} – ${v.Title}`, EleveID: e.ID, VoleeID: vid, CleUnique: `E${e.ID}-V${vid}`,
      Degre: deg.value, ClasseOrigine: classe.value.trim(), Titulaire: tit.value.trim(), StatutInscription: statut.value,
    };
    for (const p of profs) rec[`Prof${p.k}`] = p.el.value.trim();
    if (editing) await S.store.update('RS_Inscriptions', editing.ID, rec);
    else await S.store.add('RS_Inscriptions', rec);
    toast(editing ? 'Inscription modifiée' : 'Inscription enregistrée');
    nav('dossier', { eleve: e.ID });
  }

  return h('div', { class: 'page' },
    h('button', { type: 'button', class: 'back', onClick: () => back('eleves') }, '‹ Retour'),
    h('h1', null, editing ? 'Modifier l\'inscription' : e0 ? `Nouvelle inscription · ${nomEleve(e0)}` : 'Nouvel élève et inscription'),
    !e0 && card('Élève', { cls: 'narrow', hint: 'Seuls le nom et le prénom sont enregistrés. Aucune donnée médicale, familiale ni de contact (R13).' },
      h('div', { class: 'form' },
        h('div', { class: 'row' }, field('Nom', nom), field('Prénom', prenom)),
        dupBox)),
    card('Inscription', { cls: 'narrow', hint: 'Ce qui change d\'une année à l\'autre (degré, classe, enseignants) est rattaché à l\'inscription, pas au dossier.' },
      h('div', { class: 'form' },
        h('div', { class: 'row' }, field('Volée', vSel), field('Degré', deg)),
        h('div', { class: 'row' }, field('Classe d\'origine', classe), field('Titulaire', tit)),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Enseignant·es de la classe d\'origine (sigles, facultatif)'),
          h('div', { class: 'row' }, profs.map(p => field({ Francais: 'Français', Maths: 'Maths' }[p.k] || p.k, p.el)))),
        editing && field('Statut de l\'inscription', statut),
        errBox,
        h('div', { class: 'btn-row' }, btn('Enregistrer', save), btn('Annuler', () => back('eleves'), 'secondary')))));
}
