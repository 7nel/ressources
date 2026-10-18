// Petits outils d'affichage. Tout texte passe par textContent : pas d'injection possible.
import { PHASE_CLASS, DEF_C, DEF_T } from './domain.js';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  let deferredValue;
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') deferredValue = v;
      else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'multiple' || k === 'required') el[k] = !!v;
      else if (k === 'svg') el.innerHTML = v; // SVG construit par le code, textes échappés avec esc()
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  if (deferredValue !== undefined) el.value = deferredValue;
  return el;
}
function append(el, children) {
  for (const c of children) {
    if (c == null || c === false || c === '') continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}
/**
 * Reconstruit le contenu d'un écran en gardant le focus clavier sur le même contrôle
 * (même rang parmi les boutons, champs et liens), pour ne pas renvoyer en haut de page.
 */
export function redraw(container, ...nodes) {
  const SEL = 'a[href], button, input, select, textarea';
  const actif = document.activeElement;
  const rang = container.contains(actif) ? [...container.querySelectorAll(SEL)].indexOf(actif) : -1;
  container.replaceChildren(...nodes);
  if (rang >= 0) [...container.querySelectorAll(SEL)][rang]?.focus({ preventScroll: true });
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Éléments récurrents ---------- */
export function card(title, { actions, hint, cls, id } = {}, ...body) {
  return h('section', { class: 'card ' + (cls || ''), id },
    (title || actions) && h('div', { class: 'card-head' },
      title && (typeof title === 'string' ? h('h2', null, title) : title),
      actions && h('div', { class: 'btn-row' }, actions)),
    hint && h('p', { class: 'hint' }, hint),
    body);
}
export function btn(label, onClick, variant = '', attrs = {}) {
  return h('button', { type: 'button', class: `btn ${variant}`, onClick, ...attrs }, label);
}
export function pastille(level, { sm = false, title } = {}) {
  const lv = Number(level);
  if (!lv) return h('span', { class: `pastille empty ${sm ? 'sm' : ''}`, title: title || 'non coté' }, '–');
  return h('span', { class: `pastille l${lv} ${sm ? 'sm' : ''}`, title: title || `niveau ${lv}` }, lv);
}
export function ctPair(c, t, labels, sm = true) {
  const desc = `Comportement (${DEF_C}) : ${c} – ${labels[c - 1] || ''} · Travail (${DEF_T}) : ${t} – ${labels[t - 1] || ''}`;
  return h('span', { class: 'ct', title: desc, role: 'img', 'aria-label': desc },
    h('span', { class: 'k' }, 'C'), pastille(c, { sm }), h('span', { class: 'k' }, 'T'), pastille(t, { sm }));
}
export function phaseBadge(phase) {
  if (!phase) return h('span', { class: 'badge neutral' }, 'hors volée');
  return h('span', { class: `badge ${PHASE_CLASS[phase]}` }, phase);
}
export function badge(text, kind = 'neutral') { return h('span', { class: `badge ${kind}` }, text); }
export function empty(text) { return h('p', { class: 'empty' }, text); }
export function notice(text, kind = 'info') { return h('div', { class: `notice ${kind}`, role: kind === 'danger' ? 'alert' : null }, text); }

export function field(label, control, { help, err, id } = {}) {
  const cid = id || control.id || `f${Math.random().toString(36).slice(2, 8)}`;
  if (!control.id && ['INPUT', 'SELECT', 'TEXTAREA'].includes(control.tagName)) control.id = cid;
  const isNative = ['INPUT', 'SELECT', 'TEXTAREA'].includes(control.tagName);
  return h('div', { class: 'field' },
    isNative ? h('label', { for: control.id }, label) : h('span', { class: 'label' }, label),
    control,
    help && h('span', { class: 'help' }, help),
    err && h('span', { class: 'err' }, err));
}
export function select(options, value, attrs = {}) {
  // options : tableau de chaînes ou de { value, label }
  return h('select', { ...attrs, value: value ?? '' },
    options.map(o => typeof o === 'object'
      ? h('option', { value: o.value }, o.label)
      : h('option', { value: o }, o)));
}
export function input(type, value, attrs = {}) { return h('input', { type, value: value ?? '', ...attrs }); }
export function textarea(value, attrs = {}) { return h('textarea', { ...attrs, value: value ?? '' }); }
export function checkbox(label, checked, onChange, attrs = {}) {
  const box = h('input', { type: 'checkbox', checked, onChange: e => onChange?.(e.target.checked), ...attrs });
  return h('label', { class: 'check' }, box, label);
}
export function seg(options, value, onChange, label) {
  return h('div', { class: 'seg', role: 'group', 'aria-label': label },
    options.map(o => {
      const v = typeof o === 'object' ? o.value : o;
      const l = typeof o === 'object' ? o.label : o;
      return h('button', { type: 'button', 'aria-pressed': String(v === value), onClick: () => onChange(v) }, l);
    }));
}
/** Choix d'un niveau 1–4 (toucher à nouveau pour annuler). */
export function levelPicker(value, onChange, { labels, compact = false, name = '' } = {}) {
  const wrap = h('div', { class: `picker ${compact ? 'compact' : ''}`, role: 'group', 'aria-label': name });
  const render = v => {
    wrap.replaceChildren(...[1, 2, 3, 4].map(n => h('button', {
      type: 'button', class: `l${n}`, 'aria-pressed': String(v === n),
      title: labels ? `${n} · ${labels[n - 1]}` : String(n),
      'aria-label': `${name} ${n}${labels ? ' ' + labels[n - 1] : ''}`,
      onClick: () => { const nv = v === n ? null : n; render(nv); onChange(nv); },
    }, n)));
  };
  render(value ?? null);
  return wrap;
}
export function levelLegend(labels) {
  return h('div', { class: 'level-legend-wrap' },
    h('div', { class: 'ct-def' },
      h('span', null, h('strong', null, 'C'), ` = comportement : ${DEF_C}`),
      h('span', null, h('strong', null, 'T'), ` = travail : ${DEF_T}`)),
    h('div', { class: 'level-legend' }, [1, 2, 3, 4].map(n => h('span', null, pastille(n, { sm: true }), labels[n - 1]))));
}

/* ---------- Modale, confirmation, toast ---------- */
export function modal(title, body, actions = [], onClose) {
  const prev = document.activeElement;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); onClose?.(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const back = h('div', { class: 'modal-back', onClick: e => { if (e.target === back) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', null, h('h2', null, title), h('button', { type: 'button', class: 'x', 'aria-label': 'Fermer', onClick: close }, '×')),
      h('div', { class: 'body' }, body),
      actions.length ? h('footer', null, actions.map(a => btn(a.label, async () => { if ((await a.onClick?.()) !== false) close(); }, a.variant || ''))) : null));
  document.body.appendChild(back);
  document.addEventListener('keydown', onKey);
  setTimeout(() => back.querySelector('input, select, textarea, button:not(.x)')?.focus(), 0);
  return close;
}
export function confirmDlg(title, text, okLabel = 'Confirmer') {
  return new Promise(res => {
    modal(title, h('p', null, text), [
      { label: 'Annuler', variant: 'secondary', onClick: () => res(false) },
      { label: okLabel, onClick: () => res(true) },
    ], () => res(false)); // une promesse ne se résout qu'une fois : la fermeture après « OK » ne change rien
  });
}
/** `undo` : { label, onClick } ajoute un bouton dans le message, qui reste affiché plus longtemps. */
export function toast(msg, kind = 'ok', undo) {
  let box = document.querySelector('.toasts');
  if (!box) { box = h('div', { class: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(box); }
  const t = h('div', { class: `toast ${kind}` }, h('span', null, msg),
    undo && h('button', { type: 'button', class: 'toast-undo', onClick: async () => { t.remove(); await undo.onClick(); } }, undo.label));
  box.appendChild(t);
  setTimeout(() => t.remove(), undo ? 9000 : kind === 'err' ? 6000 : 3200);
}

/**
 * Menu d'actions secondaires : un bouton qui déplie une liste. Se ferme avec Échap,
 * un clic à côté ou le choix d'une entrée. items : { label, onClick, danger?, sep? }
 */
export function menu(label, items) {
  const list = h('div', { class: 'menu-list', role: 'menu', hidden: true });
  const trigger = h('button', { type: 'button', class: 'btn secondary', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, label, h('span', { 'aria-hidden': 'true', class: 'chevron' }));
  const wrap = h('div', { class: 'menu' }, trigger, list);
  const close = (focus = false) => {
    list.hidden = true; trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey);
    if (focus) trigger.focus();
  };
  const onDoc = e => { if (!wrap.contains(e.target)) close(); };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const els = [...list.querySelectorAll('button')], i = els.indexOf(document.activeElement);
    els[(i + (e.key === 'ArrowDown' ? 1 : els.length - 1)) % els.length]?.focus();
  };
  for (const it of items.filter(Boolean)) {
    if (it.sep) { list.appendChild(h('hr', { class: 'menu-sep', role: 'separator' })); continue; }
    list.appendChild(h('button', { type: 'button', role: 'menuitem', class: it.danger ? 'danger-text' : null, onClick: () => { close(); it.onClick(); } }, it.label));
  }
  trigger.addEventListener('click', () => {
    if (!list.hidden) return close();
    list.hidden = false; trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey);
    list.querySelector('button')?.focus();
  });
  return wrap;
}

/* ---------- Icônes (traits simples) ---------- */
const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>',
  check: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
  upload: '<path d="M12 15V4"/><path d="M7 9l5-5 5 5"/><path d="M4 15v4h16v-4"/>',
  download: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M4 15v4h16v-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
};
export function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || '';
  return s;
}
