import { createProjectDirectory, directoryRefreshSeconds, owners } from './discovery.js';

const SITE = 'https://github.com';
const TIMEZONE = 'Asia/Kolkata';
const headers = {
  'User-Agent':
    'Project-Atlas-Public-Dashboard (the-harithsa-notes-pipeline.web.app)',
};
const hidden = new Set([401, 403, 404, 410, 451]);
const removedBoard = new Set([401, 404, 410, 451]);
class SourceError extends Error {
  constructor(code) {
    super('GitHub source unavailable');
    this.status = code;
  }
}
async function read(url, accept = 'text/html', method = 'GET') {
  const response = await fetch(url, {
    headers: {
      ...headers,
      Accept: accept,
      ...(accept === 'application/vnd.github+json' ? {'X-GitHub-Api-Version': '2026-03-10'} : {}),
    },
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(12000),
  });
  if (method === 'HEAD' && response.status >= 300 && response.status < 400)
    return response;
  if (!response.ok) throw new SourceError(response.status);
  return response;
}
function embedded(html, id) {
  // Read only named, public application/json script elements from the signed-out board page.
  const match = new RegExp(
    '<script\\b(?=[^>]*\\bid="' +
      id +
      '")(?=[^>]*\\btype="application/json")[^>]*>([\\s\\S]*?)</script>',
    'i',
  ).exec(html);
  if (!match) throw new Error('GitHub project format changed');
  return JSON.parse(match[1]);
}
function isoDay(start, days) {
  return new Date(Date.parse(start + 'T00:00:00Z') + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
function readFields(columns) {
  const byName = new Map(columns.map((c) => [c.name.toLowerCase(), c]));
  const sprint =
    byName.get('sprint') ||
    byName.get('iteration') ||
    columns.find((c) => c.settings?.configuration?.iterations);
  const config = sprint?.settings?.configuration;
  const periods = new Map();
  for (const s of [
    ...(config?.completedIterations || []),
    ...(config?.iterations || []),
  ]) {
    if (!s.id || !s.title || !Number.isInteger(s.duration) || s.duration <= 0)
      throw new Error('Invalid iteration');
    periods.set(s.id, {
      id: s.id,
      name: s.title,
      start: s.startDate,
      end: isoDay(s.startDate, s.duration - 1),
    });
  }
  return { byName, sprint, periods };
}
function repositorySlug(slug) {
  return typeof slug === 'string' &&
    /^[a-z\d][a-z\d-]{0,38}\/(?!\.{1,2}$)[a-z\d._-]{1,100}$/i.test(slug);
}
function itemIdentity(row) {
  if (
    !['Issue', 'PullRequest'].includes(row.contentType) ||
    row.isArchived ||
    row.archivedAt
  )
    return null;
  const values = new Map(
    (row.memexProjectColumnValues || []).map((c) => [
      c.memexProjectColumnId,
      c.value,
    ]),
  );
  const repo = values.get('Repository');
  if (repo?.isPublic !== true || !repositorySlug(repo.nameWithOwner))
    return null;
  const slug = repo.nameWithOwner;
  const title = values.get('Title');
  if (
    typeof title?.title?.raw !== 'string' || !title.title.raw ||
    !Number.isSafeInteger(title.number) ||
    title.number < 1
  )
    return null;
  const url =
    SITE +
    '/' +
    slug +
    '/' +
    (row.contentType === 'Issue' ? 'issues' : 'pull') +
    '/' +
    title.number;
  if (row.content?.url !== url) return null;
  return {values, slug, title, url};
}
function mapItem(row, {values, slug, title, url}, permitted, fields) {
  const option = (name) => {
    const col = fields.byName.get(name);
    const id = values.get(col?.id)?.id;
    return col?.settings?.options?.find((o) => o.id === id)?.name ?? null;
  };
  const milestone = values.get('Milestone');
  const hasMilestone =
    milestone?.repoNameWithOwner === slug &&
    Number.isSafeInteger(milestone.number);
  const parent = values.get('Parent issue');
  const parentRepo = parent && parent.owner + '/' + parent.repository;
  const sprintId = values.get(fields.sprint?.id)?.id;
  return {
    kind: row.contentType,
    title: title.title.raw,
    number: title.number,
    url,
    repo: slug,
    state: String(title.state || row.state).toUpperCase(),
    reason: title.stateReason?.toUpperCase() || null,
    status: option('status'),
    priority: option('priority'),
    size: option('size'),
    sprint: fields.periods.has(sprintId) ? sprintId : null,
    milestone: hasMilestone
      ? SITE + '/' + slug + '/milestone/' + milestone.number
      : null,
    milestoneTitle: hasMilestone ? milestone.title : null,
    milestoneState: hasMilestone ? milestone.state?.toUpperCase() : null,
    rollup:
      (values.get('Sub-issues progress')?.total || 0) > 0 ||
      values.get('Type')?.name === 'Epic',
    parent:
      permitted.has(parentRepo) && Number.isSafeInteger(parent.number) && parent.number > 0
        ? parentRepo + '#' + parent.number
        : null,
    archived: false,
  };
}
export function boardContents(rows, fields) {
  const verified = [];
  const repos = new Set();
  for (const row of rows) {
    const item = itemIdentity(row);
    if (!item) continue;
    repos.add(item.slug);
    verified.push([row, item]);
  }
  return {
    repos: [...repos].sort(),
    items: verified.map(([row, item]) => mapItem(row, item, repos, fields)),
  };
}
export async function publicPages(fetchPage) {
  const rows = [],
    ids = new Set(),
    cursors = new Set();
  let cursor = null;
  for (let page = 0; page < 100; page++) {
    const batch = await fetchPage(cursor);
    if (
      !Array.isArray(batch.nodes) ||
      typeof batch.pageInfo?.hasNextPage !== 'boolean'
    )
      throw new Error('Incomplete page');
    for (const row of batch.nodes) {
      if (!row.id || ids.has(row.id))
        throw new Error('Board changed during pagination');
      ids.add(row.id);
      rows.push(row);
    }
    if (!batch.pageInfo.hasNextPage) {
      if (
        batch.totalCount?.isApproximate !== false ||
        batch.totalCount.value !== rows.length
      )
        throw new Error('Incomplete board');
      return rows;
    }
    cursor = batch.pageInfo.endCursor;
    if (!cursor || cursors.has(cursor)) throw new Error('Incomplete cursor');
    cursors.add(cursor);
  }
  throw new Error('Board exceeds page limit');
}
export function flatBoardPage(path, cursor) {
  const endpoint = new URL(path, SITE);
  // GitHub’s table view can collapse children even when no filter is set.
  // Request the same flat presentation a signed-out visitor can select.
  endpoint.searchParams.set('layout', 'table');
  endpoint.searchParams.set('hierarchy', 'false');
  if (cursor) endpoint.searchParams.set('after', cursor);
  return endpoint;
}
async function publicHealth(html, id) {
  try {
    const path = embedded(html, 'memex-status-update-api-data').url;
    if (path !== '/memexes/' + id + '/statuses') return null;
    const { statuses } = await (
      await read(SITE + path, 'application/json')
    ).json();
    const latest = statuses
      .filter((s) => s.userHidden === false)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return latest
      ? {
          status: latest.statusValue?.status?.name ?? null,
          updatedAt: latest.updatedAt,
        }
      : null;
  } catch {
    // Health updates are optional on a board and can be absent on the public view.
    return null;
  }
}
async function collectBoard(board) {
  const html = await (await read(board.url + '?filterQuery=')).text();
  const meta = embedded(html, 'memex-data');
  if (
    meta.public !== true ||
    meta.closedAt ||
    meta.number !== board.number ||
    embedded(html, 'memex-owner').login !== board.account
  )
    throw new SourceError(404);
  const fields = readFields(embedded(html, 'memex-columns-data'));
  const path = embedded(html, 'memex-paginated-items-get-api-data').url;
  if (
    !Number.isSafeInteger(meta.id) ||
    path !== '/memexes/' + meta.id + '/paginated_items'
  )
    throw new Error('Unknown board feed');
  const [rows, statusUpdate] = await Promise.all([
    publicPages(async (cursor) =>
      (await read(flatBoardPage(path, cursor), 'application/json')).json(),
    ),
    publicHealth(html, meta.id),
  ]);
  return {
    key: board.account.toLowerCase() + '-' + board.number,
    name: meta.title,
    owner: board.account,
    url: board.url,
    public: true,
    updatedAt: meta.updatedAt,
    statusUpdate,
    sprintField: fields.sprint?.name ?? null,
    sprints: [...fields.periods.values()].sort((a, b) =>
      a.start.localeCompare(b.start),
    ),
    ...boardContents(rows, fields),
  };
}
async function milestonesFromApi(slug) {
  const list = [];
  for (let page = 1; page <= 100; page++) {
    const res = await read(
      'https://api.github.com/repos/' +
        slug +
        '/milestones?state=open&per_page=100&page=' +
        page,
      'application/vnd.github+json',
    );
    const ms = await res.json();
    if (!Array.isArray(ms)) throw new Error('Invalid milestone page');
    for (const m of ms)
      list.push({
        name: m.title,
        number: m.number,
        url: m.html_url,
        due: m.due_on?.slice(0, 10) || null,
        open: m.open_issues,
        closed: m.closed_issues,
      });
    if (!res.headers.get('link')?.includes('rel="next"')) return list;
  }
  throw new Error('Too many milestone pages');
}
async function milestones(slug) {
  try {
    const data = await (
      await read(
        SITE + '/' + slug + '/milestones?state=open',
        'application/json',
      )
    ).json();
    const repository = data?.payload?.milestonesRoute?.data?.repository;
    if (!repository || repository.nameWithOwner !== slug)
      throw new Error('Invalid milestone response');
    const { edges, totalCount } = repository.milestones;
    if (edges.length !== totalCount)
      throw new Error('Milestones require additional pages');
    return edges.map(({ node: m }) => {
      const number = Number(m.url.split('/').pop());
      if (
        m.state !== 'OPEN' ||
        !Number.isSafeInteger(number) ||
        m.url !== SITE + '/' + slug + '/milestone/' + number ||
        !Number.isInteger(m.openIssueCount) ||
        !Number.isInteger(m.closedIssueCount)
      )
        throw new Error('Invalid milestone');
      return {
        name: m.title,
        number,
        url: m.url,
        due: m.dueOn?.slice(0, 10) || null,
        open: m.openIssueCount,
        closed: m.closedIssueCount,
      };
    });
  } catch (error) {
    if (hidden.has(error.status)) throw error;
    return milestonesFromApi(slug);
  }
}
async function latestRelease(slug, previous) {
  const base = SITE + '/' + slug + '/releases';
  const response = await read(base + '/latest', 'text/html', 'HEAD');
  const location = response.headers.get('location');
  if (!location) throw new Error('Unknown release response');
  const url = new URL(location, SITE).href;
  if (url === base) return null;
  if (!url.startsWith(base + '/tag/'))
    throw new Error('Unexpected release location');
  if (previous?.url === url && previous.publishedAt) return previous;
  let publishedAt = null;
  try {
    const html = await (await read(url)).text();
    const date =
      /released this\s*<relative-time\b[^>]*\bdatetime="([^"]+)"/i.exec(
        html,
      )?.[1];
    if (date && Number.isFinite(Date.parse(date))) publishedAt = date;
  } catch {
    // The canonical Latest redirect still establishes the published tag.
  }
  return {
    tagName: decodeURIComponent(url.slice((base + '/tag/').length)),
    url,
    publishedAt,
  };
}
const repoCache = new Map();
const REPO_TTL = 3 * 60_000;
async function collectRepo(slug) {
  const cached = repoCache.get(slug);
  if (cached && Date.now() - Date.parse(cached.capturedAt) < REPO_TTL)
    return cached;
  const [targets, published] = await Promise.all([
    milestones(slug),
    latestRelease(slug, cached?.published),
  ]);
  const value = {
    name: slug,
    url: SITE + '/' + slug,
    milestones: targets,
    published,
    capturedAt: new Date().toISOString(),
  };
  repoCache.set(slug, value);
  return value;
}
async function boundedResults(values, load) {
  const results = [];
  const queue = values.entries();
  async function worker() {
    for (const [i, value] of queue) {
      try {
        results[i] = {status: 'fulfilled', value: await load(value)};
      } catch (reason) {
        results[i] = {status: 'rejected', reason};
      }
    }
  }
  await Promise.all(Array.from({length: Math.min(4, values.length)}, worker));
  return results;
}
const discover = createProjectDirectory((url) => read(url, 'application/vnd.github+json'));
export async function collectPortfolio() {
  const directories = await Promise.allSettled(owners.map(discover));
  const unavailable = [], boards = [], projects = [];
  for (const [i, result] of directories.entries()) {
    if (result.status === 'fulfilled') boards.push(...result.value);
    else unavailable.push({owner: owners[i].account, reason: 'Public project directory unavailable'});
  }
  if (directories.every((r) => r.status === 'rejected'))
    throw new Error('Public project directories temporarily unavailable');
  const boardsFound = await boundedResults(boards, collectBoard);
  for (const [i, result] of boardsFound.entries()) {
    if (result.status === 'fulfilled') projects.push(result.value);
    else if (!removedBoard.has(result.reason?.status))
      unavailable.push({
        owner: boards[i].account + ' · project ' + boards[i].number,
        reason: 'Public board unavailable',
      });
  }
  if (
    !projects.length &&
    boardsFound.some((r) => r.status === 'rejected' && !removedBoard.has(r.reason?.status))
  )
    throw new Error('Public boards temporarily unavailable');
  const names = [...new Set(projects.flatMap((p) => p.repos))];
  const fetched = await boundedResults(names, collectRepo);
  const repositories = {};
  for (const [i, result] of fetched.entries()) {
    const name = names[i];
    if (result.status === 'fulfilled') repositories[name] = result.value;
    else {
      repoCache.delete(name);
      unavailable.push({
        owner: name,
        reason: 'Repository release and milestone information unavailable',
      });
    }
  }
  const active = new Set(names);
  for (const slug of repoCache.keys()) if (!active.has(slug)) repoCache.delete(slug);
  const now = new Date();
  return {
    schemaVersion: 1,
    capturedAt: now.toISOString(),
    timezone: TIMEZONE,
    asOf: new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now),
    owner: owners[0].account,
    directoryOwners: owners.map((o) => o.account),
    projects,
    repositories,
    unavailable,
    directoryRefreshSeconds,
    boardRefreshSeconds: 60,
    repositoryRefreshSeconds: 180,
  };
}
