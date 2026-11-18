import {isGitHubLogin} from './owner-settings.js';
import {readSearch} from './activity.js';
import {readPublicUser} from './github.js';
import {createLifetimeHistory} from './lifetime.js';

const DAY = 86_400_000;
const dateInIndia = time => new Date(time + 330 * 60_000).toISOString().slice(0,10);
const iso = time => new Date(time).toISOString();
const hash = /^[0-9a-f]{40,64}$/i;

export function historyRoute(path, now = Date.now()) {
  const dev = /^\/api\/v1\/developers\/([^/]+)\/(commits|contributions)\/(\d{4}|lifetime)$/.exec(path);
  const board = /^\/api\/v1\/owners\/(users|orgs)\/([^/]+)\/projects\/([1-9]\d{0,8})\/commits\/(\d{4})$/.exec(path);
  if (!dev && !board) return null;
  const login = (dev ? dev[1] : board[2]).toLowerCase();
  if (!isGitHubLogin(login)) return null;
  if (dev?.[3] === 'lifetime') return dev[2] === 'contributions' ? {kind:'lifetime',login} : null;
  const year = Number(dev ? dev[3] : board[4]);
  const current = Number(dateInIndia(now).slice(0,4));
  if (year > current || year < current - 5) return null;
  return dev ? {kind:dev[2], login, year} : {kind:'board', owner:{kind:board[1],account:login}, number:Number(board[3]), year};
}

function yearWindow(year, now) {
  const today = dateInIndia(now);
  const through = year === Number(today.slice(0,4)) ? today : year + '-12-31';
  return {start:year + '-01-01', through, checkedAt:iso(now)};
}
const firstInstant = date => Date.parse(date + 'T00:00:00+05:30');
function typedError(status) {
  const err = new Error('Public activity source unavailable');
  err.status = status;
  return err;
}
async function readPublic(url, accept, signal) {
  const res = await fetch(url, {signal, redirect:'error', headers:{
    Accept:accept, 'Accept-Language':'en-US,en;q=0.9', 'User-Agent':'Project-Atlas-Public-Dashboard',
  }});
  if (!res.ok) throw typedError(res.status);
  return res;
}

// GitHub places the date on the cell and the exact count on its associated, English tooltip.
export function profileDays(html, start, through) {
  const counts = new Map(), ids = new Set(), dates = new Set(), days = {};
  for (const [,attrs,text] of html.matchAll(/<tool-tip\b([^>]*)>\s*([^<]*)<\/tool-tip>/gi)) {
    const id = /\bfor="(contribution-day-component-[\w-]+)"/.exec(attrs)?.[1];
    const count = /^(No|\d{1,3}(?:,\d{3})+|\d+) contributions? on /i.exec(text.trim())?.[1];
    if (!id || !count) continue;
    if (counts.has(id)) throw new Error('Duplicate calendar tooltip');
    counts.set(id, count.toLowerCase() === 'no' ? 0 : Number(count.replaceAll(',','')));
  }
  for (const [tag] of html.matchAll(/<td\b[^>]*\bdata-date="\d{4}-\d\d-\d\d"[^>]*>/gi)) {
    const date = /\bdata-date="([^"]+)"/.exec(tag)[1];
    if (date < start || date > through) continue;
    const id = /\bid="([^"]+)"/.exec(tag)?.[1], count = counts.get(id);
    if (!Number.isSafeInteger(count) || count < 0 || dates.has(date) || ids.has(id)) throw new Error('Incomplete contribution calendar');
    dates.add(date); ids.add(id);
    if (count) days[date] = count;
  }
  for (let t = Date.parse(start); t <= Date.parse(through); t += DAY)
    if (!dates.has(iso(t).slice(0,10))) throw new Error('Missing calendar date');
  return days;
}

function begin(kind, name, year, now) {
  const window = yearWindow(year,now);
  const from = firstInstant(window.start);
  const until = Math.min(now,firstInstant(window.through) + DAY - 1);
  return {kind,name,year,window,days:{},seen:new Set(),hits:new Set(),pages:0,valid:true,
    cursor:null, revision:null, intervals:[{from,until,page:1,received:0}], finished:false, resume:0};
}
function add(job, sha, timestamp, slug) {
  const time = Date.parse(timestamp);
  if (!hash.test(sha) || !Number.isFinite(time)) throw new Error('Invalid commit entry');
  const hit = slug + '/' + sha;
  if (job.hits.has(hit)) job.valid = false;
  job.hits.add(hit);
  if (job.seen.has(sha)) return;
  job.seen.add(sha);
  const date = dateInIndia(time);
  if (date >= job.window.start && date <= job.window.through && time <= Date.parse(job.window.checkedAt))
    job.days[date] = (job.days[date] || 0) + 1;
}
async function repoPage(job, read, signal) {
  const interval = job.intervals[0];
  const endpoint = new URL('https://github.com/' + job.name + '/commits/' + (job.revision || 'HEAD'));
  endpoint.searchParams.set('since',iso(interval.from));
  endpoint.searchParams.set('until',iso(interval.until));
  if (job.cursor) endpoint.searchParams.set('after',job.cursor);
  const data = (await (await read(endpoint.href,'application/json',signal)).json())?.payload?.commitsRefRoute;
  const repo = data?.repo, pagination = data?.filters?.pagination;
  if (repo?.public !== true || repo.private !== false || (repo.ownerLogin + '/' + repo.name).toLowerCase() !== job.name.toLowerCase() ||
      !Array.isArray(data.commitGroups) || typeof pagination?.hasNextPage !== 'boolean' || data.timedOutMessage ||
      data.filters.since !== iso(interval.from) || data.filters.until !== iso(interval.until))
    throw new Error('Incomplete public repository history');
  const revision = data.currentCommit?.oid;
  if (!repo.isEmpty && (!hash.test(revision) || (job.revision && revision !== job.revision))) throw new Error('Changed commit revision');
  const next = pagination.endCursor;
  if (pagination.hasNextPage && (!/^[0-9a-f]{40,64} \d+$/i.test(next) || next === job.cursor || !next.startsWith(revision + ' ')))
    throw new Error('Invalid history cursor');
  const rows = data.commitGroups.flatMap(group => group.commits);
  if (rows.some(c => !hash.test(c?.oid) || !Number.isFinite(Date.parse(c?.committedDate)))) throw new Error('Incomplete commit page');
  for (const c of rows) add(job,c.oid,c.committedDate,job.name);
  job.revision = revision;
  job.cursor = next;
  job.finished = !pagination.hasNextPage;
}

async function developerPage(job, read, signal) {
  const slice = job.intervals.at(-1);
  const url = new URL('https://api.github.com/search/commits');
  url.search = new URLSearchParams({q:'is:public author:' + job.name + ' committer-date:' + iso(slice.from) + '..' + iso(slice.until),
    sort:'committer-date',order:'desc',per_page:'100',page:String(slice.page)});
  const response = await read(url.href,'application/vnd.github+json',signal);
  const body = await response.json();
  if (!Array.isArray(body.items) || !Number.isSafeInteger(body.total_count) || body.total_count < 0 || body.incomplete_results !== false)
    throw new Error('Incomplete commit search');
  // GitHub limits one query to 1,000 results. Split into disjoint whole-second intervals before consuming any rows.
  if (slice.page === 1 && body.total_count > 1000 && slice.until - slice.from >= 1000) {
    const split = slice.from + Math.max(1,Math.floor((slice.until - slice.from) / 2000)) * 1000;
    job.intervals.pop();
    job.intervals.push({from:slice.from,until:split-1,page:1,received:0},{from:split,until:slice.until,page:1,received:0});
    return;
  }
  if (body.items.some(c => c?.repository?.private !== false || !c.repository.full_name || c.author?.login?.toLowerCase() !== job.name ||
      !hash.test(c.sha) || !Number.isFinite(Date.parse(c?.commit?.committer?.date)))) throw new Error('Unexpected commit search row');
  if (slice.expected !== undefined && slice.expected !== body.total_count) job.valid = false;
  slice.expected = body.total_count;
  for (const c of body.items) add(job,c.sha,c.commit.committer.date,c.repository.full_name);
  slice.received += body.items.length;
  if (response.headers.get('link')?.includes('rel="next"') && slice.page < 10) slice.page++;
  else {
    if (slice.received !== slice.expected) job.valid = false;
    job.intervals.pop();
    job.finished = !job.intervals.length;
  }
}

async function step(job, reads, signal) {
  if (job.kind === 'contributions') {
    const base = 'https://github.com/users/' + job.name + '/contributions';
    const query = new URLSearchParams({from:job.year+'-01-01',to:job.year+'-12-31'});
    const html = await (await reads.web(base + '?' + query,'text/html',signal)).text();
    job.days = profileDays(html,job.window.start,job.window.through);
    job.finished = true;
  } else if (job.kind === 'repository') await repoPage(job,reads.web,signal);
  else await developerPage(job,reads.search,signal);
}

const sources = {web:readPublic, search:(url,accept,signal) => readSearch(url,accept,'GET',signal)};
export function createYearHistory(reads = sources, clock = Date.now, capacity = 192) {
  const entries = new Map();
  let running = 0;
  // Completed records retain only daily counts. Bound the aggregate cursor memory for busy years too.
  function trimProgress() {
    let hits = 0;
    for (const entry of entries.values()) hits += entry.job.hits.size;
    if (hits <= 120_000) return;
    for (const [key,entry] of entries) {
      if (entry.pending || !entry.job.hits.size) continue;
      hits -= entry.job.hits.size;
      entries.delete(key);
      if (hits <= 120_000) break;
    }
  }
  function snapshot(job, retry) {
    const status = job.finished && job.valid ? 'complete' : job.pages ? 'partial' : 'unavailable';
    return {...job.window, status, days:{...job.days}, retryAfterSeconds:retry};
  }
  return async function get(kind, rawName, year) {
    const name = rawName.toLowerCase(), key = [kind,name,year].join('/'), now = clock();
    let entry = entries.get(key);
    if (entry?.pending) return entry.pending;
    const window = yearWindow(year,now);
    // A snapshot taken on December 31 still needs the rest of that day after New Year.
    const closedSinceCheck = entry && year < Number(dateInIndia(now).slice(0,4)) &&
      dateInIndia(Date.parse(entry.job.window.checkedAt)) <= year + '-12-31';
    if (entry && !closedSinceCheck && entry.job.window.through === window.through && now < entry.expires)
      return snapshot(entry.job,Math.max(1,Math.ceil((entry.expires-now)/1000)));
    if (running >= 6) return {...window, status:'unavailable', days:{}, retryAfterSeconds:5};
    if (!entry || closedSinceCheck || entry.job.finished || entry.job.window.through !== window.through) {
      if (!entry && entries.size >= capacity) {
        const idle = [...entries].find(([,v]) => !v.pending);
        if (!idle) return {...window,status:'unavailable',days:{},retryAfterSeconds:5};
        entries.delete(idle[0]);
      }
      entry = {job:begin(kind,name,year,now),expires:0};
    }
    entries.delete(key); entries.set(key,entry);
    running++;
    const job = entry.job;
    entry.pending = (async () => {
      let retry = 3;
      try {
        const deadline = AbortSignal.timeout(12_000);
        const budget = kind === 'repository' ? 12 : 4;
        for (let i = 0; i < budget && !job.finished; i++) {
          await step(job,reads,deadline);
          job.pages++;
          if (job.seen.size >= 25_000 && !job.finished) { job.finished = true; job.valid = false; }
        }
      } catch (err) {
        retry = err.retryAt ? Math.min(600,Math.max(3,Math.ceil((err.retryAt-clock())/1000))) : 30;
      }
      if (job.finished) {
        job.seen.clear(); job.hits.clear();
        retry = job.valid ? (window.through === dateInIndia(now) ? 3600 : 86400) : 300;
      }
      entry.expires = clock() + retry * 1000;
      return snapshot(job,retry);
    })().finally(() => { entry.pending = null; running--; trimProgress(); });
    return entry.pending;
  };
}

export const yearHistory = createYearHistory();
const lifetimeHistory = createLifetimeHistory(readPublicUser, yearHistory);
export async function historyPayload(route, ownerFeed, get = yearHistory, getLifetime = lifetimeHistory) {
  if (route.kind === 'lifetime') return {login:route.login, lifetime:await getLifetime(route.login)};
  if (route.kind !== 'board') return {login:route.login, year:route.year, metric:route.kind, activity:await get(route.kind,route.login,route.year)};
  const snapshot = await ownerFeed(route.owner);
  const project = snapshot.projects.find(p => p.public && p.key === route.owner.account + '-' + route.number);
  if (!project) throw typedError(snapshot.unavailable.length ? 503 : 404);
  const slugs = [...new Set(project.repos)];
  const repositories = {};
  const work = slugs.values();
  const started = Date.now();
  async function worker() {
    for (const slug of work) {
      repositories[slug] = Date.now() - started < 14_000 ? await get('repository',slug,route.year) :
        {...yearWindow(route.year,Date.now()),status:'unavailable',days:{},retryAfterSeconds:5};
    }
  }
  await Promise.all(Array.from({length:Math.min(3,slugs.length)},worker));
  return {project:project.key,year:route.year,repositories};
}
