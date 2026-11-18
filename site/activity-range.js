import {day,iso} from './model.js';

export const ranges = [
  ['28d','4 weeks',0], ['3m','3 months',3], ['6m','6 months',6], ['1y','1 year',12],
  ['2y','2 years',24], ['3y','3 years',36], ['4y','4 years',48], ['5y','5 years',60],
];
export function activityRange(asOf, selection) {
  const [key,label,months] = ranges.find(([key]) => key === selection) || ranges[0];
  let start = iso(day(asOf) - 27);
  if (months) {
    const [year,month,date] = asOf.split('-').map(Number);
    const last = new Date(Date.UTC(year,month - months,0)).getUTCDate();
    const anniversary = Date.UTC(year,month - 1 - months,Math.min(date,last));
    start = iso(anniversary / 86_400_000 + 1);
  }
  const years = [];
  for (let y = +asOf.slice(0,4); y >= +start.slice(0,4); y--) years.push(y);
  return {key,label,start,through:asOf,years,length:day(asOf)-day(start)+1};
}

// A source may have one recent record or several independent calendar-year records.
export function streakSummary(asOf, sources, start = iso(day(asOf) - 27)) {
  const end = day(asOf), first = day(start);
  const lists = sources.map(source => (Array.isArray(source) ? source : [source]).filter(Boolean).map(r => {
    const checked = Date.parse(r.checkedAt);
    const checkedDate = Number.isFinite(checked) ? new Date(checked + 19_800_000).toISOString().slice(0,10) : r.through;
    return {...r,checkedDate};
  }));
  const days = Array.from({length:end - first + 1}, (_,i) => {
    const date = iso(first + i);
    let count = 0, complete = lists.length > 0;
    for (const list of lists) {
      const record = list.find(r => r.start <= date && r.through >= date);
      if (!record || record.status === 'unavailable') { complete = false; continue; }
      count += record.days[date] || 0;
      // Earlier-year records with a later check have full coverage through Dec 31.
      if (record.status !== 'complete' || (date === record.checkedDate && date < asOf)) complete = false;
    }
    return {date,count,complete};
  });
  let run = 0, best = 0, active = 0, total = 0;
  for (const d of days) {
    total += d.count;
    if (d.count) { active++; run++; best = Math.max(run,best); }
    else run = 0;
  }
  const today = days.at(-1);
  let i = days.length - (today.count ? 1 : 2);
  let current = 0;
  while (i >= 0 && days[i].count) { current++; i--; }
  const unknown = days.some(d => !d.count && !d.complete);
  const currentUnknown = (!today.count && !today.complete) || (i >= 0 && !days[i].complete);
  const covered = days.filter(d => d.complete).length;
  const complete = lists.filter(list => {
    let cursor = start;
    for (const r of list.sort((a,b) => a.start.localeCompare(b.start))) {
      if (r.status !== 'complete' || r.start > cursor || r.through < cursor) continue;
      const last = r.through < asOf && (!r.checkedAt || Date.parse(r.checkedAt) < Date.parse(r.through+'T00:00:00+05:30') + 86_400_000)
        ? day(r.through) - 1 : day(r.through);
      cursor = iso(last + 1);
    }
    return cursor > asOf;
  }).length;
  return {days,total,active,current,best,currentUnknown,unknown,covered,complete,touchesStart:current > 0 && i < 0};
}

export function monthBuckets(days) {
  const groups = new Map();
  for (const d of days) {
    const key = d.date.slice(0,7);
    if (!groups.has(key)) groups.set(key, {key,total:0,complete:true,days:[]});
    const month = groups.get(key);
    month.days.push(d); month.total += d.count;
    if (!d.complete) month.complete = false;
  }
  return [...groups.values()];
}

// The calendar starts on Monday. Empty cells are outside the selected dates.
export function calendarCells(days) {
  if (!days.length) return [];
  const offset = (day(days[0].date) + 3) % 7;
  const size = Math.ceil((offset + days.length) / 7) * 7;
  return Array.from({length:size},(_,index) => days[index-offset] ?? null);
}
