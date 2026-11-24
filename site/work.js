import {
  compare,
  fmt,
  span,
  phase,
  sprintStats,
  hasTarget,
  bucket,
  nativeBacklog,
  issueRows,
  closedIssues,
  recentlyClosed,
  targets,
  deliveryTimeframe,
  timeframeOptions,
  sprintOverlaps,
  upcomingTarget,
  portfolioInventory,
} from './model.js';
import { icon, e, external, url, productMark, dot, githubStatus, empty, tabs, progress, selectPicker } from './ui.js';
import {sprintHref} from './workspace.js';
import { calendar } from './overview.js';
let tableRows = [],
  term = '',
  page = 0,
  showingHistory = false,
  compactIssues = false,
  tableProduct;
const PAGE_SIZE = 12;
function setIssueTable(rows, title, {product, history = false, compact = false}) {
  tableProduct = product;
  compactIssues = compact;
  showingHistory = history;
  tableRows = history ? rows : [...rows].sort(
    (a, b) =>
      compare(a.p.label, b.p.label) ||
      compare(a.i.priority || 'zz', b.i.priority || 'zz') ||
      compare(a.i.repo, b.i.repo) ||
      a.i.number - b.i.number,
  );
  term = '';
  page = 0;
  return `<section class="panel issue-panel"><div class="panel-head list-head">${compact ? '' : '<h2>' + e(title) + '</h2>'}<label class="search-box text-field">${icon('search', 18)}<input id="issue-search" type="search" placeholder="Find an issue…" aria-label="Search issues by title, number or repository" autocomplete="off"></label></div><div id="issue-results"></div></section>`;
}
const closureDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
});
function closureReason(reason) {
  return { COMPLETED: 'Completed', NOT_PLANNED: 'Not planned', DUPLICATE: 'Duplicate' }[reason] || 'Closed';
}
function historyRow({p, i, memberships}) {
  const date = i.closedAt
    ? `<time datetime="${e(i.closedAt)}">${e(closureDate.format(new Date(i.closedAt)))}</time>`
    : '<span class="muted">Date unavailable</span>';
  const plans = memberships.map(({p: product, i: item}) => {
    const sprint = product.sprints.find(s => s.id === item.sprint);
    const name = sprint ? product.label + ' · ' + sprint.name : product.label;
    const href = sprint ? sprintHref(tableProduct, product.key, sprint.id, {show:'closed'}) : url('overview', product.key);
    return `<a href="${e(href)}">${e(name)}</a>`;
  }).join('');
  return `<article class="work-row history-row"><div class="work-main">${productMark(p, true)}<div><strong>${external(i.url, e(i.title), 'issue-title', i.title + ' on GitHub')}</strong><small>${e(i.repo)}#${e(i.number)}</small></div></div><div class="history-closure">${date}<small>${e(closureReason(i.reason))}</small></div><div class="work-plan history-plans">${plans}</div></article>`;
}
function paintIssues() {
  const target = document.querySelector('#issue-results');
  if (!target) return;
  const needle = term.trim().toLowerCase();
  const matches = tableRows.filter(
    ({ p, i, memberships }) =>
      !needle ||
      [p.label, ...(memberships || []).map(m => m.p.label), showingHistory ? closureReason(i.reason) : '', i.title, '#' + i.number, i.repo, i.status, i.priority, i.milestoneTitle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
  );
  const max = Math.max(0, Math.ceil(matches.length / PAGE_SIZE) - 1);
  page = Math.min(page, max);
  const visible = matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const rows = visible
    .map((row) => {
      if (showingHistory) return historyRow(row);
      const {p, i} = row;
      const s = p.sprints.find((s) => s.id === i.sprint);
      const reference = `${i.repo}#${i.number}`;
      if (compactIssues) {
        return `<article class="inspector-issue"><span class="issue-glyph">${icon(i.state === 'CLOSED' ? 'check' : 'issue',15)}</span><div><strong>${external(i.url,e(i.title),'issue-title',i.title + ' on GitHub')}</strong><small>${e(reference)}</small></div>${githubStatus(i.status)}</article>`;
      }
      const assignment = s
        ? `<a href="${e(sprintHref(tableProduct,p.key,s.id))}">${e(s.name)}</a>`
        : i.milestoneTitle && hasTarget(i)
          ? external(i.milestone, e(i.milestoneTitle))
          : '<span class="muted">Unscheduled</span>';
      return `<article class="work-row"><div class="work-main">${productMark(p, true)}<div><strong>${external(i.url, e(i.title), 'issue-title', i.title + ' on GitHub')}</strong><small>${e(reference)}${i.state === 'CLOSED' ? ' · Closed' : ''}</small></div></div><div class="work-status">${githubStatus(i.status)}${i.priority ? `<span class="priority">${e(i.priority)}</span>` : ''}</div><div class="work-plan">${assignment}</div></article>`;
    })
    .join('');
  const headings = compactIssues ? '' : `<div class="work-head"><span>Issue</span><span>${showingHistory ? 'Closed on' : 'GitHub status'}</span><span>${showingHistory ? 'Product / sprint' : 'Sprint or milestone'}</span></div>`;
  const results = rows ? headings + rows : empty(needle ? 'No matching issues' : (showingHistory ? 'No closed issues in this selection' : 'No issues in this selection'), needle ? 'Try another title, number or repository.' : 'No public issues match this filter.');
  target.innerHTML = `${results}<div class="pagination"><span aria-live="polite">${matches.length ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, matches.length)} of ${matches.length}` : '0'} ${matches.length === 1 ? 'issue' : 'issues'}</span><div><button data-pager="-1" aria-label="Previous issue page" ${page === 0 ? 'disabled' : ''}>${icon('left', 15)}</button><button data-pager="1" aria-label="Next issue page" ${page >= max ? 'disabled' : ''}>${icon('right', 15)}</button></div></div>`;
}
export function saveIssueView() {
  return {term, page};
}
export function restoreIssueView(saved) {
  const input = document.getElementById('issue-search');
  if (!input) return;
  term = saved.term;
  page = saved.page;
  input.value = term;
}
function searchIssues(value) {
  term = value;
  page = 0;
  paintIssues();
}
function pageIssues(delta) {
  page = Math.max(0, page + delta);
  paintIssues();
}
const buckets = [
  [
    'backlog',
    'Unscheduled',
    'Open issues in Backlog or Todo with neither a sprint nor a delivery milestone. Triage and maintenance buckets are treated as intake.',
  ],
  [
    'milestone',
    'Milestone only',
    'Open issues with a named delivery or planning milestone and no sprint assignment.',
  ],
  [
    'native',
    'Board backlog',
    'Open issues whose native board status is Backlog or Todo. Some already have a sprint or milestone.',
  ],
  [
    'all',
    'All open work',
    'All open issues that represent work. Parent rollups and pull requests are counted in Data sources.',
  ],
];
function backlogPage(products, r) {
  const scope = buckets.some((t) => t[0] === r.q.get('scope')) ? r.q.get('scope') : 'backlog';
  const all = issueRows(products, () => true);
  const sets = {
    backlog: all.filter(({ i }) => bucket(i) === 'backlog'),
    milestone: all.filter(({ i }) => bucket(i) === 'milestone'),
    native: all.filter(({ i }) => nativeBacklog(i)),
    all,
  };
  const statuses = [
    ...new Map(
      sets[scope].map(({ i }) => [(i.status || 'No status').toLowerCase(), i.status || 'No status']),
    ).entries(),
  ].sort((a, b) => compare(a[1], b[1]));
  const requested = r.q.get('status');
  const active = statuses.some(([k]) => k === requested) ? requested : '';
  const shown = active
    ? sets[scope].filter(({ i }) => (i.status || 'No status').toLowerCase() === active)
    : sets[scope];
  const picker = selectPicker('status-filter','Filter by GitHub status',[['','All statuses'],...statuses],active,{leading:'filter'});
  return `<div class="backlog-controls">${tabs(
    'Backlog filters',
    buckets.map(([key, label]) => [
      key,
      `${label} · ${sets[key].length}`,
      url('backlog', r.product, { scope: key }),
    ]),
    scope,
  )}${picker}</div><p class="filter-note">${e(buckets.find((t) => t[0] === scope)[2])} <a class="text-link" href="${e(url('history', r.product))}">View closed issues</a></p>${setIssueTable(shown, buckets.find((t) => t[0] === scope)[1], {product:r.product})}`;
}
export function historyPage(products, asOf, route) {
  const all = closedIssues(products);
  const timeframe = deliveryTimeframe(asOf,route.q.get('window'));
  const rows = timeframe ? recentlyClosed(all,asOf,timeframe.days) : all;
  const options = [['all','All time'],...timeframeOptions.map(([key,label]) => [key,'Last ' + label])];
  const picker = selectPicker('history-window','History timeframe',options,timeframe?.key || 'all',{leading:'calendar'});
  const context = timeframe ? 'Closed ' + span(timeframe.from,timeframe.through,true) : 'All closed issues';
  const heading = `<div class="history-controls">${picker}<p class="filter-note">${e(context)} · ${rows.length} ${rows.length === 1 ? 'issue' : 'issues'}</p></div>`;
  const repositories = portfolioInventory(products).repositories.sort(compare);
  const links = repositories.map(repo => external(
    'https://github.com/' + repo + '/issues?q=is%3Aissue+is%3Aclosed', e(repo), 'text-link',
  )).join('');
  return heading + setIssueTable(rows, 'Closed issues', {product:route.product,history:true}) + (links
    ? `<section class="panel source-intro history-repos"><h2>Repository history</h2><p>GitHub also lists closed issues archived or removed from these boards.</p><div>${links}</div></section>`
    : '');
}
function sprintInspector(r, entry, period) {
  const {p, s, stats} = entry;
  const defaultState = stats.open || !stats.closed ? 'open' : 'closed';
  const which = ['open','closed','all'].includes(r.q.get('show')) ? r.q.get('show') : defaultState;
  const scoped = stats.work.filter(i => which === 'all' || i.state.toLowerCase() === which);
  const options = [['open','Open',stats.open],['closed','Closed',stats.closed],['all','All',stats.total]]
    .map(([key,label,count]) => [sprintHref(r.product,p.key,s.id,{...period,show:key}),label + ' · ' + count]);
  const state = selectPicker('sprint-show','Sprint issue state',options,
    sprintHref(r.product,p.key,s.id,{...period,show:which}),{});
  return `<section class="sprint-inspector" aria-labelledby="sprint-detail-title" data-board="${e(p.key)}" data-sprint="${e(s.id)}">
    <a class="list-return" href="${e(url('sprints',r.product,period))}">${icon('left',16)}Back to sprints</a>
    <div class="sprint-summary"><span class="board-name">${icon('sprint',15)}${e(p.label)}</span>
    <h2 id="sprint-detail-title" tabindex="-1">${e(s.name)}</h2><p>${e(span(s.start,s.end,true))}</p>
    <div class="sprint-completion"><span>${stats.closed} of ${stats.total} closed</span>${progress(stats.closed,stats.total)}</div></div>
    <div class="inspector-controls"><h3>Sprint issues</h3>${state}</div>
    ${setIssueTable(scoped.map(i => ({p,i})), 'Sprint issues', {product:r.product,compact:true})}</section>`;
}
function sprintPage(data, products, r) {
  const timeframe = deliveryTimeframe(data.asOf,r.q.get('window'));
  const id = r.q.get('sprint');
  const board = r.product === 'all' ? r.q.get('board') : r.product;
  const rows = products.flatMap(p => p.sprints.map(s => ({p,s,when:phase(s,data.asOf)})));
  const detail = id && rows.find(({p,s}) => p.key === board && s.id === id);
  const modes = [['current','Current'],['upcoming','Upcoming'],['past','Past']];
  if (timeframe) modes.push(['window','Last ' + timeframe.label]);
  const requested = r.q.get('period');
  const mode = modes.some(([key]) => key === requested) ? requested : detail?.when || 'current';
  const period = {period:mode,window:timeframe?.key};
  const matches = rows.filter(({s,when}) => mode === 'window' ? sprintOverlaps(s,timeframe) : when === mode)
    .map(row => ({...row,stats:sprintStats(row.p,row.s)}));
  matches.sort((a,b) => {
    if (mode === 'current') return Number(b.stats.open > 0) - Number(a.stats.open > 0) ||
      compare(a.s.end,b.s.end) || compare(a.p.label,b.p.label);
    return (mode === 'upcoming' ? 1 : -1) * compare(a.s.start,b.s.start) || compare(a.p.label,b.p.label);
  });
  const selected = detail ? matches.find(row => row.p === detail.p && row.s === detail.s) ||
    {...detail,stats:sprintStats(detail.p,detail.s)} : id ? null : matches[0];
  const picker = selectPicker('sprint-period','Sprint window',modes.map(([key,label]) =>
    [url('sprints',r.product,{...period,period:key}),label]),url('sprints',r.product,period),{caption:'Sprint window'});
  const title = {current:'Current sprints',upcoming:'Upcoming sprints',past:'Past sprints',window:'Sprints in range'}[mode];
  const list = matches.map(({p,s,stats}) => {
    const active = selected?.p === p && selected?.s === s;
    return `<a class="sprint-option" href="${e(sprintHref(r.product,p.key,s.id,period))}"${active ? ' aria-current="true"' : ''}>
      ${productMark(p,true)}<span class="sprint-option-name"><strong>${e(p.label)}</strong><small>${e(s.name)} · ${e(span(s.start,s.end))}</small></span>
      <span class="issue-tally">${stats.open}<span class="sr-only"> open issues</span></span>${icon('right',15)}</a>`;
  }).join('');
  const listReturn = `<a class="text-link" href="${e(url('sprints',r.product,period))}">Back to sprints</a>`;
  const unavailable = `<section class="missing-sprint"><h2>Sprint unavailable</h2><p>This board no longer reports that sprint.</p>${listReturn}</section>`;
  return `<section class="sprint-workspace${id ? ' has-detail' : ''}"><header class="sprint-heading"><h1>${e(title)}</h1>${picker}</header>
    ${mode === 'window' ? '<p class="filter-note">' + e(span(timeframe.from,timeframe.through,true)) + '</p>' : ''}
    <div class="sprint-panes"><section class="sprint-directory" aria-label="Sprint list"><div class="directory-key"><span>Product / sprint</span><span>Open issues</span></div>
    ${list || empty('No matching sprint windows','Choose another sprint window or product.')}</section>
    ${selected ? sprintInspector(r,selected,period) : id ? unavailable : ''}</div></section>`;
}
function publishedPage(data, products) {
  const repos = portfolioInventory(products).repositories;
  const releases = repos.map(key => ({key,release:data.repositories[key]?.published}))
    .filter(({release}) => release)
    .sort((a,b) => compare(b.release.publishedAt || '',a.release.publishedAt || '') || compare(a.key,b.key));
  const rows = releases.map(({key,release}) => {
    const date = Number.isFinite(Date.parse(release.publishedAt)) ? `<time datetime="${e(release.publishedAt)}">${e(closureDate.format(new Date(release.publishedAt)))}</time>` : '<span>Date unavailable</span>';
    return `<article class="published-row">${icon('flag',19)}<div><strong>${external(release.url,e(release.tagName) + ' ' + icon('external',13))}</strong><small>${e(key)}</small></div>${date}</article>`;
  }).join('');
  const unavailable = repos.filter(key => !data.repositories[key]).length;
  const noRelease = repos.length - unavailable - releases.length;
  const notes = [noRelease && (noRelease === 1 ? '1 repository has' : noRelease + ' repositories have') + ' no latest release reported.',
    unavailable && (unavailable === 1 ? '1 repository is' : unavailable + ' repositories are') + ' temporarily unavailable.'].filter(Boolean);
  return (rows ? `<section class="panel published-list" aria-label="Latest published releases">${rows}</section>` :
    empty('No published releases in this selection','GitHub release tags appear here when a linked repository publishes a release.')) +
    (notes.length ? `<p class="filter-note">${e(notes.join(' '))}</p>` : '');
}
function roadmapPage(data, products, r) {
  if (r.q.get('view') === 'published') return publishedPage(data,products);
  const which = ['releases', 'plans', 'all'].includes(r.q.get('kind')) ? r.q.get('kind') : 'releases';
  const when = ['upcoming', 'dated', 'undated', 'all'].includes(r.q.get('when'))
    ? r.q.get('when')
    : 'all';
  const timeframe = deliveryTimeframe(data.asOf,r.q.get('window'));
  const all = targets(data,products);
  // An undated version with no outstanding items may be historical. Keep it available in the full inventory.
  const m = all
    .filter(
      (x) =>
        which === 'all' ||
        (which === 'plans'
          ? !x.version && !x.housekeeping && (x.open || x.due)
          : x.version && (x.open || x.due)),
    )
    .filter(
      (x) =>
        when === 'all' ||
        (when === 'upcoming' ? upcomingTarget(x,data.asOf,timeframe) : when === 'dated' ? Boolean(x.due) : !x.due),
    );
  const options = [
    ['releases', 'Release targets'],
    ['plans', 'Planning milestones'],
    ['all', 'All open milestones'],
  ];
  const years = new Map();
  for (const t of m) {
    const key = t.due ? fmt(t.due, { year: 'numeric', month: 'long' }) : 'No target date';
    if (!years.has(key)) years.set(key, []);
    years.get(key).push(t);
  }
  const list = [...years]
    .map(
      ([label, entries]) =>
        `<section class="milestone-group"><h3>${e(label)}</h3><div class="panel">${entries
          .map((t) => {
            const p = t.products[0],
              sum = t.closed + t.open;
            return `<article class="milestone-row tone-${p.color}"><div class="due-badge">${t.due ? `<small>${e(fmt(t.due, { month: 'short' }))}</small><b>${e(fmt(t.due, { day: '2-digit' }))}</b>` : icon('calendar', 19)}</div><div class="milestone-name"><strong>${external(t.url, e(t.name) + ' ' + icon('external', 13))}</strong><small>${dot(p)}${e(p.label)} · ${e(t.repo)}</small></div><div class="milestone-progress"><span>${t.closed}/${sum} items closed</span>${progress(t.closed, sum)}</div><span class="target-kind">${t.due && t.due < data.asOf ? 'Past target' : t.version ? 'Version target' : t.housekeeping ? 'Tracking' : 'Planning'}</span></article>`;
          })
          .join('')}</div></section>`,
    )
    .join('');
  const dates = [
    ['all','Any date'], ['upcoming',timeframe ? 'Next ' + timeframe.label : 'Upcoming dates'],
    ['dated','Dated'], ['undated','Undated'],
  ];
  const picker = selectPicker('date-filter','Filter milestone dates',dates,when,{leading:'filter'});
  const fromTo = when === 'upcoming' && timeframe ? 'Targets ' + span(data.asOf,timeframe.releaseThrough,true) + '. ' : '';
  return `<div class="roadmap-controls">${tabs(
    'Milestone kind',
    options.map(([key,label]) => [key,label,url('roadmap',r.product,{kind:key,when,window:timeframe?.key})]),
    which,
  )}${picker}</div>
    <p class="filter-note">${e(fromTo)}${which === 'releases' ? 'Versioned GitHub milestones with a target date or outstanding work. Dates are release targets.' : which === 'plans' ? 'Delivery outcomes and queues from open repository milestones.' : 'All open GitHub milestones, including triage, maintenance and milestones with zero outstanding items.'} Progress counts issues and pull requests.</p>${list || empty('No matching milestones', 'Choose another date filter or view all open milestones.')}${calendar(data,products,r)}`;
}
export { backlogPage, sprintPage, roadmapPage, paintIssues, searchIssues, pageIssues };
