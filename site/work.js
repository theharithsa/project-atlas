import {
  compare,
  fmt,
  span,
  phase,
  sprintStats,
  shortSprint,
  hasTarget,
  bucket,
  nativeBacklog,
  issueRows,
  targets,
} from './model.js';
import { icon, e, external, url, productMark, dot, githubStatus, empty, tabs, progress } from './ui.js';
import { calendar } from './overview.js';
let tableRows = [],
  term = '',
  page = 0;
const PAGE_SIZE = 12;
function setIssueTable(rows, title) {
  tableRows = [...rows].sort(
    (a, b) =>
      compare(a.p.label, b.p.label) ||
      compare(a.i.priority || 'zz', b.i.priority || 'zz') ||
      compare(a.i.repo, b.i.repo) ||
      a.i.number - b.i.number,
  );
  term = '';
  page = 0;
  return `<section class="panel issue-panel"><div class="panel-head list-head"><h2>${e(title)}</h2><label class="search-box">${icon('search', 16)}<input id="issue-search" type="search" placeholder="Find an issue…" aria-label="Search issues by title, number or repository" autocomplete="off"></label></div><div id="issue-results"></div></section>`;
}
function paintIssues() {
  const target = document.querySelector('#issue-results');
  if (!target) return;
  const needle = term.trim().toLowerCase();
  const matches = tableRows.filter(
    ({ p, i }) =>
      !needle ||
      [p.label, i.title, '#' + i.number, i.repo, i.status, i.priority, i.milestoneTitle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
  );
  const max = Math.max(0, Math.ceil(matches.length / PAGE_SIZE) - 1);
  page = Math.min(page, max);
  const visible = matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const rows = visible
    .map(({ p, i }) => {
      const s = p.sprints.find((s) => s.id === i.sprint);
      const reference = `${i.repo}#${i.number}`;
      const assignment = s
        ? `<a href="${e(url('sprints', p.key, { sprint: s.id }))}">${e(s.name)}</a>`
        : i.milestoneTitle && hasTarget(i)
          ? external(i.milestone, e(i.milestoneTitle))
          : '<span class="muted">Unscheduled</span>';
      return `<article class="work-row"><div class="work-main">${productMark(p, true)}<div><strong>${external(i.url, e(i.title), 'issue-title', i.title + ' on GitHub')}</strong><small>${e(reference)}${i.state === 'CLOSED' ? ' · Closed' : ''}</small></div></div><div class="work-status">${githubStatus(i.status)}${i.priority ? `<span class="priority">${e(i.priority)}</span>` : ''}</div><div class="work-plan">${assignment}</div></article>`;
    })
    .join('');
  target.innerHTML = `${rows ? `<div class="work-head"><span>Issue</span><span>GitHub status</span><span>Sprint or milestone</span></div>${rows}` : empty(needle ? 'No matching issues' : 'No issues in this selection', needle ? 'Try another title, number or repository.' : 'No public issues match this filter.')}<div class="pagination"><span aria-live="polite">${matches.length ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, matches.length)} of ${matches.length}` : '0'} ${matches.length === 1 ? 'issue' : 'issues'}</span><div><button data-pager="-1" aria-label="Previous issue page" ${page === 0 ? 'disabled' : ''}>${icon('left', 15)}</button><button data-pager="1" aria-label="Next issue page" ${page >= max ? 'disabled' : ''}>${icon('right', 15)}</button></div></div>`;
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
  const picker = `<label class="select-wrap mini">${icon('filter', 15)}<select id="status-filter" aria-label="Filter by GitHub status"><option value="">All statuses</option>${statuses.map(([key, label]) => `<option value="${e(key)}"${key === active ? ' selected' : ''}>${e(label)}</option>`).join('')}</select>${icon('down', 13)}</label>`;
  return `<div class="backlog-controls">${tabs(
    'Backlog filters',
    buckets.map(([key, label]) => [
      key,
      `${label} · ${sets[key].length}`,
      url('backlog', r.product, { scope: key }),
    ]),
    scope,
  )}${picker}</div><p class="filter-note">${e(buckets.find((t) => t[0] === scope)[2])}</p>${setIssueTable(shown, buckets.find((t) => t[0] === scope)[1])}`;
}
function sprintPage(data, products, r) {
  const id = r.q.get('sprint');
  const detail =
    id && products.length === 1
      ? products.flatMap((p) => p.sprints.filter((s) => s.id === id).map((s) => ({ p, s })))[0]
      : null;
  if (detail) {
    const { p, s } = detail,
      stats = sprintStats(p, s);
    const which = ['open', 'closed', 'all'].includes(r.q.get('show')) ? r.q.get('show') : 'open';
    const scoped = stats.work.filter((i) => which === 'all' || i.state.toLowerCase() === which);
    return `<a class="back-link" href="${e(url('sprints', r.product, { period: phase(s, data.asOf) }))}">${icon('left', 14)} Sprint list</a><section class="panel sprint-detail tone-${p.color}"><div class="detail-name">${productMark(p)}<span>${e(p.label)}</span>${githubStatus(phase(s, data.asOf) === 'current' ? 'Current' : phase(s, data.asOf) === 'upcoming' ? 'Upcoming' : 'Past')}</div><h2>${e(s.name)}</h2><p>${e(span(s.start, s.end, true))}</p><div class="detail-progress">${progress(stats.closed, stats.total)}<span>${stats.closed} of ${stats.total} issues closed</span></div></section>
    ${tabs(
      'Sprint issue state',
      [
        ['open', `Open · ${stats.open}`],
        ['closed', `Closed · ${stats.closed}`],
        ['all', `All · ${stats.total}`],
      ].map(([k, l]) => [k, l, url('sprints', p.key, { sprint: id, show: k })]),
      which,
    )}${setIssueTable(
      scoped.map((i) => ({ p, i })),
      'Sprint issues',
    )}`;
  }
  const mode = ['current', 'upcoming', 'past'].includes(r.q.get('period'))
    ? r.q.get('period')
    : 'current';
  const rows = products
    .flatMap((p) => p.sprints.map((s) => ({ p, s, when: phase(s, data.asOf) })))
    .sort((a, b) => compare(a.s.start, b.s.start) || compare(a.p.label, b.p.label));
  const filtered = rows.filter((t) => t.when === mode);
  const groups = filtered
    .map(({ p, s }) => {
      const st = sprintStats(p, s);
      const next =
        mode === 'current'
          ? p.sprints.find((l) => phase(l, data.asOf) === 'upcoming' && sprintStats(p, l).open > 0)
          : null;
      return `<article class="sprint-card panel tone-${p.color}"><div class="detail-name">${productMark(p, true)}<strong>${e(p.label)}</strong></div><h2><a href="${e(url('sprints', p.key, { sprint: s.id }))}">${e(s.name)} ${icon('arrow', 17)}</a></h2><p class="sprint-dates">${icon('calendar', 15)} ${e(span(s.start, s.end, true))}</p>${progress(st.closed, st.total)}<div class="sprint-count"><span>${st.open} open</span><span>${st.closed}/${st.total} closed</span></div>${next ? `<a class="next-sprint" href="${e(url('sprints', p.key, { sprint: next.id }))}">Next with open work <strong>${e(shortSprint(next.name))} ${icon('right', 12)}</strong></a>` : ''}</article>`;
    })
    .join('');
  return `${tabs(
    'Sprint windows',
    [
      ['current', 'Current'],
      ['upcoming', 'Upcoming'],
      ['past', 'Past'],
    ].map(([k, l]) => [
      k,
      l + ' · ' + rows.filter((t) => t.when === k).length,
      url('sprints', r.product, { period: k }),
    ]),
    mode,
  )}${groups ? `<div class="sprint-grid">${groups}</div>` : empty('No ' + mode + ' sprint windows', 'GitHub has no configured windows in this period for the selected products.')}`;
}
function roadmapPage(data, products, r) {
  const which = ['releases', 'plans', 'all'].includes(r.q.get('kind')) ? r.q.get('kind') : 'releases';
  const when = ['upcoming', 'dated', 'undated', 'all'].includes(r.q.get('when'))
    ? r.q.get('when')
    : 'all';
  const all = targets(data, products);
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
        (when === 'upcoming' ? x.due && x.due >= data.asOf : when === 'dated' ? Boolean(x.due) : !x.due),
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
  return `${calendar(data, products, r)}<div class="roadmap-controls">${tabs(
    'Milestone kind',
    options.map(([k, l]) => [k, l, url('roadmap', r.product, { kind: k, when })]),
    which,
  )}
    <label class="select-wrap mini">${icon('filter', 15)}<select id="date-filter" aria-label="Filter milestone dates">${[
      ['all', 'Any date'],
      ['upcoming', 'Upcoming dates'],
      ['dated', 'Dated'],
      ['undated', 'Undated'],
    ]
      .map(([k, l]) => `<option value="${k}"${when === k ? ' selected' : ''}>${l}</option>`)
      .join('')}</select>${icon('down', 13)}</label></div>
    <p class="filter-note">${which === 'releases' ? 'Versioned GitHub milestones with a target date or outstanding work. Dates are release targets.' : which === 'plans' ? 'Delivery outcomes and queues from open repository milestones.' : 'All open GitHub milestones, including triage, maintenance and milestones with zero outstanding items.'} Progress counts issues and pull requests.</p>${list || empty('No matching milestones', 'Choose another date filter or view all open milestones.')}`;
}
export { backlogPage, sprintPage, roadmapPage, paintIssues, searchIssues, pageIssues };
