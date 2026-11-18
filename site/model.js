// A sprint includes its final calendar day. The snapshot's local date is the clock for every view.
const DAY = 86400000;
export const compare = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'en', { numeric: true });
export const day = (value) => Math.round(Date.parse(value + 'T00:00:00Z') / DAY);
export const iso = (value) => new Date(value * DAY).toISOString().slice(0, 10);
export const fmt = (value, options = { month: 'short', day: 'numeric' }) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...options }).format(
    new Date(value + 'T12:00:00Z'),
  );
export function span(start, end, year = false) {
  if (start.slice(0, 7) === end.slice(0, 7))
    return (
      fmt(start, { day: 'numeric' }) +
      '–' +
      fmt(end, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) })
    );
  const opt = {
    day: 'numeric',
    month: 'short',
    ...(year || start.slice(0, 4) !== end.slice(0, 4) ? { year: 'numeric' } : {}),
  };
  return fmt(start, opt) + ' – ' + fmt(end, opt);
}
export function monday(value) {
  const idx = day(value);
  return idx - ((new Date(idx * DAY).getUTCDay() + 6) % 7);
}
export function phase(sprint, date) {
  return date < sprint.start ? 'upcoming' : date > sprint.end ? 'past' : 'current';
}
export const isVersion = (name) => /^(?:release\s+)?v?\d+\.\d+\.\d+\b/i.test(name || '');
export const isHousekeeping = (name) =>
  /^(backlog triage|dependency maintenance|cross-release epics)\b/i.test(name || '');
export const nativeBacklog = (item) => /^(backlog|todo|to do)$/i.test(item.status || '');
export const activeIssue = (item) => item.kind === 'Issue' && !item.archived && !item.rollup;
export const hasTarget = (item) => Boolean(item.milestone && !isHousekeeping(item.milestoneTitle));
export function bucket(item) {
  if (item.sprint) return 'sprint';
  if (hasTarget(item)) return 'milestone';
  if (nativeBacklog(item) || !item.status) return 'backlog';
  return 'unassigned';
}
export function sprintStats(product, sprint) {
  const work = product.work.filter((i) => i.sprint === sprint.id);
  const closed = work.filter((i) => i.state === 'CLOSED').length;
  return {
    work,
    closed,
    open: work.length - closed,
    total: work.length,
    pct: work.length ? Math.round((100 * closed) / work.length) : null,
  };
}
const productColors = ['violet', 'green', 'amber', 'blue', 'rose'];
function productColor(key) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return productColors[hash % productColors.length];
}
export function prepare(snapshot) {
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.projects))
    throw Error('Unsupported snapshot format');
  const projects = snapshot.projects
    .map((p) => {
      const work = p.items.filter(activeIssue),
        open = work.filter((i) => i.state === 'OPEN');
      return {
        ...p,
        label: p.name,
        icon: 'box',
        color: productColor(p.key),
        work,
        open,
        backlog: open.filter((i) => bucket(i) === 'backlog'),
        current: p.sprints.filter((s) => phase(s, snapshot.asOf) === 'current'),
      };
    })
    .sort((a, b) => compare(a.label, b.label));
  return { ...snapshot, projects };
}
export function targets(data, products) {
  const names = [...new Set(products.flatMap((p) => p.repos))];
  return names
    .flatMap((n) => {
      const repo = data.repositories[n];
      return (repo?.milestones || []).map((m) => ({
        ...m,
        repo: n,
        products: products.filter((p) => p.repos.includes(n)),
        version: isVersion(m.name),
        housekeeping: isHousekeeping(m.name),
      }));
    })
    .sort(
      (a, b) =>
        compare(a.due || '9999', b.due || '9999') || compare(a.repo, b.repo) || compare(a.name, b.name),
    );
}
export function issueRows(products, predicate) {
  return products.flatMap((p) => p.open.filter(predicate).map((i) => ({ p, i })));
}
export function shortSprint(name) {
  return name.split(/\s+[—–]\s+/)[0];
}
