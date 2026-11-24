import {controls} from './generated/controls.js';

const icons = {
  rotate: '<path d="M20 10a8 8 0 1 0-2 8m2-14v6h-6"/><path d="m8 13 4-2 4 2-4 2z"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.3 7a7 7 0 0 1 11.9-1L20 9M4 15l1.8 3A7 7 0 0 0 17.7 17"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  sprint:
    '<path d="M3 18h5m-3-5H2m9-6h4a4 4 0 0 1 4 4v2a5 5 0 0 1-5 5h-2"/><path d="m11 4-3 4 3 4m5 4-3 3 3 3"/>',
  inbox: '<path d="M4 5h16l2 10v4H2v-4z"/><path d="M2 14h6l2 3h4l2-3h6"/>',
  road: '<circle cx="5" cy="17" r="2.5"/><circle cx="19" cy="6" r="2.5"/><path d="M8 17h7a3 3 0 0 0 0-6H9a2.5 2.5 0 0 1 0-5h7"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5m-18 4 9 5 9-5"/>',
  leaf: '<path d="M20 3c1 9-1 15-8 15-4 0-7-2-7-6 0-6 7-5 15-9Z"/><path d="M3 21c2-5 7-9 12-11"/>',
  wallet:
    '<path d="M4 7V5.5L16 3l1 4"/><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M21 11h-5a2.5 2.5 0 0 0 0 5h5"/><path d="M16.5 13.5h.1"/>',
  plane: '<path d="m3 10 18-7-5 18-4-7-9-4Z"/><path d="m12 14 5-7"/>',
  book: '<path d="M3 5c3-1 6-.5 9 2 3-2.5 6-3 9-2v14c-4-1-6-.5-9 2-3-2.5-5-3-9-2Z"/><path d="M12 7v14"/>',
  box: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 9 9-4m-9 4L3 8m9 4v10"/>',
  flag: '<path d="M5 21V4c5-3 9 3 15 0v10c-6 3-10-3-15 0"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5m0 7v7c0 4-16 4-16 0v-7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  external: '<path d="M9 5h10v10m0-10L5 19"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m10 6 6 6-6 6"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  issue:
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  filter: '<path d="M3 6h18M6 12h12m-9 6h6"/>',
  repo: '<path d="M5 3h13v17H6a2 2 0 0 1 0-4h12M5 4v14m4-11h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v.1"/>',
  link: '<path d="m8 15 8-8m-6 9-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 5-1m2 1 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-5 1"/>',
};
function icon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name] || icons.box}</svg>`;
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
let routePrefix = '#';
export function setRoutePrefix(prefix) { routePrefix = prefix || '#'; }
function url(page, product = 'all', extras = {}) {
  const q = new URLSearchParams();
  if (product !== 'all') q.set('product', product);
  for (const [k, v] of Object.entries(extras))
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  const qs = q.toString();
  return routePrefix + page + (qs ? '?' + qs : '');
}
export function selectPicker(id, label, options, selected, {leading, caption = false, kind = ''} = {}) {
  return `<label class="atlas-picker${kind ? ' picker-' + kind : ''}">${caption ? `<span class="picker-label">${e(label)}</span>` : ''}
    <span class="picker-control${leading ? ' has-icon' : ''}">
      ${leading ? `<span class="picker-leading">${icon(leading,15)}</span>` : ''}
      <select class="atlas-select" id="${e(id)}" aria-label="${e(label)}">${options.map(([value,text]) =>
        `<option value="${e(value)}"${value === selected ? ' selected' : ''}>${e(text)}</option>`).join('')}</select>
      <span class="picker-chevron">${icon('down',14)}</span>
    </span>
  </label>`;
}

function productMark(p, small = false) {
  return `<span class="product-mark tone-${p.color}${small ? ' small' : ''}" aria-hidden="true">${icon(p.icon, small ? 15 : 18)}</span>`;
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
