import { prepare } from './model.js';
import { icon, e, external, url, productMark } from './ui.js';
import { overview } from './overview.js';
import { backlogPage, sprintPage, roadmapPage, paintIssues, searchIssues, pageIssues, saveIssueView, restoreIssueView } from './work.js';
const main = document.getElementById('content'),
  desktop = document.getElementById('desktop-nav'),
  menu = document.getElementById('mobile-menu'),
  topbar = document.getElementById('topbar');
const pageNames = {
  overview: 'Overview',
  sprints: 'Sprints',
  backlog: 'Backlog',
  roadmap: 'Roadmap',
  sources: 'Data sources',
};
const navIcons = {
  overview: 'grid',
  sprints: 'sprint',
  backlog: 'inbox',
  roadmap: 'road',
  sources: 'database',
};
let data, r, lastContent, busy = false, failed = false;
const pollMs = 60_000;
function checkedTime(value) {
  return new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', second:'2-digit'}).format(new Date(value)) + ' IST';
}
function updateSync() {
  const status = document.getElementById('sync-label');
  if (!status || !data) return;
  const delayed = failed || Date.now() - Date.parse(data.capturedAt) > pollMs * 3;
  const state = delayed ? 'Updates delayed' : data.unavailable.length ? 'Partial coverage' : 'GitHub live';
  status.textContent = state;
  status.parentElement.dataset.state = delayed || data.unavailable.length ? 'warning' : 'live';
  status.parentElement.title = state + ' · Boards checked ' + checkedTime(data.capturedAt) + ' · View data sources';
  document.getElementById('sync-time').textContent = '· ' + checkedTime(data.capturedAt);
  const refresh = document.getElementById('sync-refresh');
  refresh.disabled = busy;
  refresh.setAttribute('aria-busy', String(busy));
  const checked = document.querySelector('[data-source-time]');
  if (checked) checked.textContent = checkedTime(data.capturedAt);
}
function currentRoute() {
  const [raw = '', query = ''] = location.hash.slice(1).split('?');
  const page = Object.hasOwn(pageNames, raw) ? raw : 'overview';
  const q = new URLSearchParams(query);
  const product = data.projects.some((p) => p.key === q.get('product')) ? q.get('product') : 'all';
  return { page, product, q };
}
function setView(href) {
  if (location.hash !== href) location.hash = href;
  else render();
}
function brand() {
  return `<a class="brand" href="#overview" aria-label="Project Atlas overview"><img src="assets/atlas.svg" width="34" height="34" alt=""><span>Project Atlas</span></a>`;
}
function navigation(mobile = false) {
  const activeProduct = data.projects.find((p) => p.key === r.product);
  return `${mobile ? `<button class="menu-close" data-close-menu aria-label="Close navigation">${icon('close')}</button>` : ''}${brand()}
    <div class="rail-body"><p class="nav-heading">Workspace</p><nav class="nav-links" aria-label="Dashboard pages">${Object.entries(
      pageNames,
    )
      .filter(([k]) => k !== 'sources')
      .map(
        ([k, label]) =>
          `<a href="${e(url(k, r.product))}" class="${k === r.page ? 'active' : ''}"${k === r.page ? ' aria-current="page"' : ''}>${icon(navIcons[k])}<span>${label}</span></a>`,
      )
      .join('')}</nav>
    <div class="nav-heading product-heading">Products <span>${data.projects.length}</span></div><nav class="product-links" aria-label="Filter by product">${data.projects.map((p) => `<a href="${e(url('overview', p.key))}" class="${activeProduct === p ? 'selected-product' : ''}">${productMark(p, true)}<span>${e(p.label)}</span></a>`).join('')}</nav></div>
    <div class="rail-footer"><a class="data-link ${r.page === 'sources' ? 'active' : ''}" href="${e(url('sources'))}">${icon('database', 17)} Data sources</a><div class="owner"><span class="owner-avatar">VH</span><div><strong>${e(data.owner)}</strong><small>GitHub workspace</small></div>${external('https://github.com/' + data.owner, icon('external', 15), 'owner-link', 'Open GitHub profile')}</div></div>`;
}
function sourcePage(products) {
  const selectedCount = products.reduce((n, p) => n + p.items.length, 0),
    repoNames = [...new Set(products.flatMap((p) => p.repos))];
  const directory = Array.isArray(data.directoryOwners)
    ? `Atlas checks the public project directories for ${e(new Intl.ListFormat('en-GB').format(data.directoryOwners))} every ${e(data.directoryRefreshSeconds / 60)} minutes. `
    : '';
  return `<section class="panel source-intro"><div class="detail-name"><span class="product-mark tone-violet">${icon('database')}</span><strong>Public GitHub feed</strong></div><p>Boards checked <b data-source-time>${e(checkedTime(data.capturedAt))}</b> on ${e(data.asOf)}. This selection covers <b>${products.length} ${products.length === 1 ? 'board' : 'boards'}</b>, <b>${repoNames.length} ${repoNames.length === 1 ? 'repository' : 'repositories'}</b> and <b>${selectedCount.toLocaleString('en-GB')} public board ${selectedCount === 1 ? 'item' : 'items'}</b>.</p><p>${directory}Create an open public GitHub Project under a tracked owner to include it here. Add a public issue or pull request from each repository to track its releases. This tab checks boards every minute and release data refreshes on demand every three minutes. Each link opens the underlying GitHub source.</p>${data.unavailable.map((s) => `<p class="coverage-note">${icon('info', 15)}<span><b>${e(s.owner)}</b> · ${e(s.reason)}.</span></p>`).join('')}</section>
    <section class="panel source-list"><div class="panel-head"><h2>Board inventory</h2></div>${products
      .map((p) => {
        const issue = p.items.filter((i) => i.kind === 'Issue').length,
          pr = p.items.filter((i) => i.kind === 'PullRequest').length,
          other = p.items.length - issue - pr;
        const ep = p.items.filter((i) => i.kind === 'Issue' && i.rollup).length,
          arch = p.items.filter((i) => i.archived).length;
        return `<div class="source-row">${productMark(p)}<div><strong>${external(p.url, e(p.name) + ' ' + icon('external', 12))}</strong><small>${issue} issues · ${pr} pull requests${other ? ' · ' + other + ' other items' : ''} · ${ep} parent issues${p.statusUpdate?.status ? ' · Project health: ' + e(p.statusUpdate.status.replaceAll('_', ' ').toLowerCase()) : ''}${arch ? ' · ' + arch + ' archived' : ''}</small></div><b>${p.items.length}</b></div>`;
      })
      .join('')}</section>
    <section class="panel source-list"><div class="panel-head"><h2>Repository releases</h2></div>${repoNames
      .map((n) => {
        const x = data.repositories[n];
        if (!x) return `<div class="repo-row">${icon('repo', 16)}<span>${e(n)}</span><span>Temporarily unavailable</span></div>`;
        return `<div class="repo-row">${icon('repo', 16)}<span>${external(x.url, e(n))}</span><span>${x.published ? external(x.published.url, e(x.published.tagName) + ' ' + icon('external', 12)) : 'No latest release reported'}</span></div>`;
      })
      .join('')}</section><section class="panel definitions"><h2>How the numbers work</h2><dl>
    <dt>Current sprint</dt><dd>The latest board check date in India falls between the native iteration’s first and last day, inclusive. GitHub’s Sprint and Iteration fields are supported. An empty current sprint stays visible.</dd>
    <dt>Open work and sprint closure</dt><dd>Open work counts open, unarchived issues, excluding parent rollups and epics. Sprint closure counts closed issues out of this same issue scope, including issues closed early. Board inventory includes public issues and pull requests visible to signed-out visitors. Draft planning items, restricted content and archived board entries are excluded.</dd>
    <dt>Unscheduled backlog</dt><dd>Open work with a Backlog or Todo status, or missing status, and no sprint or delivery milestone. Triage and dependency maintenance are intake buckets. Milestone-only work and the native board backlog are available from Backlog.</dd>
    <dt>Planned releases</dt><dd>Versioned milestones supply dates and scope. Other named planning milestones and undated targets have their own filters. Publication evidence comes from GitHub Releases. A closed issue or full progress bar only establishes issue closure.</dd></dl></section>`;
}
function header(products) {
  const product = data.projects.find((p) => p.key === r.product);
  const title = {
    overview: product ? product.label : 'Delivery overview',
    sprints: 'Sprints',
    backlog: 'Backlog',
    roadmap: 'Release roadmap',
    sources: 'Data sources',
  }[r.page];
  const subtitle = {
    overview: product
      ? `${product.name} · ${product.repos.length} linked ${product.repos.length === 1 ? 'repository' : 'repositories'}`
      : `${data.projects.length} product boards across ${new Set(data.projects.flatMap((p) => p.repos)).size} GitHub repositories`,
    sprints: 'Work assigned to GitHub sprint and iteration windows.',
    backlog: 'Open work, planning commitments and native board status.',
    roadmap: 'Sprint windows and release targets from the linked repositories.',
    sources: 'Live coverage, refresh times and GitHub source links.',
  }[r.page];
  document.title = title + ' · Project Atlas';
  return `<header class="page-title"><div><h1>${e(title)}</h1><p>${e(subtitle)}</p></div><label class="select-wrap">${icon('layers', 16)}<select id="product-select" aria-label="Product filter"><option value="all">All products</option>${data.projects.map((p) => `<option value="${e(p.key)}"${p.key === r.product ? ' selected' : ''}>${e(p.label)}</option>`).join('')}</select>${icon('down', 14)}</label></header>`;
}
function render(updating = false) {
  const issueView = updating ? saveIssueView() : null;
  const focused = updating ? document.activeElement : null;
  const focusId = focused?.id;
  const selectedRange = focusId === 'issue-search' ? [focused.selectionStart, focused.selectionEnd] : null;
  const focusHref = focused?.tagName === 'A' ? focused.getAttribute('href') : null;
  r = currentRoute();
  if (menu.open && !updating) menu.close();
  const products =
    r.product === 'all' ? data.projects : data.projects.filter((p) => p.key === r.product);
  desktop.innerHTML = navigation();
  menu.innerHTML = navigation(true);
  topbar.innerHTML = `<div class="crumb"><button class="mobile-trigger" aria-label="Open navigation" aria-haspopup="dialog" data-menu>${icon('menu', 19)}</button><span class="workspace-name">${icon('layers', 16)} Workspace</span><span class="crumb-slash">/</span><strong>${pageNames[r.page]}</strong></div><div class="sync-tools"><a class="snapshot-link" href="#sources" aria-label="GitHub feed status and sources"><i></i><b id="sync-label" role="status"></b><span id="sync-time"></span></a><button class="sync-refresh" id="sync-refresh" aria-label="Refresh GitHub data" title="Refresh GitHub data">${icon('refresh',15)}</button></div>`;
  const content = {
    overview: () => overview(data, products, r),
    sprints: () => sprintPage(data, products, r),
    backlog: () => backlogPage(products, r),
    roadmap: () => roadmapPage(data, products, r),
    sources: () => sourcePage(products),
  }[r.page]();
  main.innerHTML = header(products) + content;
  if (issueView) restoreIssueView(issueView);
  paintIssues();
  updateSync();
  if (updating) {
    const target = focusId ? document.getElementById(focusId) : focusHref ? [...document.links].find(a => a.getAttribute('href') === focusHref && a.getClientRects().length) : null;
    if (target) {
      target.focus({preventScroll:true});
      if (selectedRange) target.setSelectionRange(...selectedRange);
    }
  }
}
document.addEventListener('click', (event) => {
  const btn = event.target.closest('button');
  if (btn?.id === 'sync-refresh' || btn?.id === 'retry-feed') refresh();
  if (btn?.hasAttribute('data-menu')) {
    menu.showModal();
    menu.querySelector('[data-close-menu]').focus();
  }
  if (btn?.hasAttribute('data-close-menu')) menu.close();
  if (event.target === menu) menu.close();
  if (event.target.closest('a') && menu.open) menu.close();
  if (btn?.dataset.pager) pageIssues(Number(btn.dataset.pager));
  if (event.target.closest('a.skip')) {
    event.preventDefault();
    main.focus();
  }
});
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'issue-search') searchIssues(ev.target.value);
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'product-select') {
    const keep = Object.fromEntries(r.q);
    delete keep.product;
    delete keep.sprint;
    setView(url(r.page, ev.target.value, keep));
  }
  if (ev.target.id === 'status-filter') {
    const keep = Object.fromEntries(r.q);
    delete keep.product;
    keep.status = ev.target.value;
    setView(url('backlog', r.product, keep));
  }
  if (ev.target.id === 'date-filter') {
    const keep = Object.fromEntries(r.q);
    delete keep.product;
    keep.when = ev.target.value;
    setView(url('roadmap', r.product, keep));
  }
});
window.matchMedia('(max-width:580px)').addEventListener('change', () => {
  if (data && ['overview', 'roadmap'].includes(r?.page)) render();
});
let previous = null;
window.addEventListener('hashchange', () => {
  if (!data) return;
  const next = currentRoute();
  const move =
    !previous ||
    previous.page !== next.page ||
    previous.product !== next.product ||
    previous.q.get('sprint') !== next.q.get('sprint');
  render();
  previous = r;
  if (move) {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
});
async function refresh() {
  if (busy) return;
  busy = true;
  updateSync();
  try {
    const res = await fetch('/api/v1/portfolio', {cache:'no-cache', signal:AbortSignal.timeout(55000)});
    if (!res.ok) throw Error('Feed unavailable');
    const payload = await res.json();
    const {capturedAt, ...rest} = payload;
    const signature = JSON.stringify({...rest, repositories:Object.fromEntries(Object.entries(rest.repositories).map(([name, {capturedAt:checked, ...repo}]) => [name, repo]))});
    const changed = signature !== lastContent, hadData = Boolean(data);
    data = prepare(payload);
    lastContent = signature;
    failed = false;
    if (changed || !hadData) {
      render(hadData);
      previous = r;
    }
  } catch {
    failed = true;
    if (!data || Date.now() - Date.parse(data.capturedAt) > 10 * pollMs) {
      data = null;
      desktop.replaceChildren();
      topbar.replaceChildren();
      menu.replaceChildren();
      if (menu.open) menu.close();
      main.innerHTML = '<section class="panel error-state"><h1>GitHub feed unavailable</h1><p>We’ll retry automatically. You can also check again now.</p><button id="retry-feed">Try again</button></section>';
    }
  } finally {
    busy = false;
    updateSync();
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
window.addEventListener('online', refresh);
setInterval(() => { if (!document.hidden) refresh(); }, pollMs);
refresh();
