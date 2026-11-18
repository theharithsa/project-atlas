import { day, iso, fmt, span, monday, phase, sprintStats, targets, shortSprint, deliveryMetrics, upcomingTarget } from './model.js';
import { icon, e, external, url, productMark, dot, empty, progress } from './ui.js';
function calendar(data, products, route) {
  const preferred = window.matchMedia('(max-width:580px)').matches ? 4 : 6;
  const weeks = route.page === 'roadmap' && route.q.get('weeks') === '12' ? 12 : preferred;
  const offset = Math.max(-104, Math.min(104, Math.trunc(Number(route.q.get('offset')) || 0)));
  const base = monday(data.asOf) + offset * 7,
    area = weeks * 7,
    stop = base + area;
  const today = day(data.asOf);
  const change = (extra) =>
    url(route.page, route.product, {
      ...Object.fromEntries(route.q),
      ...extra,
      product: route.product === 'all' ? null : route.product,
    });
  const pos = (n) => ((100 * n) / area).toFixed(4) + '%';
  const tick = (i) => `<span>${e(fmt(iso(base + i * 7), { day: 'numeric', month: 'short' }))}</span>`;
  const headerTicks = Array.from({ length: weeks }, (_, i) => tick(i)).join('');
  const marker =
    today >= base && today < stop
      ? `<span class="date-line" style="left:${pos(today - base + 0.5)}" aria-hidden="true"></span>`
      : '';
  const rows = products
    .map((p) => {
      const visible = p.sprints.filter((s) => day(s.start) < stop && day(s.end) >= base);
      const bars = visible
        .map((s) => {
          const left = Math.max(0, day(s.start) - base),
            right = Math.min(area, day(s.end) - base + 1);
          const type = phase(s, data.asOf),
            label = shortSprint(s.name);
          const href = url('sprints', p.key, { sprint: s.id });
          return `<a class="interval ${type} tone-${p.color}${right - left < 5 ? ' sliver' : ''}" href="${e(href)}" style="left:${pos(left)};width:calc(${pos(right - left)} - 3px)" title="${e(p.label + ' · ' + s.name + ' · ' + span(s.start, s.end, true))}" aria-label="${e(p.label + ' ' + s.name + ', ' + span(s.start, s.end, true))}"><span>${e(label)}</span></a>`;
        })
        .join('');
      return `<div class="timeline-row"><a class="lane-name" href="${e(url('overview',p.key,{window:route.q.get('window')}))}" title="${e(p.name)}">${dot(p)}<span>${e(p.label)}</span></a><div class="track" style="--weeks:${weeks}">${bars}${marker}</div></div>`;
    })
    .join('');
  return `<section class="calendar-panel" aria-label="Sprint calendar"><div class="calendar-top"><div><h2>Sprint calendar</h2><span class="calendar-range">${e(span(iso(base), iso(stop - 1), true))}</span></div><div class="calendar-actions"><a href="${e(change({ offset: offset - weeks }))}" aria-label="Previous ${weeks} weeks">${icon('left', 15)}</a><a href="${e(change({ offset: 0 }))}" class="cal-reset" aria-label="Return to the current week" title="Return to the current week">${e(fmt(data.asOf))}</a><a href="${e(change({ offset: offset + weeks }))}" aria-label="Next ${weeks} weeks">${icon('right', 15)}</a></div></div>
    <div class="timeline-scroll" role="region" tabindex="0" aria-label="Sprint timeline"><div class="timeline ${weeks === 12 ? 'wide' : weeks === 4 ? 'compact' : ''}"><div class="timeline-head"><span class="lane-caption">Product</span><div class="ticks" style="--weeks:${weeks}">${headerTicks}</div></div>${rows}</div></div>
    <div class="calendar-foot"><span><i class="legend-solid"></i>Current</span><span><i class="legend-outline"></i>Other sprint windows</span><span><i class="legend-date"></i>${e(fmt(data.asOf))}</span>${route.page === 'roadmap' ? `<a class="week-switch" href="${e(change({ weeks: weeks === 12 ? preferred : 12, offset: 0 }))}">Show ${weeks === 12 ? preferred : 12} weeks ${icon('right', 12)}</a>` : ''}</div></section>`;
}
function upcomingCard(list, route, timeframe) {
  const entries = list
    .slice(0, 3)
    .map((m) => {
      const p = m.products[0];
      return external(
        m.url,
        `<span class="date-tile"><small>${e(fmt(m.due, { month: 'short' }))}</small><b>${e(fmt(m.due, { day: '2-digit' }))}</b></span><span class="release-text"><strong>${e(m.name.match(/^(?:release\s+)?v?\d+\.\d+\.\d+(?:[-+][^\s]+)?/i)?.[0] || m.name)}</strong><span>${dot(p)}${e(p.label)}</span></span>${icon('external', 15)}`,
        'release-row',
        m.name + ', ' + p.label + ', ' + fmt(m.due, { day: 'numeric', month: 'long', year: 'numeric' }),
      );
    })
    .join('');
  return `<section class="panel releases-mini"><div class="panel-head"><h2>Upcoming releases</h2><span class="count-pill">${list.length}</span></div><div class="release-list">${entries || empty('No releases due in the next ' + timeframe.label, 'View the roadmap for other targets.')}</div><a class="section-link" href="${e(url('roadmap',route.product,{when:'upcoming',window:timeframe.key}))}">View release roadmap ${icon('arrow', 15)}</a></section>`;
}
function productTable(data, products, timeframe) {
  return `<section class="panel product-panel"><div class="panel-head"><h2>Product status</h2><span class="subcount">${products.length} ${products.length === 1 ? 'product' : 'products'}</span></div>
  <div class="product-table" role="table" aria-label="Product status"><div class="pt-head pt-grid" role="row">${['Product', 'Current sprint', 'Sprint closure', 'Backlog', 'Next release'].map((t) => `<span role="columnheader">${t}</span>`).join('')}</div>
  ${products
    .map((p) => {
      const now = p.current[0],
        stats = now ? sprintStats(p, now) : null;
      const next = targets(data, [p]).find((m) => m.version && upcomingTarget(m,data.asOf));
      return `<div class="pt-row pt-grid" role="row"><div role="cell"><a class="product-label" href="${e(url('overview',p.key,{window:timeframe.key}))}">${productMark(p)}<span>${e(p.label)}</span></a></div><div role="cell" class="pt-sprint">${now ? `<a href="${e(url('sprints', p.key, { sprint: now.id }))}">${e(shortSprint(now.name))}</a><small>${e(span(now.start, now.end))}</small>` : 'No current sprint'}</div>
    <div role="cell" class="pt-progress tone-${p.color}"><span class="tiny-label">Sprint closure</span>${stats ? `<span class="closure"><b>${stats.closed}/${stats.total}</b> closed</span>${progress(stats.closed, stats.total)}` : '—'}</div>
    <div role="cell" class="pt-backlog"><span class="tiny-label">Backlog</span><a href="${e(url('backlog', p.key))}">${p.backlog.length}</a></div><div role="cell" class="pt-release"><span class="tiny-label">Next release</span>${next ? external(next.url, `${e(fmt(next.due))} ${icon('external', 12)}`, 'date-link') : '<span class="muted">No date set</span>'}</div></div>`;
    })
    .join('')}</div></section>`;
}
function distribution(pList, r) {
  const counts = new Map();
  for (const p of pList) {
    for (const i of p.open) {
      const raw = i.status || 'No status',
        key = raw.toLowerCase();
      const entry = counts.get(key) || { key, label: raw, count: 0 };
      entry.count++;
      counts.set(key, entry);
    }
  }
  const sorted = [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
  const total = sorted.reduce((n, g) => n + g.count, 0);
  if (!total) return '';
  const colors = ['violet', 'blue', 'green', 'amber', 'rose'];
  const jump = (x) => url('backlog', r.product, { scope: 'all', status: x.key });
  return `<section class="panel status-mix"><div class="panel-head"><h2>Open work by GitHub status</h2><span class="subcount">${total} issues</span></div><div class="mix-bar" aria-hidden="true">${sorted.map((x, i) => `<i class="tone-${colors[i % colors.length]}" style="flex:${x.count}"></i>`).join('')}</div><div class="mix-legend">${sorted.map((x, i) => `<a href="${e(jump(x))}"><i class="product-dot tone-${colors[i % colors.length]}"></i>${e(x.label)} <b>${x.count}</b></a>`).join('')}</div></section>`;
}

function overview(data, products, route, timeframe) {
  const delivery = deliveryMetrics(data,products,timeframe);
  const open = products.reduce((count,p) => count + p.open.length,0);
  const backlog = products.reduce((count,p) => count + p.backlog.length,0);
  const sprintLink = url('sprints',route.product,{period:'window',window:timeframe.key});
  const metrics = [
    ['box','violet','Open work',open,'Open issues across the selection',
      url('backlog',route.product,{scope:'all'})],
    ['sprint','blue','Open in sprint windows',delivery.sprintOpen,'Sprints overlapping the last ' + timeframe.label,
      sprintLink],
    ['inbox','amber','Unscheduled backlog',backlog,'Open work awaiting a plan',
      url('backlog',route.product)],
    ['flag','green','Dated releases',delivery.upcoming.length,'Targets through ' + fmt(timeframe.releaseThrough),
      url('roadmap',route.product,{when:'upcoming',window:timeframe.key})],
    ['clock','green','Closed in ' + timeframe.label,delivery.recentlyClosed,span(timeframe.from,timeframe.through),
      url('history',route.product,{window:timeframe.key})],
    ['check','violet','Sprint completion',delivery.completion === null ? '—' : delivery.completion + '%',
      delivery.sprintTotal ? delivery.sprintClosed + ' of ' + delivery.sprintTotal + ' assigned issues closed' : 'No issues assigned in matching sprints',
      sprintLink],
    ['calendar','blue','Needs a sprint',delivery.needsSprint,'Open issues with only a milestone',
      url('backlog',route.product,{scope:'milestone'})],
    ['flag','amber','Undated releases',delivery.undated,'Version milestones with open work',
      url('roadmap',route.product,{kind:'releases',when:'undated'})],
  ];
  return `<section class="metrics" aria-label="Delivery metrics">${metrics.map(([ic,c,label,n,help,href]) =>
    `<a href="${e(href)}" class="metric"><span class="metric-heading"><span class="metric-icon tone-${c}">${icon(ic,17)}</span>${e(label)}</span><b>${n}</b><small>${e(help)}</small></a>`).join('')}</section>
    <div class="overview-panels">${calendar(data,products,route)}${upcomingCard(delivery.upcoming,route,timeframe)}</div>${productTable(data,products,timeframe)}${distribution(products,route)}`;
}
export { overview, calendar };
