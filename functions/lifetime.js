const DAY = 86_400_000;
const secondsUntil = (when, now) => Math.max(1, Math.ceil((when - now) / 1000));
const freshYear = (row, through, now) => row && row.expires > now && (!row.wasCurrent || row.asOf === through);

// Store only per-year counts between requests. The annual collector owns the calendars.
export function createLifetimeHistory(readUser, readYear, clock = Date.now, capacity = 32) {
  const entries = new Map();
  let active = 0;

  async function collect(login, entry, now, through) {
    if (!(entry.identityUntil > now)) {
      const user = await readUser(login);
      if (user?.type === 'Organization') throw Object.assign(new Error('Expected a developer'), {status:404});
      const created = Date.parse(user?.created_at);
      if (user?.type !== 'User' || user.login?.toLowerCase() !== login || !Number.isSafeInteger(user.id) ||
          !Number.isFinite(created) || created < Date.UTC(2007,0,1) || created > now)
        throw new Error('Invalid public account metadata');
      const start = new Date(created).toISOString().slice(0,10);
      if (entry.id !== user.id || entry.start !== start) entry.years.clear();
      Object.assign(entry, {id:user.id, start, identityUntil:now + DAY});
    }

    const current = Number(through.slice(0,4)), first = Number(entry.start.slice(0,4));
    const years = Array.from({length:current - first + 1}, (_,i) => current - i);
    // Check new years first, so a single unavailable calendar cannot starve older years.
    const due = years.filter(year => !freshYear(entry.years.get(year), through, now))
      .sort((a,b) => Number(entry.years.has(a)) - Number(entry.years.has(b)));
    const queue = due.slice(0,4).values();
    async function worker() {
      for (const year of queue) {
        const end = year === current ? through : year + '-12-31';
        let total = 0, status = 'unavailable', retry = 30;
        try {
          const r = await readYear('contributions',login,year);
          if (r.start !== year + '-01-01' || r.through !== end) throw new Error('Calendar dates changed');
          if (r.status !== 'unavailable')
            for (const [date,count] of Object.entries(r.days))
              if (date >= entry.start && date <= end) total += count;
          status = r.status;
          retry = r.retryAfterSeconds;
        } catch { /* Retry this year independently. */ }
        entry.years.set(year,{total,status,expires:clock() + retry * 1000,wasCurrent:year === current,asOf:through});
      }
    }
    await Promise.all([worker(),worker()]);
    let total = 0, yearsChecked = 0, observed = 0;
    const midnight = Date.parse(through + 'T00:00:00+05:30') + DAY;
    let next = Math.min(entry.identityUntil, midnight);
    const finishedAt = clock();
    for (const year of years) {
      const row = entry.years.get(year);
      if (!freshYear(row, through, finishedAt)) {
        next = Math.min(next,finishedAt + 3000);
        continue;
      }
      next = Math.min(next,row.expires);
      if (row.status === 'unavailable') continue;
      observed++;
      total += row.total;
      if (row.status === 'complete') yearsChecked++;
    }
    const status = yearsChecked === years.length ? 'complete' : observed ? 'partial' : 'unavailable';
    entry.expires = next;
    return {start:entry.start, through, total:observed ? total : null, status, yearsChecked, yearsTotal:years.length,
      retryAfterSeconds:secondsUntil(next,finishedAt)};
  }

  return async function get(login) {
    const now = clock(), through = new Date(now + 330 * 60_000).toISOString().slice(0,10);
    let entry = entries.get(login);
    if (entry?.pending) {
      if (entry.through === through) return entry.pending;
      return entry.pending.then(() => get(login), () => get(login));
    }
    if (entry?.through === through && entry.expires > now) {
      if (entry.error) throw entry.error;
      return {...entry.value,retryAfterSeconds:secondsUntil(entry.expires,now)};
    }
    if (active >= 2) throw new Error('Lifetime history busy');
    if (!entry && entries.size >= capacity) {
      const idle = [...entries].find(([,v]) => !v.pending);
      if (!idle) throw new Error('Lifetime history busy');
      entries.delete(idle[0]);
    }
    entry ||= {years:new Map()};
    entries.delete(login); entries.set(login,entry);
    entry.through = through;
    entry.error = null;
    active++;
    entry.pending = collect(login,entry,now,through).then(result => {
      entry.value = result;
      return result;
    }).catch(error => {
      entry.error = error;
      entry.expires = clock() + (error.status === 404 ? 3_600_000 : 30_000);
      throw error;
    }).finally(() => { entry.pending = null; active--; });
    return entry.pending;
  };
}
