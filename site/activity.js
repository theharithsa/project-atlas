import {day, iso, fmt, span} from './model.js';
import {e, url, icon, tabs, external} from './ui.js';

const validLogin = value => typeof value === 'string' && value.length <= 39 && /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(value);
export function repositoryRecords(data, products) {
  const repositories = new Map(Object.entries(data.repositories).map(([slug, value]) => [slug.toLowerCase(), value]));
  const names = new Set(products.flatMap(p => p.repos.map(slug => slug.toLowerCase())));
  return [...names].map(slug => repositories.get(slug)?.activity);
}

export function streakSummary(asOf, records) {
  const end = day(asOf);
  const days = Array.from({length:28}, (_, index) => {
    const date = iso(end - 27 + index);
    let count = 0, complete = records.length > 0;
    for (const record of records) {
      if (!record || record.status === 'unavailable' || record.start > date || record.through < date) {
        complete = false;
        continue;
      }
      count += record.days?.[date] || 0;
      if (record.status !== 'complete' || (date === record.through && date < asOf)) complete = false;
    }
    return {date, count, complete};
  });
  let run = 0, best = 0;
  for (const d of days) {
    run = d.count ? run + 1 : 0;
    best = Math.max(run, best);
  }
  let last = days.length - 1;
  if (days[last].count === 0) last--; // Today's open day can still extend yesterday's streak.
  let current = 0;
  while (last >= 0 && days[last].count) { current++; last--; }
  const active = days.filter(d => d.count).length;
  const unknown = days.some(d => !d.count && !d.complete);
  const currentUnknown = (days.at(-1).count === 0 && !days.at(-1).complete) ||
    (last >= 0 && !days[last].complete);
  return {days, current, best, active, unknown, currentUnknown,
    touchesStart:current > 0 && (days.at(-1).count ? current === 28 : current === 27),
    complete:records.filter(r => r?.status === 'complete' && r.through === asOf).length};
}

const fullDate = date => fmt(date, {weekday:'short', day:'numeric', month:'short'});
function dayLabel(d) {
  const amount = !d.count && !d.complete ? 'Coverage unknown' :
    (d.complete ? '' : 'At least ') + d.count + (d.count === 1 ? ' commit' : ' commits');
  return fullDate(d.date) + ' · ' + amount;
}
function chart(asOf, records, coverage) {
  const s = streakSummary(asOf, records);
  const measure = (n, uncertain, extendsPast = false) => uncertain || extendsPast ? n ? '≥' + n : '—' : String(n);
  const measurements = [
    ['Current streak', measure(s.current, s.currentUnknown, s.touchesStart), 'days'],
    ['Best in 28 days', measure(s.best, s.unknown), 'days'],
    ['Active days', measure(s.active, s.unknown), '/ 28'],
  ];
  const weeks = [0,7,14,21].map(offset => {
    const week = s.days.slice(offset, offset + 7);
    return '<div class="activity-week"><small>' + e(fmt(week[0].date)) + '</small><div>' + week.map(d => {
      const level = d.count >= 8 ? 3 : d.count >= 3 ? 2 : d.count ? 1 : d.complete ? 0 : 'unknown';
      return '<button type="button" class="heat-day level-' + level + '" data-activity-day aria-pressed="' + (d.date === asOf) +
        '" title="' + e(dayLabel(d)) + '" aria-label="' + e(dayLabel(d)) + '">' + Number(d.date.slice(-2)) + '</button>';
    }).join('') + '</div></div>';
  }).join('');
  const legend = '<div class="heat-legend" aria-label="Commits per day">' + [['0','0'],['1','1–2'],['2','3–7'],['3','8+'], ...(s.days.some(d => !d.complete) ? [['unknown','Unknown']] : [])]
    .map(([level, label]) => '<span><i class="heat-day level-' + level + '"></i>' + label + '</span>').join('') + '</div>';
  return '<div class="streak-stats">' + measurements.map(([label, n, unit]) =>
    '<div><span>' + label + '</span><strong>' + n + ' <small>' + unit + '</small></strong></div>').join('') +
    '</div>' + legend + '<div class="activity-weeks" role="group" aria-label="Commit activity by day">' + weeks + '</div>' +
    '<div class="activity-caption"><output data-day-detail aria-live="polite">' + e(dayLabel(s.days.at(-1))) +
    '</output><span>' + e(coverage(s)) + '</span></div>' +
    '<p class="activity-note">Consecutive days with a commit, in India time. Today can extend yesterday’s streak.' +
    (s.unknown || s.touchesStart ? ' A ≥ value is the confirmed minimum.' : '') + '</p>';
}

export function codingPanel(data, products, route, users) {
  const developer = route.q.get('activity') === 'developer';
  const login = route.q.has('developer') ? route.q.get('developer') : (users[0] || '');
  const params = Object.fromEntries(route.q);
  delete params.product;
  delete params.activity;
  delete params.developer;
  const links = [
    ['project', 'Projects', url('overview', route.product, params)],
    ['developer', 'Developer', url('overview', route.product, {...params, activity:'developer', developer:login || null})],
  ];
  let body;
  if (developer) {
    body = '<form id="developer-form" class="developer-form"><label for="developer-login">GitHub username</label><div><input id="developer-login" name="login" value="' +
      e(login) + '" maxlength="39" required autocomplete="off" spellcheck="false" autocapitalize="none"><button>View streak</button></div>' +
      '<span id="developer-error" role="alert">' + (login && !validLogin(login) ? 'Enter a valid GitHub username.' : '') + '</span></form>' +
      (validLogin(login) ? '<div data-developer-activity="' + e(login.toLowerCase()) + '"><p class="activity-note" role="status">Checking public commits…</p></div>' : '');
  } else {
    const records = repositoryRecords(data, products);
    body = records.length ? chart(data.asOf, records, s => s.complete + ' of ' + records.length + ' repositories fully checked') :
      '<p class="activity-note">No public repositories are linked to this selection.</p>';
  }
  return '<section id="coding-activity" class="panel coding-panel" aria-label="Coding streak"><div class="coding-head"><div><h2>Coding streak</h2><p>' +
    e(span(iso(day(data.asOf) - 27), data.asOf, true)) + ' · ' +
    (developer ? 'Public commits by one developer' : 'Default-branch commits across selected projects') + '</p></div>' +
    tabs('Coding streak scope', links, developer ? 'developer' : 'project') + '</div>' + body + '</section>';
}

let latestLookup;
export function hydrateDeveloper(asOf) {
  const target = document.querySelector('[data-developer-activity]');
  if (!target) return;
  const login = target.dataset.developerActivity;
  if (!latestLookup || latestLookup.login !== login || latestLookup.asOf !== asOf || Date.now() >= latestLookup.expires) {
    const request = {login, asOf, expires:Date.now() + 60_000};
    request.value = fetch('/api/v1/developers/' + encodeURIComponent(login) + '/activity', {signal:AbortSignal.timeout(20_000)})
      .then(async response => {
        if (!response.ok) throw new Error('Activity unavailable');
        const result = await response.json();
        if (result.login !== login || !['complete','partial','unavailable'].includes(result.activity?.status)) throw new Error('Invalid activity');
        request.expires = Date.parse(result.activity.checkedAt) + (result.activity.status === 'complete' ? 3600 : 300) * 1000;
        return result.activity;
      }).catch(() => null);
    latestLookup = request;
  }
  if (latestLookup.target === target) return;
  latestLookup.target = target;
  latestLookup.value.then(activity => {
    if (!target.isConnected) return;
    const coverage = s => s.complete ? 'Public commit search complete' : activity?.status === 'partial' ? 'Partial public commit search' : 'Public commit search unavailable';
    const since = new Date(iso(day(asOf) - 27) + 'T00:00:00+05:30').toISOString();
    const until = activity?.checkedAt || new Date().toISOString();
    const query = 'is:public author:' + login + ' committer-date:' + since + '..' + until;
    const source = external('https://github.com/search?type=commits&q=' + encodeURIComponent(query), 'View commits by @' + e(login) + ' on GitHub ' + icon('external', 12), 'text-link');
    target.innerHTML = chart(asOf, [activity], coverage) + '<p class="activity-source">' + source + '</p>';
  });
}
export function developerRoute(route, value) {
  const login = value.trim().replace(/^@/, '').toLowerCase();
  if (!validLogin(login)) return null;
  const params = Object.fromEntries(route.q);
  delete params.product;
  return url('overview', route.product, {...params, activity:'developer', developer:login});
}
