import {e, icon, url, tabs} from './ui.js';

const sections = [
  ['overview', 'Overview', 'grid'], ['sprints', 'Work', 'sprint'],
  ['roadmap', 'Releases', 'road'], ['activity', 'Activity', 'code'],
];
const workPages = [['sprints', 'Sprints'], ['backlog', 'Backlog'], ['history', 'Closed issues']];

export function primaryNavigation(route) {
  const active = workPages.some(([key]) => key === route?.page) ? 'sprints' : route?.page;
  const product = route?.product || 'all';
  return `<nav class="primary-nav" aria-label="Workspace">${sections.map(([key, label, glyph]) => {
    const current = key === active;
    const href = key === route?.page ? url(key, product, Object.fromEntries(route.q)) : url(key, product);
    return `<a href="${e(href)}"${current ? ' aria-current="location"' : ''}>${icon(glyph,17)}<span>${label}</span></a>`;
  }).join('')}</nav>`;
}

export function sectionNavigation(route) {
  if (workPages.some(([key]) => key === route.page)) {
    return tabs('Work views', workPages.map(([key, label]) => [key, label, url(key, route.product)]), route.page);
  }
  if (route.page === 'roadmap') {
    return tabs('Release views', [
      ['planned', 'Planned', url('roadmap', route.product)],
      ['published', 'Published', url('roadmap', route.product, {view:'published'})],
    ], route.q.get('view') === 'published' ? 'published' : 'planned');
  }
  return '';
}

export function changeProduct(route, product) {
  const filters = new URLSearchParams(route.q);
  for (const key of ['product', 'board', 'sprint', 'show', 'find', 'page']) filters.delete(key);
  return url(route.page, product, Object.fromEntries(filters));
}

// A sprint ID belongs to its board. The separate board key lets an all-product
// workspace inspect a sprint without silently narrowing its product selector.
export function sprintHref(product, board, sprint, filters = {}) {
  return url('sprints', product, {sprint, ...filters, board:product === 'all' ? board : null});
}
