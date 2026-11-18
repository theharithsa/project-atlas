import {day, iso, fmt, span} from './model.js';
import {e, url, icon, tabs, external} from './ui.js';
import {activityRange, ranges, streakSummary, monthBuckets} from './activity-range.js';
export {streakSummary} from './activity-range.js';

const validLogin = value => typeof value === 'string' && value.length <= 39 && /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(value);
const number = n => n.toLocaleString('en-US');
const shortMonth = date => fmt(date,{month:'short'});
const longMonth = date => fmt(date,{month:'long',year:'numeric'});
const fullDate = date => fmt(date,{weekday:'short',day:'numeric',month:'short',year:'numeric'});
const renderValue = (n, uncertain) => uncertain ? n ? '≥' + number(n) : '—' : number(n);

export function repositoryRecords(data, products) {
  const repositories = new Map(Object.entries(data.repositories).map(([slug, value]) => [slug.toLowerCase(), value]));
  const names = new Set(products.flatMap(p => p.repos.map(slug => slug.toLowerCase())));
  return [...names].map(slug => repositories.get(slug)?.activity);
}
export function activityHref(route, changes) {
  const params = Object.fromEntries(route.q);
  delete params.product;
  return url('overview', route.product, {...params,...changes});
}
export function developerRoute(route, value) {
  const login = value.trim().replace(/^@/, '').toLowerCase();
  return validLogin(login) ? activityHref(route,{activity:'developer',developer:login}) : null;
}

function dayLabel(d,unit) {
  return fullDate(d.date) + ' · ' + (!d.count && !d.complete ? 'Coverage unknown' :
    (d.complete ? '' : 'At least ') + number(d.count) + ' ' + unit + (d.count === 1 ? '' : 's'));
}
function level(count, complete) {
  return count >= 8 ? 3 : count >= 3 ? 2 : count > 0 ? 1 : complete ? 0 : 'unknown';
}
function detailDays(days, unit, selected) {
  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    const week = days.slice(index,index+7);
    const buttons = week.map(d => {
      const label = e(dayLabel(d,unit));
      return `<button type="button" class="heat-day level-${level(d.count,d.complete)}" data-activity-day="${d.date}" aria-pressed="${d.date === selected}" title="${label}" aria-label="${label}">${Number(d.date.slice(-2))}</button>`;
    }).join('');
    weeks.push(`<div class="activity-week"><small>${e(fmt(week[0].date))}</small><div>${buttons}</div></div>`);
  }
  return `<div class="activity-weeks" role="group" aria-label="Daily ${unit} counts">${weeks.join('')}</div>`;
}
function monthsView(months, selected, route, unit) {
  const years = new Map();
  for (const month of months) {
    const year = month.key.slice(0,4);
    if (!years.has(year)) years.set(year,[]);
    years.get(year).push(month);
  }
  const rows = [...years].reverse().map(([year,entries]) => {
    const cells = Array.from({length:12},(_,i) => {
      const month = entries.find(m => Number(m.key.slice(-2)) === i+1);
      if (!month) return '<span class="month-spacer" aria-hidden="true"></span>';
      const date = month.key + '-01';
      const label = longMonth(date) + ' · ' + (month.complete || month.total ? renderValue(month.total,!month.complete) + ' ' + unit + (month.total === 1 ? '' : 's') : 'Coverage unknown');
      return `<a class="heat-month level-${level(month.total / month.days.length, month.complete)}" href="${e(activityHref(route,{month:month.key}))}" title="${e(label)}" aria-label="${e(label)}"${month.key === selected ? ' aria-current="true"' : ''}>${e(shortMonth(date))}</a>`;
    }).join('');
    return `<div class="activity-year"><strong>${year}</strong><div class="year-months">${cells}</div></div>`;
  }).join('');
  return `<p class="activity-note">Choose a month for daily counts. Shading shows its daily average.</p><div class="activity-months" aria-label="Months in the selected range">${rows}</div>`;
}

export function lifetimeStat(record, error) {
  if (!record) return ['Lifetime contributions','—','',error || 'Checking account history…'];
  const since = 'Since ' + fmt(record.start,{day:'numeric',month:'short',year:'numeric'});
  const covered = record.yearsChecked + ' of ' + record.yearsTotal + ' years checked';
  return ['Lifetime contributions', renderValue(record.total,record.status !== 'complete'), '',
    record.status === 'complete' ? since : since + ' · ' + covered];
}

function chart(view, sources, profileSources, lifetime, selectedDate) {
  const {range,route,developer,metric,login} = view;
  const commits = streakSummary(range.through,sources,range.start);
  const profile = developer ? streakSummary(range.through,profileSources,range.start) : null;
  const s = metric === 'contributions' ? profile : commits;
  const unit = metric === 'contributions' ? 'contribution' : 'commit';
  const metrics = [
    ...(profile ? [
      ['Contributions in range',renderValue(profile.total,profile.covered < range.length),''],
      lifetimeStat(lifetime?.data,lifetime?.error),
    ] : []),
    ['Total commits',renderValue(commits.total,commits.covered < range.length),''],
    ['Current streak',renderValue(s.current,s.currentUnknown || s.touchesStart),s.current === 1 ? 'day':'days'],
    ['Best in range',renderValue(s.best,s.unknown),s.best === 1 ? 'day':'days'],
    ['Active days',renderValue(s.active,s.unknown),'/ ' + number(range.length)],
  ];
  const stats = metrics.map(([label,value,unit,detail]) =>
    `<div><span>${label}</span><strong>${value} <small>${unit}</small></strong>${detail ? '<small class="stat-detail">' + e(detail) + '</small>' : ''}</div>`).join('');
  const months = monthBuckets(s.days), long = range.key !== '28d';
  const month = months.find(m => m.key === route.q.get('month')) || months.at(-1);
  const days = long ? month.days : s.days;
  const selected = days.find(d => d.date === selectedDate) || days.at(-1);
  const legend = [['0','0'],['1','1–2'],['2','3–7'],['3','8+'],...(s.covered < range.length ? [['unknown','Unknown']] : [])];
  const scale = `<div class="heat-legend" aria-label="${unit}s per day">${legend.map(([level,label]) => `<span><i class="heat-day level-${level}"></i>${label}</span>`).join('')}</div>`;
  const source = developer ? external('https://github.com/' + login + '?tab=overview&from=' + month.key + '-01&to=' + days.at(-1).date,
    'GitHub contribution profile for @' + e(login) + ' ' + icon('external',12),'text-link') : '';
  const pending = view.loading ? 'Checking history… · ' : '';
  const coverage = pending + number(s.covered) + ' of ' + number(range.length) + ' ' + unit + ' dates fully checked';
  const partialTotal = commits.covered < range.length || (profile && (profile.covered < range.length || lifetime?.data?.status === 'partial'));
  const landing = long ? monthsView(months,month.key,route,unit) + `<h3 class="month-detail">${e(longMonth(month.key+'-01'))} <small>${renderValue(month.total,!month.complete)} ${unit}${month.total === 1 ? '' : 's'}</small></h3>` : '';
  const note = unit === 'commit' ? 'Streaks use committed dates in India time.' : 'Streaks use the dates on the public GitHub contribution calendar.';
  const profileNote = developer ? ' Both contribution totals follow GitHub’s public profile calendar.' : '';
  return `<div class="streak-stats">${stats}</div>${landing}${scale}${detailDays(days,unit,selected.date)}
    <div class="activity-caption"><output data-day-detail aria-live="polite">${e(dayLabel(selected,unit))}</output><span>${e(coverage)}</span></div>
    <p class="activity-note">${note} Today can extend yesterday’s streak. The current year refreshes hourly.${profileNote}${partialTotal || s.touchesStart ? ' A ≥ value is a confirmed minimum.' : ''}</p>${source ? '<p class="activity-source">'+source+'</p>' : ''}`;
}

export function codingPanel(data, products, route, users) {
  const developer = route.q.get('activity') === 'developer';
  const login = route.q.has('developer') ? route.q.get('developer') : (users[0] || '');
  const range = activityRange(data.asOf,route.q.get('range'));
  const metric = developer && route.q.get('metric') === 'contributions' ? 'contributions' : 'commits';
  const scope = tabs('Coding streak scope',[
    ['project','Projects',activityHref(route,{activity:null,developer:null,metric:null})],
    ['developer','Developer',activityHref(route,{activity:'developer',developer:login || null})],
  ],developer ? 'developer':'project');
  const selector = `<label>Time range<select id="activity-range">${ranges.map(([key,label]) => `<option value="${key}"${range.key===key?' selected':''}>${label}</option>`).join('')}</select></label>`;
  const measure = developer ? `<label>Streak based on<select id="activity-metric"><option value="commits">Commits</option><option value="contributions"${metric === 'contributions' ? ' selected':''}>Profile contributions</option></select></label>` : '';
  const form = developer ? `<form id="developer-form" class="developer-form"><label for="developer-login">GitHub username</label><div><input id="developer-login" name="login" value="${e(login)}" maxlength="39" required autocomplete="off" spellcheck="false" autocapitalize="none"><button>View streak</button></div><span id="developer-error" role="alert">${login && !validLogin(login) ? 'Enter a valid GitHub username.' : ''}</span></form>` : '';
  const hasScope = developer ? validLogin(login) : products.some(p => p.repos.length);
  const chartBody = hasScope ? `<div id="activity-chart" data-login="${developer ? e(login.toLowerCase()) : ''}"><p class="activity-note" role="status">Checking activity…</p></div>` :
    (developer ? '' : '<p class="activity-note">No public repositories are linked to this selection.</p>');
  return `<section id="coding-activity" class="panel coding-panel" aria-label="Coding streak"><div class="coding-head"><div><h2>Coding streak</h2><p>${e(span(range.start,range.through,true))} · ${developer ? 'Public activity by one developer':'Default-branch commits across selected projects'}</p></div>${scope}</div><div class="activity-controls">${selector}${form}${measure}</div>${chartBody}</section>`;
}

const cache = new Map();
function readPath(path) {
  const now = Date.now(), existing = cache.get(path);
  if (existing && (existing.pending || existing.expires > now)) return existing.pending || Promise.resolve(existing);
  const entry = existing || {data:null,expires:0};
  const lifetime = path.endsWith('/contributions/lifetime');
  cache.delete(path); cache.set(path,entry);
  if (cache.size > 384) {
    const idle = [...cache].find(([,v]) => !v.pending && v !== entry);
    if (idle) cache.delete(idle[0]);
  }
  entry.pending = (async () => {
    try {
      const res = await fetch(path,{signal:AbortSignal.timeout(75_000)});
      if (!res.ok) throw Object.assign(new Error('Activity request unavailable'),{status:res.status});
      const data = await res.json();
      const records = lifetime ? [data.lifetime] : data.activity ? [data.activity] : Object.values(data.repositories || {});
      if (records.some(r => !r || !['complete','partial','unavailable'].includes(r.status))) throw new Error('Invalid activity');
      if (lifetime) {
        const r = data.lifetime;
        if (data.login !== path.split('/')[4] || !/^\d{4}-\d{2}-\d{2}$/.test(r.start) ||
            !Number.isFinite(Date.parse(r.start)) || !Number.isSafeInteger(r.yearsChecked) ||
            !Number.isSafeInteger(r.yearsTotal) || r.yearsChecked < 0 || r.yearsTotal < 1 || r.yearsChecked > r.yearsTotal ||
            (r.status === 'unavailable' ? r.total !== null : !Number.isSafeInteger(r.total) || r.total < 0))
          throw new Error('Invalid lifetime summary');
      } else if (records.some(r => !r.days)) throw new Error('Missing activity dates');
      entry.error = null;
      const ttl = Math.min(3600,...records.map(r => r.retryAfterSeconds || (r.status === 'complete'?3600:60)));
      entry.data = data; entry.expires = Date.now() + Math.max(2,ttl) * 1000;
    } catch (error) {
      if (lifetime) {
        entry.data = null;
        entry.error = error.status === 404 ? 'Public developer profile unavailable' : 'Temporarily unavailable';
      }
      entry.expires = Date.now() + (lifetime && error.status === 404 ? 3_600_000 : 30_000);
    }
    return entry;
  })().finally(() => { entry.pending = null; });
  return entry.pending;
}
export function historyPaths(projects, range, login) {
  const paths = [];
  if (login) {
    const base = '/api/v1/developers/' + encodeURIComponent(login) + '/';
    paths.push({kind:'lifetime',path:base+'contributions/lifetime'});
    for (const year of range.years) paths.push({kind:'profile',year,path:base + 'contributions/' + year});
    if (range.key === '28d') paths.push({kind:'commits',path:base+'activity'});
    else for (const year of range.years) paths.push({kind:'commits',year,path:base+'commits/'+year});
  } else if (range.key !== '28d') {
    for (const year of range.years) for (const p of projects) {
      const board = /^https:\/\/github\.com\/(users|orgs)\/([\w-]+)\/projects\/([1-9]\d*)$/i.exec(p.url);
      if (board && p.repos.length) paths.push({kind:'board',project:p.key,year,
        path:'/api/v1/owners/'+board[1]+'/'+board[2].toLowerCase()+'/projects/'+board[3]+'/commits/'+year});
    }
  }
  return paths;
}
function recordsFor(view) {
  const found = view.paths.map(task => [task,cache.get(task.path)?.data]);
  if (view.developer) {
    const records = kind => [found.filter(([t])=>t.kind===kind).map(([t,d]) =>
      d?.login === view.login && (!t.year || d.year === t.year) ? d.activity : null)];
    const entry = cache.get(view.paths.find(t => t.kind === 'lifetime').path);
    return [records('commits'),records('profile'),{data:entry?.data?.lifetime,error:entry?.error}];
  }
  if (view.range.key === '28d') return [repositoryRecords(view.data,view.products),[],null];
  const repos = new Map(view.products.flatMap(p => p.repos.map(n => [n.toLowerCase(),new Map()])));
  for (const [task,data] of found) {
    if (!data || data.project !== task.project || data.year !== task.year) continue;
    for (const [name,record] of Object.entries(data.repositories)) {
      const years = repos.get(name.toLowerCase());
      if (!years) continue;
      const prev = years.get(task.year);
      if (!prev || record.status === 'complete' || (prev.status !== 'complete' && record.checkedAt >= prev.checkedAt)) years.set(task.year,record);
    }
  }
  return [[...repos.values()].map(years => [...years.values()]),[],null];
}

let active;
export function hydrateActivity(data, route) {
  const target = document.getElementById('activity-chart');
  if (active?.target === target) return;
  if (active) clearTimeout(active.timer);
  active = null;
  if (!target) return;
  const range = activityRange(data.asOf,route.q.get('range'));
  const products = data.projects.filter(p => route.product === 'all' || p.key === route.product);
  const login = target.dataset.login, developer = Boolean(login);
  const view = {target,range,products,data,route,login,developer, loading:false,
    metric:developer && route.q.get('metric')==='contributions' ? 'contributions':'commits',
    paths:historyPaths(products,range,login)};
  active = view;
  const visible = () => active === view && target.isConnected;
  function paint() {
    if (!visible()) return;
    const selected = target.querySelector('[data-activity-day][aria-pressed="true"]')?.dataset.activityDay;
    const focused = target.contains(document.activeElement) ? document.activeElement : null;
    const keepDay = focused?.dataset.activityDay, keepLink = focused?.getAttribute('href');
    target.innerHTML = chart(view,...recordsFor(view),selected);
    if (keepDay || keepLink) [...target.querySelectorAll('a,button')].find(el => keepDay ? el.dataset.activityDay===keepDay : el.getAttribute('href')===keepLink)?.focus({preventScroll:true});
  }
  async function load() {
    if (!visible()) return;
    if (document.hidden && target.childElementCount > 1) { view.timer = setTimeout(load,15_000); return; }
    const tasks = view.paths.filter(t => !(cache.get(t.path)?.expires > Date.now()));
    view.loading = tasks.length > 0;
    paint();
    const queue = tasks.values();
    async function worker() {
      for (const task of queue) {
        if (!visible()) return;
        await readPath(task.path);
        if (visible()) paint();
      }
    }
    await Promise.all(Array.from({length:Math.min(2,tasks.length)},worker));
    if (!visible()) return;
    view.loading = false;
    if (tasks.length) paint();
    if (view.paths.length) {
      const next = Math.min(...view.paths.map(t => cache.get(t.path)?.expires || Date.now()+30_000));
      view.timer = setTimeout(load,Math.max(2000,next - Date.now()+100));
    }
  }
  load();
}
