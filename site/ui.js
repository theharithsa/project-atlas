import {controls} from './generated/controls.js';

function icon(name, size = 18) {
  return `<svg class="atlas-icon" width="${size}" height="${size}" aria-hidden="true" focusable="false"><use href="generated/icons.svg#${e(name)}"></use></svg>`;
}
function e(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
function safeGitHub(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'github.com' ? e(u.href) : '';
  } catch {
    return '';
  }
}
function external(url, label, cls = '', aria = '') {
  const href = safeGitHub(url);
  return href
    ? `<a class="${cls}" href="${href}" target="_blank" rel="noopener noreferrer"${aria ? ` aria-label="${e(aria)}"` : ''}>${label}</a>`
    : label;
}
let routePrefix = '#', routeWindow;
export function setRouteWindow(value) { routeWindow = value; }
export function setRoutePrefix(prefix) { routePrefix = prefix || '#'; }
function url(page, product = 'all', extras = {}) {
  const q = new URLSearchParams();
  if (product !== 'all') q.set('product', product);
  for (const [k, v] of Object.entries(extras))
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  if (routeWindow && !Object.hasOwn(extras, 'window')) q.set('window', routeWindow);
  const qs = q.toString();
  return routePrefix + page + (qs ? '?' + qs : '');
}
export function selectPicker(id, label, options, selected, {leading, caption = false, kind = ''} = {}) {
  return `<label class="atlas-picker${kind ? ' picker-' + kind : ''}">${caption ? `<span class="picker-label">${e(caption === true ? label : caption)}</span>` : ''}
    <span class="picker-control${leading ? ' has-icon' : ''}">
      ${leading ? `<span class="picker-leading">${icon(leading,18)}</span>` : ''}
      <select class="atlas-select" id="${e(id)}" aria-label="${e(label)}"><button type="button" class="picker-face"><selectedcontent></selectedcontent></button>${options.map(([value,text]) =>
        `<option value="${e(value)}"${value === selected ? ' selected' : ''}>${e(text)}</option>`).join('')}</select>
      <span class="picker-chevron">${icon('down',16)}</span>
    </span>
  </label>`;
}

function productMark(p, small = false) {
  const words = p.label.replace(/(\p{Ll})(\p{Lu})/gu,'$1 $2').match(/[\p{L}\p{N}]+/gu) || [];
  const initials = words.length > 1
    ? words.slice(0, 2).map(word => [...word][0]).join('')
    : [...(words[0] || '')].slice(0, 2).join('');
  return `<span class="product-mark tone-${p.color}${small ? ' small' : ''}" aria-hidden="true">${initials ? e(initials.toUpperCase()) : icon('box', small ? 16 : 19)}</span>`;
}
function dot(p) {
  return `<i class="product-dot tone-${p.color}" aria-hidden="true"></i>`;
}
function githubStatus(value) {
  const tone = /done|closed|production$/i.test(value || '')
    ? 'done'
    : /progress|pre-prod/i.test(value || '')
      ? 'pending'
      : /planned|ready|review/i.test(value || '')
        ? 'planned'
        : 'unassigned';
  return controls[tone].replaceAll('ATLAS_LABEL', () => e(value || 'No status'));
}
function empty(title, body = '') {
  return `<div class="empty"><span class="empty-icon">${icon('inbox', 21)}</span><strong>${e(title)}</strong>${body ? `<p>${e(body)}</p>` : ''}</div>`;
}
function tabs(label, options, active) {
  return `<nav class="tabs" aria-label="${e(label)}">${options.map(([key, title, href]) => `<a href="${e(href)}" ${key === active ? 'aria-current="page" class="selected"' : ''}>${e(title)}</a>`).join('')}</nav>`;
}
function progress(closed, total) {
  const n = total ? Math.round((100 * closed) / total) : 0;
  return `<span class="progress"><span style="width:${n}%"></span></span>`;
}
export { icon, e, safeGitHub, external, url, productMark, dot, githubStatus, empty, tabs, progress };
