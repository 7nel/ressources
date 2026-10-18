import { S, nav, back, eleve, cours, volee, insc, refDate, moi, mesCours, coursActifs, nomEleve, labels, isCoord } from '../state.js';
import { h, card, btn, field, select, input, textarea, seg, levelPicker, levelLegend, phaseBadge, notice, toast, checkbox, redraw } from '../ui.js';
import { phaseOf, semaineCle, sortBy, fmtDate, daysBetween } from '../domain.js';

/** Inscription de l'élève dont la volée contient la date. */
export function inscriptionAt(eleveId, date) {
  return S.store.all('RS_Inscriptions').find(i => {
    if (i.EleveID !== eleveId) return false;
    const v = volee(i.VoleeID);
    return v && v.DateDebut <= date && date <= v.DateFin;
  }) || null;
}

export function render(params) {
  const editing = params.id ? S.store.get('RS_Suivis', params.id) : null;
  if (editing) {
    const allowed = isCoord() || (moi()?.ID === editing.EnseignantID && daysBetween(String(editing.Created).slice(0, 10), refDate()) <= 7);
    if (!allowed) return h('div', { class: 'page' }, notice('Ce suivi ne peut plus être modifié : l\'auteur dispose de 7 jours, ensuite seule la coordination peut corriger (R7).', 'warn'), btn('Retour', () => back('accueil'), 'secondary'));
  }
  const mine = mesCours();
  const f = editing ? { ...editing } : {
    EleveID: params.eleve ? Number(params.eleve) : null,
    CoursID: params.cours ? Number(params.cours) : (mine[0]?.ID || null),
    DateSuivi: refDate(), Portee: 'Séance', Comportement: null, Travail: null,
    Observation: '', CoachTravaille: '', CoachProgres: '',
  };
  const dv = { on: false, desc: '' };
  const root = h('div', { class: 'page' });

  function draw() {
    const L = labels();
    const i = f.EleveID ? inscriptionAt(f.EleveID, f.DateSuivi) : null;
    const v = i && volee(i.VoleeID);
    const phase = v ? phaseOf(f.DateSuivi, v) : null;
    const c = cours(f.CoursID);
    const coaching = !!c?.EstCoaching;

    // Élèves proposés : inscriptions dont la volée contient la date
    const candidats = sortBy(S.store.all('RS_Inscriptions').filter(x => {
      const vv = volee(x.VoleeID);
      return vv && vv.DateDebut <= f.DateSuivi && f.DateSuivi <= vv.DateFin && x.StatutInscription !== 'Interrompue';
    }).map(x => eleve(x.EleveID)).filter(Boolean), 'Nom', 'Prenom');
    if (f.EleveID && !candidats.find(e => e.ID === f.EleveID) && eleve(f.EleveID)) candidats.unshift(eleve(f.EleveID));

    const eleveSel = select([{ value: '', label: 'Choisir un élève…' }, ...candidats.map(e => ({ value: e.ID, label: nomEleve(e) }))], f.EleveID || '', {
      disabled: !!editing, onChange: ev => { f.EleveID = ev.target.value ? Number(ev.target.value) : null; draw(); },
    });
    const coursOpts = [...mine, ...coursActifs().filter(x => !mine.includes(x))];
    const coursSel = select([{ value: '', label: 'Choisir un cours…' }, ...coursOpts.map(x => ({ value: x.ID, label: x.Title + (mine.includes(x) ? ' (mon cours)' : '') }))], f.CoursID || '', {
      disabled: !!editing, onChange: ev => { f.CoursID = ev.target.value ? Number(ev.target.value) : null; draw(); },
    });
    const dateIn = input('date', f.DateSuivi, { onChange: ev => { if (ev.target.value) { f.DateSuivi = ev.target.value; draw(); } } });

    const doublon = !editing && f.EleveID && f.CoursID && S.store.all('RS_Suivis').find(s => s.EleveID === f.EleveID && s.CoursID === f.CoursID && s.DateSuivi === f.DateSuivi);
    const errBox = h('div');

    async function save() {
      const errs = [];
      if (!f.EleveID) errs.push('Choisissez un élève.');
      if (!f.CoursID) errs.push('Choisissez un cours.');
      if (f.EleveID && !i) errs.push('Cette date est hors de la volée de l\'élève.');
      if (!coaching && (!f.Comportement || !f.Travail)) errs.push('Les deux cotations (comportement et travail) sont obligatoires.');
      if (coaching && !f.CoachTravaille.trim() && !f.CoachProgres.trim()) errs.push('Indiquez ce qui a été travaillé ou un progrès / point de vigilance.');
      if (dv.on && !dv.desc.trim()) errs.push('Indiquez le devoir attendu.');
      if (errs.length) { errBox.replaceChildren(notice(errs.join(' '), 'danger')); return; }
      const m = moi();
      const e = eleve(f.EleveID);
      const rec = {
        Title: `${e.Prenom} ${e.Nom} · ${c.Title} · ${f.DateSuivi}`,
        EleveID: f.EleveID, InscriptionID: i.ID, CoursID: f.CoursID,
        EnseignantID: editing ? editing.EnseignantID : (m?.ID ?? c.EnseignantID),
        DateSuivi: f.DateSuivi, SemaineCle: semaineCle(f.DateSuivi), Portee: f.Portee, Phase: phase,
        Comportement: coaching ? null : f.Comportement, Travail: coaching ? null : f.Travail,
        Observation: coaching ? '' : f.Observation.trim(),
        CoachTravaille: coaching ? f.CoachTravaille.trim() : '', CoachProgres: coaching ? f.CoachProgres.trim() : '',
      };
      if (editing) await S.store.update('RS_Suivis', editing.ID, rec);
      else await S.store.add('RS_Suivis', rec);
      if (dv.on) {
        await S.store.add('RS_Devoirs', {
          Title: `${e.Prenom} ${e.Nom} · ${c.Title} · ${f.DateSuivi}`, EleveID: f.EleveID, InscriptionID: i.ID, CoursID: f.CoursID,
          EnseignantID: rec.EnseignantID, DateConstat: f.DateSuivi, SemaineCle: rec.SemaineCle, Phase: phase,
          SansConsequence: phase === 'Décompression', Description: dv.desc.trim(), Statut: 'Ouvert', DateResolution: null,
        });
      }
      toast(editing ? 'Suivi modifié' : 'Suivi enregistré');
      nav('dossier', { eleve: f.EleveID });
    }

    redraw(root,
      h('button', { type: 'button', class: 'back', onClick: () => back('accueil') }, '‹ Retour'),
      h('div', { class: 'page-head' },
        h('div', null, h('h1', null, editing ? 'Modifier un suivi' : 'Nouveau suivi'),
          h('div', { class: 'sub' }, 'Saisie individuelle. Pour toute une classe : ', h('a', { href: '#/groupe' }, 'saisie de groupe'), '.'))),
      card(null, { cls: 'narrow' }, h('div', { class: 'form' },
        h('div', { class: 'row' }, field('Élève', eleveSel), field('Cours', coursSel)),
        h('div', { class: 'row' },
          field('Date', dateIn, { help: phase ? null : undefined }),
          field('Portée', seg(['Séance', 'Semaine'], f.Portee, val => { f.Portee = val; draw(); }, 'Portée'), { help: 'Par séance ou pour la semaine, au choix (R3).' })),
        h('div', { class: 'btn-row' }, h('span', { class: 'muted small' }, 'Phase :'), phaseBadge(phase),
          v && h('span', { class: 'muted small' }, `${v.Title}`),
          f.EleveID && !i && h('span', { class: 'danger-text small' }, 'Date hors de la volée de cet élève.')),
        doublon && notice(`Un suivi existe déjà pour ce cours à cette date (${fmtDate(f.DateSuivi)}). Vous pouvez en ajouter un second ou modifier le premier depuis le dossier.`, 'warn'),
        coaching ? notice('Coaching : pas de cotation C/T ni de note, seulement le suivi écrit.', 'info') : [
          levelLegend(L),
          h('div', { class: 'row' },
            field('Comportement (C)', levelPicker(f.Comportement, val => { f.Comportement = val; }, { labels: L, name: 'Comportement' })),
            field('Travail (T)', levelPicker(f.Travail, val => { f.Travail = val; }, { labels: L, name: 'Travail' })))],
        coaching
          ? [field('Ce qui a été travaillé / notion ciblée', textarea(f.CoachTravaille, { onInput: ev => { f.CoachTravaille = ev.target.value; } })),
            field('Progrès · point de vigilance', textarea(f.CoachProgres, { onInput: ev => { f.CoachProgres = ev.target.value; } }))]
          : field('Observation (facultatif)', textarea(f.Observation, { onInput: ev => { f.Observation = ev.target.value; } }), { help: 'Faits observables, brefs. Rien de médical, de diagnostic ni de situation familiale.' }),
        !editing && h('div', { class: 'field' },
          checkbox('Devoir non fait', dv.on, val => { dv.on = val; draw(); }),
          dv.on && field('Devoir attendu', input('text', dv.desc, { placeholder: 'ex. Exercices p. 34', onInput: ev => { dv.desc = ev.target.value; } }),
            { help: phase === 'Décompression' ? 'Décompression : enregistré sans conséquence (pas de retenue).' : 'Compte pour la retenue du vendredi.' })),
        errBox,
        h('div', { class: 'btn-row' }, btn('Enregistrer', save), btn('Annuler', () => back('accueil'), 'secondary')))));
  }
  draw();
  void insc;
  return root;
}
