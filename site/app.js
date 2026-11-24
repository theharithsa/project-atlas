import {controls} from './generated/controls.js';
import {playAtlasIntro, enterWorkspacePage} from './atlas-motion.js';
import {terrainPanel, mountTerrain} from './terrain.js';
import {developerRoute, activityHref, hydrateActivity, codingPanel, selectActivityDay, stepActivityDay} from './activity.js';
import {decodeView, viewLink, linkedIssueFilter, dashboardPage} from './sharing.js';
import {fetchSnapshot, maxPersonalOwners, ownerLists, personalPortfolio, preferencesKey, readPreferences, writePreferences} from './portfolio.js';
import { prepare, portfolioInventory, timeframeOptions, defaultTimeframe, deliveryTimeframe } from './model.js';
import { icon, e, external, url, productMark, selectPicker, setRoutePrefix } from './ui.js';
import { overview } from './overview.js';
import { backlogPage, sprintPage, roadmapPage, historyPage, paintIssues, searchIssues, pageIssues, saveIssueView, restoreIssueView } from './work.js';
const main = document.getElementById('content'),
  pendingFeed = main.firstElementChild,
  desktop = document.getElementById('desktop-nav'),
  menu = document.getElementById('mobile-menu'),
  topbar = document.getElementById('topbar');
const pageNames = {
  overview: 'Overview',
  sprints: 'Sprints',
  backlog: 'Backlog',
  roadmap: 'Roadmap',
  history: 'History',
  activity: 'Activity',
  sources: 'Data sources',
};
const navIcons = {
  overview: 'grid',
  sprints: 'sprint',
  backlog: 'inbox',
  roadmap: 'road',
  history: 'clock',
  activity: 'code',
  sources: 'database',
};
let data, r, lastContent, activeRequest, terrain, pointerDestination, failed = false, heroTyped = false;
let savedPreferences = readPreferences(), linked = decodeView(location.hash);
let preferences = linked?.owners ? {mode:'personal', ...linked.owners} : savedPreferences;
let draft, settingsNotice = '', inputError = '';
setRoutePrefix(linked?.owners && linked.prefix);
const noPersonalOwners = () => preferences.mode === 'personal' && !preferences.users.length && !preferences.organizations.length;
const pollMs = 60_000;
const editOwnersUrl = 'https://github.com/theharithsa/project-atlas/edit/main/config/owners.json';
function checkedTime(value) {
  return new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', second:'2-digit'}).format(new Date(value)) + ' IST';
}
function updateSync() {
  const status = document.getElementById('sync-label');
  if (!status || !data) return;
  const delayed = failed || Date.now() - Date.parse(data.capturedAt) > pollMs * 3;
  const state = noPersonalOwners() ? 'No owners selected' : delayed ? 'Updates delayed' : data.unavailable.length ? 'Partial coverage' : 'GitHub live';
  status.textContent = state;
  status.parentElement.dataset.state = delayed || data.unavailable.length ? 'warning' : 'live';
  status.parentElement.title = noPersonalOwners() ? 'Choose owners in Data sources' : state + ' · Boards checked ' + checkedTime(data.capturedAt) + ' · View data sources';
  document.getElementById('sync-time').textContent = noPersonalOwners() ? '' : '· ' + checkedTime(data.capturedAt);
  const refresh = document.getElementById('sync-refresh');
  refresh.disabled = Boolean(activeRequest);
  refresh.setAttribute('aria-busy', String(Boolean(activeRequest)));
  const checked = document.querySelector('[data-source-time]');
  if (checked) checked.textContent = checkedTime(data.capturedAt);
}
function currentRoute() {
  const [raw = '', query = ''] = (linked?.route || location.hash).slice(1).split(/\?(.*)/s);
  const q = new URLSearchParams(query);
  const page = dashboardPage(raw,q);
  const product = data.projects.some((p) => p.key === q.get('product')) ? q.get('product') : 'all';
  return { page, product, q };
}
function setView(href) {
  if (location.hash !== href) location.hash = href;
  else render();
}
function brand() {
  return `<a class="brand" href="${e(url('overview'))}" aria-label="Project Atlas overview"><img src="assets/atlas-mark.svg" width="34" height="34" alt=""><span>Project Atlas</span></a>`;
}
function navigation(mobile = false) {
  const activeProduct = data.projects.find((p) => p.key === r.product);
  const productPage = ['history','activity'].includes(r.page) ? r.page : 'overview';
  const productFilters = productPage === 'activity' ? Object.fromEntries(r.q) : {window:r.q.get('window')};
  delete productFilters.product;
  const ownerCount = data.directoryOwners?.length ?? (data.owner ? 1 : 0);
  return `${mobile ? `<button class="menu-close" data-close-menu aria-label="Close navigation">${icon('close')}</button>` : ''}${brand()}
    <div class="rail-body"><p class="nav-heading">Workspace</p><nav class="nav-links" aria-label="Dashboard pages">${Object.entries(
      pageNames,
    )
      .filter(([k]) => k !== 'sources')
      .map(
        ([k, label]) =>
          `<a href="${e(url(k,r.product,k === 'overview' ? {window:r.q.get('window')} : {}))}" class="${k === r.page ? 'active' : ''}"${k === r.page ? ' aria-current="page"' : ''}>${icon(navIcons[k])}<span>${label}</span></a>`,
      )
      .join('')}</nav>
    <div class="nav-heading product-heading">Products <span>${data.projects.length}</span></div><nav class="product-links" aria-label="Filter by product">${data.projects.map((p) => `<a href="${e(url(productPage,p.key,productFilters))}" class="${activeProduct === p ? 'selected-product' : ''}">${productMark(p, true)}<span>${e(p.label)}</span></a>`).join('')}</nav></div>
    <div class="rail-footer"><a class="data-link ${r.page === 'sources' ? 'active' : ''}" href="${e(url('sources'))}">${icon('database', 17)} Data sources</a><div class="owner"><span class="owner-avatar">${icon('layers', 17)}</span><div><strong>${linked ? 'Linked portfolio' : preferences.mode === 'personal' ? 'My portfolio' : 'Shared portfolio'}</strong><small>${ownerCount} tracked ${ownerCount === 1 ? 'owner' : 'owners'}</small></div></div></div>`;
}
function sharedOwnerPanel(settings) {
  if (!settings) return '';
  const groups = [
    ['Users', settings.users, 'users'],
    ['Organizations', settings.organizations, 'orgs'],
  ].map(([label, accounts, kind]) => {
    const links = accounts.map(login => external(
      'https://github.com/' + kind + '/' + login + '/projects', e(login), 'text-link',
    )).join(', ');
    return `<div><dt>${label}</dt><dd>${links || 'None'}</dd></div>`;
  }).join('');
  return `<section class="panel source-intro owner-settings"><div class="panel-head"><h2>Shared portfolio owners</h2>${external(editOwnersUrl, 'Edit owners on GitHub ' + icon('external', 13), 'text-link')}</div><dl>${groups}</dl><p>Maintainers update the shared list through a pull request. Atlas checks for merged changes every ${e(settings.refreshSeconds / 60)} minutes.</p></section>`;
}
function modeControl() {
  const options = [['shared','Shared portfolio'],['personal','My portfolio']];
  if (linked?.owners) options.push(['linked','Linked portfolio']);
  return selectPicker('portfolio-mode','Portfolio',options,linked?.owners ? 'linked' : preferences.mode,
    {leading:'layers',kind:'portfolio'});
}
function linkedOwnerPanel() {
  const names = [preferences.users.length && 'Users · ' + preferences.users.join(', '),
    preferences.organizations.length && 'Organizations · ' + preferences.organizations.join(', ')].filter(Boolean);
  return `<section class="panel source-intro"><h2>Owners in this link</h2><p>${e(names.join(' / ') || 'No owners selected')}</p></section>`;
}
function personalOwnerPanel() {
  const users = draft?.users ?? preferences.users.join(', ');
  const orgs = draft?.organizations ?? preferences.organizations.join(', ');
  return `<section class="panel source-intro personal-settings"><h2>My portfolio owners</h2><p id="owner-help">Enter up to ${maxPersonalOwners} public GitHub users and organizations, separated by commas. This browser remembers your list.</p>
    <form id="personal-owners" aria-describedby="owner-help">
      <label>GitHub users<input id="personal-users" type="text" maxlength="2000" value="${e(users)}" placeholder="octocat" spellcheck="false" autocapitalize="none" autocomplete="off"></label>
      <label>GitHub organizations<input id="personal-orgs" type="text" maxlength="2000" value="${e(orgs)}" placeholder="github" spellcheck="false" autocapitalize="none" autocomplete="off"></label>
      <p class="form-feedback" id="owner-error" role="alert">${e(inputError)}</p>
      <div class="owner-actions">${controls.saveOwners}<button type="button" id="clear-owners">Clear list</button></div>
      <p class="form-feedback" role="status" id="owner-notice">${e(settingsNotice)}</p>
    </form></section>`;
}
function coverageNotes(notes) {
  return notes.map(s => `<p class="coverage-note">${icon('info', 15)}<span><b>${e(s.owner)}</b> · ${e(s.reason)}.</span></p>`).join('');
}
function sourcePage(products) {
  const selectedCount = products.reduce((n, p) => n + p.items.length, 0);
  const {repositories:repoNames} = portfolioInventory(products);
  const personal = preferences.mode === 'personal';
  const statusPanel = `<section class="panel source-intro"><div class="detail-name"><span class="product-mark tone-violet">${icon('database')}</span><strong>Public GitHub feed</strong></div><p>Boards checked <b data-source-time>${e(checkedTime(data.capturedAt))}</b> on ${e(data.asOf)}. This selection covers <b>${products.length} ${products.length === 1 ? 'board' : 'boards'}</b>, <b>${repoNames.length} ${repoNames.length === 1 ? 'repository' : 'repositories'}</b> and <b>${selectedCount.toLocaleString('en-GB')} public board ${selectedCount === 1 ? 'item' : 'items'}</b>.</p><p>Atlas checks each tracked owner for new public projects every ${e((data.directoryRefreshSeconds || 600) / 60)} minutes. Add a public issue or pull request from each repository to track its releases. This tab checks boards every minute and release data refreshes on demand every three minutes. Each link opens the underlying GitHub source.</p>${coverageNotes(data.unavailable)}</section>`;
  return `${linked ? linkedOwnerPanel() : personal ? personalOwnerPanel() : sharedOwnerPanel(data.sourceSettings)}
    ${noPersonalOwners() ? '' : statusPanel}
    ${personal ? '' : personalOwnerPanel()}
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
    <dt>Issue history</dt><dd>History includes closed issues with or without a sprint, including parent issues. An issue on multiple selected boards appears once. The displayed date comes from GitHub.</dd>
    <dt>Coding streak</dt><dd>Projects counts commits on the public default branches represented by the selected boards. Developer searches GitHub for commits attributed to the chosen username across indexed public default branches. Commit streaks use the committed date in India time and include merges. Developer shows GitHub profile contributions for the selected dates and the account’s lifetime. In Activity, choose up to five years and open a month for its calendar. Hatched days have incomplete coverage. A ≥ value is a confirmed minimum.</dd>
    <dt>Unscheduled backlog</dt><dd>Open work with a Backlog or Todo status, or missing status, and no sprint or delivery milestone. Triage and dependency maintenance are intake buckets. Milestone-only work and the native board backlog are available from Backlog.</dd>
    <dt>Planned releases</dt><dd>Versioned milestones supply dates and scope. Other named planning milestones and undated targets have their own filters. Publication evidence comes from GitHub Releases. A closed issue or full progress bar only establishes issue closure.</dd></dl></section>`;
}
function header(products, timeframe) {
  const product = r.product === 'all' ? null : products[0];
  const inventory = portfolioInventory(products);
  const repositories = inventory.repositories.length;
  const repoLabel = `${repositories} GitHub ${repositories === 1 ? 'repository' : 'repositories'}`;
  const title = {
    overview: product ? product.label : 'Delivery overview',
    sprints: 'Sprints',
    backlog: 'Backlog',
    roadmap: 'Release roadmap',
    history: 'Issue history',
    activity: 'Activity',
    sources: 'Data sources',
  }[r.page];
  const subtitle = {
    overview: product
      ? `${repoLabel} linked to this board`
      : `${inventory.boards} product ${inventory.boards === 1 ? 'board' : 'boards'} across ${repoLabel}`,
    sprints: 'Work assigned to GitHub sprint and iteration windows.',
    backlog: 'Open work, planning commitments and native board status.',
    roadmap: 'Sprint windows and release targets from the linked repositories.',
    history: 'Closed issues on the selected boards, newest first. Dates are shown in India time.',
    activity: 'Explore public GitHub contributions and commit history.',
    sources: 'Live coverage, refresh times and GitHub source links.',
  }[r.page];
  document.title = title + ' · Project Atlas';
  const share = preferences.mode === 'personal' ? controls.share : '';
  const showProductFilter = r.page !== 'activity' || r.q.get('activity') !== 'developer';
  const productPicker = showProductFilter ? selectPicker('product-select','Product filter',
    [['all','All products'],...data.projects.map(p => [p.key,p.label])],r.product,{leading:'layers',kind:'product'}) : '';
  const periodPicker = timeframe ? selectPicker('overview-window','Timeframe',timeframeOptions,timeframe.key,
    {leading:'calendar',caption:true,kind:'timeframe'}) : '';
  const actions = share + productPicker + periodPicker;
  if (r.page !== 'overview' || product)
    return `<header class="page-title"><div><span class="terminal-line route-command" aria-hidden="true"><span class="prompt">$</span>atlas ${e(r.page)}</span><h1>${e(title)}</h1><p>${e(subtitle)}</p></div>${actions ? '<div class="view-actions">' + actions + '</div>' : ''}</header>`;

  const users = preferences.mode === 'personal' ? preferences.users : data.sourceSettings?.users || [];
  const filters = users.length ? {activity:'developer',metric:'contributions',range:'1y'} : {};
  const typingClass = heroTyped ? '' : ' type-on-entry';
  heroTyped = true;
  const cta = controls.activity.replace('#ATLAS_ACTIVITY_HREF',() => e(url('activity','all',filters)));
  return `<header class="atlas-hero${typingClass}"><div class="hero-copy">
    <span class="terminal-line hero-command${typingClass}" aria-hidden="true"><span class="prompt">$</span><span class="typed-command">atlas status --source github</span></span>
    <h1>Delivery <em>overview</em></h1><p>${e(subtitle)}</p>
    </div>${terrainPanel()}<div class="hero-actions"><div class="hero-filters">${productPicker}${periodPicker}</div><div class="hero-links">${share}${cta}</div></div></header>`;
}
function render(updating = false) {
  const issueView = updating ? saveIssueView() : null;
  const focused = updating || document.activeElement?.closest('#personal-owners,.coding-panel,.atlas-picker') ? document.activeElement : null;
  const focusId = focused?.id;
  const developerDraft = focusId === 'developer-login' ? focused.value : null;
  const selectedRange = ['issue-search','personal-users','personal-orgs','developer-login'].includes(focusId) ? [focused.selectionStart, focused.selectionEnd] : null;
  const focusDate = focused?.dataset.activityDay;
  const selectedDay = updating ? main.querySelector('[data-activity-day][aria-pressed="true"]')?.dataset.activityDay : null;
  const focusHref = focused?.tagName === 'A' ? focused.getAttribute('href') : null;
  r = currentRoute();
  if (menu.open && !updating) menu.close();
  const products =
    r.product === 'all' ? data.projects : data.projects.filter((p) => p.key === r.product);
  const timeframe = r.page === 'overview'
    ? deliveryTimeframe(data.asOf,r.q.get('window')) || deliveryTimeframe(data.asOf,defaultTimeframe)
    : null;
  desktop.innerHTML = navigation();
  menu.innerHTML = navigation(true);
  topbar.innerHTML = `<div class="crumb"><button class="mobile-trigger" aria-label="Open navigation" aria-haspopup="dialog" data-menu>${icon('menu', 19)}</button>${modeControl()}<span class="crumb-slash">/</span><strong>${pageNames[r.page]}</strong></div><div class="sync-tools"><a class="snapshot-link" href="${e(url('sources'))}" aria-label="GitHub feed status and sources"><i></i><b id="sync-label" role="status"></b><span id="sync-time"></span></a><button class="sync-refresh" id="sync-refresh" aria-label="Refresh GitHub data" title="Refresh GitHub data">${icon('refresh',15)}</button></div>`;
  const missingProduct = linked && r.q.has('product') && r.q.get('product') !== 'all' && r.product === 'all';
  const missingSprint = linked && r.page === 'sprints' && r.q.has('sprint') &&
    (r.product === 'all' || !products[0]?.sprints.some(s => s.id === r.q.get('sprint')));
  const content = missingProduct || missingSprint
    ? `<section class="panel source-intro"><h2>Linked ${missingProduct ? 'project' : 'sprint'} unavailable</h2><p>Check coverage in Data sources or open another project in this portfolio.</p></section>`
    : {
    overview: () => overview(data,products,r,timeframe),
    activity: () => codingPanel(data,products,r,preferences.mode === 'personal' ? preferences.users : (data.sourceSettings?.users || [])),
    sprints: () => sprintPage(data, products, r),
    backlog: () => backlogPage(products, r),
    roadmap: () => roadmapPage(data, products, r),
    history: () => historyPage(products, data.asOf, r),
    sources: () => sourcePage(products),
  }[r.page]();
  const banner = linked ? '<div class="linked-notice"><span>Viewing a linked portfolio</span><button type="button" data-leave-link>Return to my dashboard</button></div>' : '';
  main.innerHTML = banner + header(products,timeframe) + content;
  if (issueView || linked) restoreIssueView(issueView || linkedIssueFilter(r.q));
  paintIssues();
  hydrateActivity(data, r, selectedDay);
  terrain = mountTerrain(main.querySelector('.terrain'),products,timeframe?.key,terrain);
  updateSync();
  if (focused) {
    const target = focusId ? document.getElementById(focusId) : focusDate ? main.querySelector(`[data-activity-day="${focusDate}"]`) : focusHref ? [...document.links].find(a => a.getAttribute('href') === focusHref && a.getClientRects().length) : null;
    if (target) {
      if (developerDraft !== null) target.value = developerDraft;
      target.focus({preventScroll:true});
      if (selectedRange) target.setSelectionRange(...selectedRange);
    }
  }
}
document.addEventListener('atlas:appearance', () => terrain?.repaint());
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  pointerDestination = link && event.detail > 0 ? link.hash : null;
  const btn = event.target.closest('button');
  const dialog = document.getElementById('share-dialog');
  if (btn?.id === 'share-view') {
    const field = document.getElementById('share-address');
    const feedback = document.getElementById('share-result');
    try {
      field.value = viewLink(location.href, preferences, r, document.getElementById('issue-search') && saveIssueView());
      feedback.textContent = '';
    } catch (error) {
      field.value = ''; feedback.textContent = error.message;
    }
    document.getElementById('copy-view-link').disabled = !field.value;
    dialog.showModal(); field.focus(); field.select();
  }
  if (btn?.id === 'close-share') dialog.close();
  if (btn?.id === 'copy-view-link') {
    const field = document.getElementById('share-address');
    const feedback = document.getElementById('share-result');
    const manual = () => { field.focus(); field.select(); feedback.textContent = 'Select and copy the link above.'; };
    if (navigator.clipboard?.writeText)
      navigator.clipboard.writeText(field.value).then(() => { feedback.textContent = 'Link copied.'; }, manual);
    else manual();
  }
  if (btn?.hasAttribute('data-leave-link')) changePortfolio(savedPreferences, '', false);
  if (btn?.id === 'clear-owners') {
    draft = {users:'', organizations:''};
    changePortfolio({mode:'personal', users:[], organizations:[]}, 'Personal list cleared.');
  }
  if (btn?.id === 'sync-refresh' || btn?.id === 'retry-feed') refresh();
  if (btn?.hasAttribute('data-menu')) {
    menu.showModal();
    menu.querySelector('[data-close-menu]').focus();
  }
  if (btn?.hasAttribute('data-close-menu')) menu.close();
  if (event.target === menu) menu.close();
  if (event.target.closest('a') && menu.open) menu.close();
  if (btn?.dataset.pager) {
    pageIssues(Number(btn.dataset.pager));
    rememberLinkedSearch();
  }
  if (btn?.hasAttribute('data-activity-day')) selectActivityDay(btn);
  if (event.target.closest('a.skip')) {
    event.preventDefault();
    main.focus();
  }
});
document.addEventListener('keydown', event => {
  if (event.target.hasAttribute('data-activity-day')) stepActivityDay(event);
});
document.addEventListener('input', (ev) => {
  if (ev.target.closest('#personal-owners')) {
    draft = {users:document.getElementById('personal-users').value, organizations:document.getElementById('personal-orgs').value};
    inputError = ''; settingsNotice = '';
    document.getElementById('owner-error').textContent = '';
    document.getElementById('owner-notice').textContent = '';
  }
  if (ev.target.id === 'issue-search') { searchIssues(ev.target.value); rememberLinkedSearch(); }
});
document.addEventListener('submit', ev => {
  if (ev.target.id === 'developer-form') {
    ev.preventDefault();
    const next = developerRoute(r, document.getElementById('developer-login').value);
    if (next) setView(next);
    else document.getElementById('developer-error').textContent = 'Enter a valid GitHub username.';
    return;
  }
  if (ev.target.id !== 'personal-owners') return;
  ev.preventDefault();
  try {
    const owners = ownerLists(document.getElementById('personal-users').value, document.getElementById('personal-orgs').value);
    changePortfolio({mode:'personal', ...owners}, 'Personal portfolio saved.');
  } catch (error) {
    inputError = error.message;
    document.getElementById('owner-error').textContent = inputError;
  }
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'portfolio-mode') changePortfolio({...savedPreferences, mode:ev.target.value});
  if (ev.target.id === 'activity-range') setView(activityHref(r,{range:ev.target.value,month:null}));
  if (ev.target.id === 'activity-metric') setView(activityHref(r,{metric:ev.target.value}));
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
  if (ev.target.id === 'overview-window' || ev.target.id === 'history-window') {
    const filters = Object.fromEntries(r.q);
    delete filters.product;
    delete filters.find;
    delete filters.page;
    filters.window = ev.target.value === 'all' ? null : ev.target.value;
    setView(url(r.page,r.product,filters));
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
window.addEventListener('hashchange', () => {
  const nextLink = decodeView(location.hash);
  const changedScope = nextLink?.prefix !== linked?.prefix;
  linked = nextLink;
  if (changedScope) {
    setRoutePrefix(linked?.owners && linked.prefix);
    activatePortfolio(linked?.owners ? {mode:'personal', ...linked.owners} : savedPreferences);
    return;
  }
  if (!data) return;
  const previous = r;
  const next = currentRoute();
  const move =
    !previous ||
    previous.page !== next.page ||
    previous.product !== next.product ||
    previous.q.get('sprint') !== next.q.get('sprint');
  render();
  if (move) {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
    if (pointerDestination === location.hash) enterWorkspacePage(main);
  }
  pointerDestination = null;
});
function pendingPage(error) {
  terrain = null;
  if (menu.open) menu.close();
  desktop.innerHTML = brand();
  menu.replaceChildren();
  topbar.innerHTML = `<div class="crumb">${modeControl()}</div>`;
  const personal = preferences.mode === 'personal';
  if (linked?.invalid) {
    main.innerHTML = '<section class="panel error-state"><h1>Invalid portfolio link</h1><p>Ask the sender for a new link.</p><button type="button" data-leave-link>Return to my dashboard</button></section>';
    return;
  }
  document.title = (personal ? 'My portfolio' : 'Shared portfolio') + ' · Project Atlas';
  main.innerHTML = (error ? `<section class="panel error-state"><h1>GitHub feed unavailable</h1><p>We’ll retry automatically.</p>${coverageNotes(error.unavailable || [])}<button id="retry-feed">Try again</button></section>` : '') +
    (linked ? linkedOwnerPanel() + '<button type="button" data-leave-link>Return to my dashboard</button>' : personal || error ? personalOwnerPanel() : '') +
    (error && !personal ? `<p>${external(editOwnersUrl, 'Check shared owner settings on GitHub', 'text-link')}</p>` : '');
  if (!error) main.prepend(pendingFeed);
}
function rememberLinkedSearch() {
  if (!linked?.owners) return;
  try {
    const address = viewLink(location.href, preferences, r, saveIssueView());
    history.replaceState(null, '', address);
    linked = decodeView(location.hash);
    r = currentRoute();
  } catch {
    // Longer searches still work locally. The share dialog explains the URL limit.
  }
}
function changePortfolio(next, notice = '', persist = true) {
  if (linked) {
    linked = null;
    setRoutePrefix(null);
    history.pushState(null, '', '#overview');
  }
  savedPreferences = next;
  if (persist && !writePreferences(next)) notice = 'In use for this tab. Browser storage is unavailable.';
  activatePortfolio(next, notice);
}
function activatePortfolio(next, notice = '') {
  if (activeRequest) activeRequest.abort();
  activeRequest = null;
  data = null; r = null; lastContent = null; failed = false;
  preferences = next; draft = null; inputError = ''; settingsNotice = notice;
  if (!linked && noPersonalOwners()) location.hash = 'sources';
  pendingPage();
  refresh();
}
window.addEventListener('storage', event => {
  if (event.key !== preferencesKey && event.key !== null) return;
  const next = readPreferences();
  if (JSON.stringify(next) === JSON.stringify(savedPreferences)) return;
  savedPreferences = next;
  if (!linked) activatePortfolio(next);
});
async function refresh() {
  if (activeRequest || linked?.invalid) return;
  const request = new AbortController();
  activeRequest = request;
  updateSync();
  try {
    const payload = preferences.mode === 'personal'
      ? await personalPortfolio(preferences, request.signal)
      : await fetchSnapshot('/api/v1/portfolio', request.signal);
    if (activeRequest !== request) return;
    const {capturedAt, ...rest} = payload;
    const signature = JSON.stringify({...rest, repositories:Object.fromEntries(Object.entries(rest.repositories).map(([name, {capturedAt:checked, ...repo}]) => [name, repo]))});
    const changed = signature !== lastContent, hadData = Boolean(data);
    data = prepare(payload);
    lastContent = signature;
    failed = false;
    if (changed || !hadData) render(hadData);
    else hydrateActivity(data,r);
  } catch (error) {
    if (activeRequest !== request) return;
    failed = true;
    if (!data || Date.now() - Date.parse(data.capturedAt) > 10 * pollMs) {
      data = null;
      pendingPage(error);
    }
  } finally {
    if (activeRequest === request) {
      activeRequest = null;
      updateSync();
    }
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
window.addEventListener('online', refresh);
setInterval(() => { if (!document.hidden) refresh(); }, pollMs);
pendingPage();
playAtlasIntro();
refresh();
