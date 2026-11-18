import {isGitHubLogin} from './owner-settings.js';

const DAY = 86_400_000;
const INDIA_OFFSET = 330 * 60_000;
const dateInIndia = time => new Date(time + INDIA_OFFSET).toISOString().slice(0, 10);

export function developerFromPath(path) {
  const match = /^\/api\/v1\/developers\/([^/]+)\/activity$/.exec(path);
  return match && isGitHubLogin(match[1]) ? match[1].toLowerCase() : null;
}

function windowAt(now) {
  const through = dateInIndia(now);
  const start = dateInIndia(now - 27 * DAY);
  return {start, through, checkedAt:new Date(now).toISOString(), days:{}};
}

// Aggregate before returning. A failed page can still establish activity on an observed day.
export async function collectActivity(kind, name, read, now = Date.now()) {
  const activity = windowAt(now);
  const since = new Date(activity.start + 'T00:00:00+05:30').toISOString();
  const developer = kind === 'developer';
  const endpoint = new URL(developer ? 'https://api.github.com/search/commits' : 'https://api.github.com/repos/' + name + '/commits');
  if (developer) {
    endpoint.searchParams.set('q', 'is:public author:' + name + ' committer-date:' + since + '..' + activity.checkedAt);
    endpoint.searchParams.set('sort', 'committer-date');
    endpoint.searchParams.set('order', 'desc');
  } else {
    endpoint.searchParams.set('since', since);
    endpoint.searchParams.set('until', activity.checkedAt);
  }
  endpoint.searchParams.set('per_page', '100');
  const seen = new Set(), hits = new Set();
  let complete = true, pagesRead = 0, rowsRead = 0, total;
  try {
    const signal = AbortSignal.timeout(developer ? 12_000 : 5_000);
    for (let page = 1; page <= (developer ? 6 : 3); page++) {
      endpoint.searchParams.set('page', String(page));
      const response = await read(endpoint.href, 'application/vnd.github+json', 'GET', signal);
      const body = await response.json();
      if (!developer && page === 1 && response.status === 409 && body?.message === 'Git Repository is empty.')
        return {...activity, status:'complete'};
      const rows = developer ? body?.items : body;
      if (!Array.isArray(rows)) break;
      if (developer) {
        if (!Number.isSafeInteger(body.total_count) || body.incomplete_results !== false ||
            (total !== undefined && total !== body.total_count)) complete = false;
        total = body.total_count;
      }
      pagesRead++;
      rowsRead += rows.length;
      for (const row of rows) {
        const time = Date.parse(row?.commit?.committer?.date);
        if (!/^[\da-f]{40,64}$/i.test(row?.sha || '') || !Number.isFinite(time) ||
            (developer && (row.repository?.private !== false || row.author?.login?.toLowerCase() !== name))) {
          complete = false;
          continue;
        }
        // Search may index the same commit in multiple repositories. A repeated
        // hit in the same repository can instead mean the pages moved mid-read.
        const hit = developer ? row.repository.full_name + '/' + row.sha : row.sha;
        if (hits.has(hit)) complete = false;
        hits.add(hit);
        if (seen.has(row.sha)) continue;
        seen.add(row.sha);
        const date = dateInIndia(time);
        if (date < activity.start || time > now) continue;
        activity.days[date] = (activity.days[date] || 0) + 1;
      }
      if (!response.headers.get('link')?.includes('rel="next"')) {
        if (developer && rowsRead !== total) complete = false;
        return {...activity, status:complete ? 'complete' : 'partial'};
      }
    }
  } catch {
    // Missing quota, a timeout or an upstream response is represented by coverage, never by a zero.
  }
  return {...activity, status:pagesRead ? 'partial' : 'unavailable'};
}

export function createActivityCache(capacity, maxPending, clock = Date.now) {
  const entries = new Map();
  let pending = 0;
  return async function get(kind, name, read) {
    const key = name.toLowerCase(), now = clock();
    const existing = entries.get(key);
    if (existing && (existing.loading || (existing.expires > now && existing.date === dateInIndia(now)))) return existing.value;
    if (pending >= maxPending) return {...windowAt(now), status:'unavailable'};
    if (!existing && entries.size >= capacity) {
      const idle = [...entries].find(([, entry]) => !entry.loading);
      if (!idle) return {...windowAt(now), status:'unavailable'};
      entries.delete(idle[0]);
    }
    const entry = {date:dateInIndia(now), loading:true};
    pending++;
    entry.value = collectActivity(kind, key, read, now).then(result => {
      entry.expires = now + (result.status === 'complete' ? 60 : 5) * 60_000;
      return result;
    }).finally(() => { entry.loading = false; pending--; });
    entries.set(key, entry);
    return entry.value;
  };
}

export const repositoryActivity = createActivityCache(96, 6);
const developerActivity = createActivityCache(48, 1);
let searchPausedUntil = 0;
async function readSearch(url, accept, method, signal) {
  if (Date.now() < searchPausedUntil) throw new Error('Search is cooling down');
  const response = await fetch(url, {method, signal, redirect:'error', headers:{
    Accept:accept, 'User-Agent':'Project-Atlas-Public-Dashboard', 'X-GitHub-Api-Version':'2026-03-10',
  }});
  const remaining = response.headers.get('x-ratelimit-remaining');
  if (remaining === '0' || response.status === 429 || response.status === 403) {
    const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
    searchPausedUntil = Math.max(Date.now() + 30_000, Math.min(reset, Date.now() + 600_000));
  }
  if (!response.ok) throw new Error('Commit search unavailable');
  return response;
}
export const publicDeveloperActivity = login => developerActivity('developer', login, readSearch);
