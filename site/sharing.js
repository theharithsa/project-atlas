import {ownerLists} from './portfolio.js';

const pages = new Set(['overview','sprints','backlog','history','roadmap','sources']);
const filters = ['product','sprint','show','period','scope','status','when','kind','offset','weeks','window','activity','developer'];
const invalidLink = {invalid:true, prefix:'invalid'};

function group(text) {
  if (text === '-') return '';
  if (!/^[a-z0-9_-]+(?:,[a-z0-9_-]+)*$/i.test(text)) throw new Error('Invalid owner list');
  return text;
}
function ownerPrefix(settings) {
  return '#p/1/' + (settings.users.join(',') || '-') + '/' + (settings.organizations.join(',') || '-') + '/';
}

export function decodeView(hash) {
  if (!hash.startsWith('#p/')) return null;
  if (hash.length > 4096) return invalidLink;
  const parts = /^#p\/1\/([^/]+)\/([^/]+)\/([a-z]+)(\?[^#]*)?$/.exec(hash);
  if (!parts || !pages.has(parts[3])) return invalidLink;
  try {
    const owners = ownerLists(group(parts[1]), group(parts[2]));
    return {prefix:ownerPrefix(owners), owners, route:'#' + parts[3] + (parts[4] || '')};
  } catch {
    return invalidLink;
  }
}

export function viewLink(address, settings, route, issueView) {
  const owners = ownerLists(settings.users.join(','), settings.organizations.join(','));
  const params = new URLSearchParams();
  for (const key of filters) {
    const value = key === 'product' ? (route.q.get('product') || route.product) : route.q.get(key);
    if (value && !(key === 'product' && value === 'all')) params.set(key,value);
  }
  if (issueView?.term) params.set('find',issueView.term);
  if (issueView?.page > 0) params.set('page', String(issueView.page + 1));
  const query = params.toString();
  const hash = ownerPrefix(owners) + route.page + (query ? '?' + query : '');
  if (!pages.has(route.page) || hash.length > 4096) throw new Error('Shorten the issue search to share this view.');
  const link = new URL(address);
  link.search = '';
  link.hash = hash;
  return link.href;
}

export function linkedIssueFilter(params) {
  const n = Number(params.get('page'));
  return {term:params.get('find') || '', page:Number.isSafeInteger(n) && n >= 1 ? n - 1 : 0};
}
