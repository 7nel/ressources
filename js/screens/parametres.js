import { S, saveSettings, nav, refresh, isSandbox, refDate, enseignantsActifs, volees, ens, coursActifs, applyTheme, moi } from '../state.js';
import { h, card, btn, field, select, input, checkbox, seg, modal, toast, confirmDlg, notice, levelLegend } from '../ui.js';
import { fmtDate, todayISO, DEFAULT_LEVEL_LABELS } from '../domain.js';

function editVolee(v) {
  const f = ['Title', 'AnneeScolaire', 'DateDebut', 'DateDebutRemob', 'DateDebutReexpo', 'DateFin'];
  const els = Object.fromEntries(f.map(k => [k, input(k.startsWith('Date') ? 'date' : 'text', v?.[k] || '')]));
  modal(v ? `Volée ${v.Title}` : 'Nouvelle volée', h('div', { class: 'form' },
    h('div', { class: 'row' }, field('Nom', els.Title, { help: 'ex. 2026-27 V2' }), field('Année scolaire', els.AnneeScolaire)),
    h('div', { class: 'row' }, field('Début', els.DateDebut), field('Fin', els.DateFin)),
    h('div', { class: 'row' }, field('Début remobilisation', els.DateDebutRemob, { help: 'Peut tomber en milieu de semaine' }), field('Début ré-exposition', els.DateDebutReexpo)),
    notice('Changer ces dates modifie la phase calculée des nouvelles saisies. Les suivis déjà enregistrés gardent leur phase.', 'warn')), [
    { label: 'Annuler', variant: 'secondary' },
    {
      label: 'Enregistrer', onClick: async () => {
        const rec = Object.fromEntries(f.map(k => [k, els[k].value.trim()]));
        if (f.some(k => !rec[k])) { toast('Tous les champs sont obligatoires', 'err'); return false; }
        if (!(rec.DateDebut < rec.DateDebutRemob && rec.DateDebutRemob < rec.DateDebutReexpo && rec.DateDebutReexpo <= rec.DateFin)) { toast('Ordre attendu : début < remobilisation < ré-exposition ≤ fin', 'err'); return false; }
        if (v) await S.store.update('RS_Volees', v.ID, rec); else await S.store.add('RS_Volees', rec);
        toast('Volée enregistrée'); refresh();
      },
    },
  ]);
}

function editEns(e) {
  const t = input('text', e?.Title || ''), mail = input('email', e?.Email || '');
  const role = select(['Enseignant', 'Coordination'], e?.Role || 'Enseignant');
  let actif = e ? e.Actif !== false : true;
  modal(e ? 'Modifier l\'enseignant·e' : 'Nouvel·le enseignant·e', h('div', { class: 'form' },
    field('Nom affiché', t, { help: 'Prénom Nom' }),
    field('E-mail professionnel', mail, { help: 'En mode SharePoint, c\'est l\'adresse de connexion qui identifie la personne.' }),
    h('div', { class: 'row' }, field('Rôle', role), h('div', { class: 'field' }, h('span', { class: 'label' }, 'Statut'), checkbox('Actif', actif, v => { actif = v; })))), [
    { label: 'Annuler', variant: 'secondary' },
    {
      label: 'Enregistrer', onClick: async () => {
        if (!t.value.trim()) { toast('Nom obligatoire', 'err'); return false; }
        const em = mail.value.trim().toLowerCase();
        if (em && S.store.all('RS_Enseignants').some(x => x.Email?.toLowerCase() === em && x.ID !== e?.ID)) { toast('Cet e-mail est déjà utilisé', 'err'); return false; }
        const rec = { Title: t.value.trim(), Email: em, Role: role.value, Actif: actif };
        if (e) await S.store.update('RS_Enseignants', e.ID, rec); else await S.store.add('RS_Enseignants', rec);
        toast('Enregistré'); refresh();
      },
    },
  ]);
}

function editCours(c) {
  const t = input('text', c?.Title || '');
  const ensSel = select(enseignantsActifs().map(e => ({ value: e.ID, label: e.Title })), c?.EnseignantID);
  const col = input('color', c?.Couleur || '#2F6F63', { style: 'max-width:90px;padding:2px' });
  let coaching = !!c?.EstCoaching;
  modal(c ? 'Modifier le cours' : 'Nouveau cours', h('div', { class: 'form' },
    field('Nom du cours', t),
    h('div', { class: 'row' }, field('Enseignant·e', ensSel, { help: 'Remplit « Mes cours » sur l\'accueil.' }), field('Couleur', col)),
    checkbox('Cours de coaching (champs « travaillé » et « progrès »)', coaching, v => { coaching = v; })), [
    { label: 'Annuler', variant: 'secondary' },
    {
      label: 'Enregistrer', onClick: async () => {
        if (!t.value.trim()) { toast('Nom obligatoire', 'err'); return false; }
        const rec = { Title: t.value.trim(), EnseignantID: Number(ensSel.value), Couleur: col.value.toUpperCase(), EstCoaching: coaching };
        if (c) await S.store.update('RS_Cours', c.ID, rec); else await S.store.add('RS_Cours', rec);
        toast('Enregistré'); refresh();
      },
    },
  ]);
}

export function render() {
  const s = S.settings;
  const who = select([{ value: '', label: 'Choisir…' }, ...enseignantsActifs().map(e => ({ value: e.ID, label: e.Title }))], s.moiId || '', {
    disabled: !isSandbox(),
    onChange: ev => { s.moiId = Number(ev.target.value) || null; saveSettings(); toast(`Vous êtes maintenant : ${moi()?.Title || 'personne'}`); refresh(); },
  });
  const dateIn = input('date', s.dateSimulee || '', { onChange: ev => { s.dateSimulee = ev.target.value || null; saveSettings(); refresh(); } });
  const setDate = d => { s.dateSimulee = d; saveSettings(); refresh(); };
  const labelInputs = s.labels.map((l, k) => input('text', l, { onChange: ev => { s.labels[k] = ev.target.value.trim() || DEFAULT_LEVEL_LABELS[k]; saveSettings(); refresh(); } }));

  const fileIn = h('input', {
    type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'imp',
    onChange: async ev => {
      const file = ev.target.files[0];
      if (!file) return;
      if (!(await confirmDlg('Importer des données', `Remplacer les données de ce navigateur par celles de « ${file.name} » ?`, 'Importer'))) return;
      try { await S.store.importJSON(await file.text()); toast('Données importées'); nav('accueil'); }
      catch (err) { toast(`Import impossible : ${err.message}`, 'err'); }
    },
  });
  const exportData = () => {
    const blob = new Blob([S.store.exportJSON()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `ressources-test-${todayISO()}.json` });
    document.body.appendChild(a); a.click(); a.remove();
  };
  const reset = async () => {
    if (!(await confirmDlg('Réinitialiser', 'Effacer vos essais et revenir aux données fictives de départ ?', 'Réinitialiser'))) return;
    await S.store.reset(); toast('Données réinitialisées'); nav('accueil');
  };

  const V1 = volees().find(v => v.Title === '2026-27 V1');
  return h('div', { class: 'page' },
    h('h1', null, 'Réglages'),
    isSandbox() && card('Profil de test', { hint: 'Simule la connexion Microsoft. Essayez un profil « coordination » et un profil « enseignant » : l\'accueil change.' },
      field('Je teste en tant que', who)),
    isSandbox() && card('Date simulée', { hint: 'Les données fictives couvrent la volée V1 (31.08–16.10.2026). La date simulée permet de tester chaque phase pendant les vacances.' },
      h('div', { class: 'form' },
        field('Date', dateIn, { help: `Actuellement : ${fmtDate(refDate(), { day: true })}` }),
        V1 && h('div', { class: 'btn-row' },
          btn('Décompression (02.09)', () => setDate('2026-09-02'), 'secondary small'),
          btn('Remobilisation (23.09)', () => setDate('2026-09-23'), 'secondary small'),
          btn('Ré-exposition (07.10)', () => setDate('2026-10-07'), 'secondary small'),
          btn('Aujourd\'hui', () => setDate(todayISO()), 'ghost small')))),
    card('Libellés des 4 niveaux', { hint: 'Proposition en attendant les ancrages comportementaux rédigés en équipe. Ce réglage reste dans votre navigateur.' },
      h('div', { class: 'form' },
        h('div', { class: 'grid grid-4' }, labelInputs.map((el, k) => field(`Niveau ${k + 1}`, el))),
        levelLegend(s.labels))),
    card('Apparence', {}, seg([{ value: 'auto', label: 'Automatique' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }], s.theme || 'auto', v => { s.theme = v; saveSettings(); applyTheme(); refresh(); }, 'Thème')),
    card('Volées', { actions: [btn('+ Volée', () => editVolee(null), 'secondary small')], hint: 'Dates de phases de V2 à V5 : proposition à vérifier.' },
      h('div', { class: 'scroll-x' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, ['Volée', 'Début', 'Remob.', 'Ré-expo.', 'Fin', ''].map(x => h('th', null, x)))),
        h('tbody', null, volees().map(v => h('tr', null,
          h('td', null, v.Title), h('td', null, fmtDate(v.DateDebut)), h('td', null, fmtDate(v.DateDebutRemob)), h('td', null, fmtDate(v.DateDebutReexpo)), h('td', null, fmtDate(v.DateFin)),
          h('td', null, btn('Modifier', () => editVolee(v), 'ghost small')))))))),
    card('Enseignant·es', { actions: [btn('+ Enseignant·e', () => editEns(null), 'secondary small')] },
      h('div', { class: 'scroll-x' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, ['Nom', 'E-mail', 'Rôle', 'Actif', ''].map(x => h('th', null, x)))),
        h('tbody', null, S.store.all('RS_Enseignants').map(e => h('tr', null,
          h('td', null, e.Title), h('td', { class: 'small' }, e.Email), h('td', null, e.Role), h('td', null, e.Actif === false ? 'non' : 'oui'),
          h('td', null, btn('Modifier', () => editEns(e), 'ghost small')))))))),
    card('Cours', { actions: [btn('+ Cours', () => editCours(null), 'secondary small')] },
      h('div', { class: 'scroll-x' }, h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, ['Cours', 'Enseignant·e', 'Coaching', ''].map(x => h('th', null, x)))),
        h('tbody', null, coursActifs().map(c => h('tr', null,
          h('td', null, h('span', { class: 'dot', style: { background: c.Couleur, marginRight: '8px' } }), c.Title),
          h('td', null, ens(c.EnseignantID)?.Title || h('span', { class: 'danger-text' }, 'aucun')),
          h('td', null, c.EstCoaching ? 'oui' : ''),
          h('td', null, btn('Modifier', () => editCours(c), 'ghost small')))))))),
    isSandbox() && card('Données de ce navigateur', { hint: 'Vos essais restent dans ce navigateur, sur cet appareil. Pour montrer un état précis à une collègue : exportez, envoyez le fichier, elle l\'importe.' },
      h('div', { class: 'btn-row' },
        btn('Exporter (.json)', exportData, 'secondary'),
        fileIn, h('label', { for: 'imp', class: 'btn secondary', tabindex: '0', onKeydown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fileIn.click(); } } }, 'Importer…'),
        btn('Réinitialiser les données fictives', reset, 'danger secondary'))),
    card('À propos', { cls: 'flat' },
      h('p', { class: 'small muted' }, `Mode : ${isSandbox() ? 'bac à sable (données fictives dans le navigateur)' : 'SharePoint'}. Les filtres d'écran (« Ma vue ») relèvent de l'ergonomie, pas de la sécurité : en mode SharePoint, ce sont les permissions du site qui protègent les données.`)));
}
