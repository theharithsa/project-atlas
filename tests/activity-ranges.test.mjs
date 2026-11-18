import assert from 'node:assert/strict';
import test from 'node:test';
import {activityRange,ranges,streakSummary,monthBuckets} from '../site/activity-range.js';
import {activityHref,historyPaths,lifetimeStat} from '../site/activity.js';
import {viewLink,decodeView} from '../site/sharing.js';

test('selectable inclusive windows span calendar years, leap years and month ends',()=>{
  assert.deepEqual(ranges.map(([key])=>key),['28d','3m','6m','1y','2y','3y','4y','5y']);
  assert.equal(activityRange('2026-11-18','unknown').length,28);
  const five=activityRange('2026-11-18','5y');
  assert.equal(five.start,'2021-11-19');assert.equal(five.length,1826);assert.deepEqual(five.years,[2026,2025,2024,2023,2022,2021]);
  assert.equal(activityRange('2024-02-29','1y').start,'2023-03-01');
  assert.equal(activityRange('2024-05-31','3m').start,'2024-03-01');
});
test('range summaries count the selected dates exactly once and join streaks across years',()=>{
  const y23={start:'2023-01-01',through:'2023-12-31',checkedAt:'2026-11-18T10:00:00Z',status:'complete',days:{'2023-12-29':50,'2023-12-30':1,'2023-12-31':2}};
  const y24={start:'2024-01-01',through:'2024-01-02',checkedAt:'2024-01-02T12:00:00Z',status:'complete',days:{'2024-01-01':5}};
  const s=streakSummary('2024-01-02',[[y24,y23]],'2023-12-30');
  assert.equal(s.total,8);assert.equal(s.current,3);assert.equal(s.best,3);assert.equal(s.active,3);
  assert.equal(s.unknown,false);assert.equal(s.currentUnknown,false);assert.equal(s.touchesStart,true);assert.equal(s.complete,1);
  assert.deepEqual(monthBuckets(s.days).map(m=>[m.key,m.total,m.complete]),[['2023-12',3,true],['2024-01',5,true]]);
  const part=streakSummary('2024-01-02',[[y24]],'2023-12-30');
  assert.equal(part.total,5);assert.equal(part.covered,2);assert.equal(part.unknown,true);
});
test('shared links retain the historical range, month and contribution basis',()=>{
  const q=new URLSearchParams('range=5y&metric=contributions&activity=developer&developer=alice&month=2024-02');
  const r={page:'overview',product:'example-1',q};
  const link=decodeView(new URL(viewLink('https://example.test/',{users:['alice'],organizations:[]},r)).hash);
  const params=new URLSearchParams(link.route.split('?')[1]);
  for (const [k,v] of q) assert.equal(params.get(k),v);
  const short=activityHref(r,{range:'28d',month:null});
  assert.match(short,/range=28d/);assert.doesNotMatch(short,/month=/);
});
test('long history uses public board paths and independent profile and commit years',()=>{
  const r=activityRange('2026-11-18','5y');
  const projects=[{url:'https://github.com/orgs/team/projects/2',key:'team-2',repos:['a/repo']},
    {url:'https://example.org/invalid',key:'none',repos:['unrelated/repo']}];
  assert.equal(historyPaths(projects,r,'').length,6);
  assert.ok(historyPaths(projects,r,'').every(t=>t.path.startsWith('/api/v1/owners/orgs/team/projects/2/commits/')));
  const dev=historyPaths([],r,'alice');assert.equal(dev.length,13);assert.equal(dev.filter(t=>t.kind==='profile').length,6);
  assert.ok(dev.some(t=>t.path.endsWith('/commits/2021')));
});

test('lifetime follows the developer independently of chart range, scope or measure',()=>{
  for(const key of ['28d','3m','5y']) {
    const r=activityRange('2026-11-18',key);
    for(const login of ['alice','bob']) {
      const tasks=historyPaths([],r,login).filter(t=>t.kind==='lifetime');
      assert.deepEqual(tasks,[{kind:'lifetime',path:'/api/v1/developers/'+login+'/contributions/lifetime'}]);
    }
    assert.equal(historyPaths([],r,'').some(t=>t.kind==='lifetime'),false);
  }
  const base={start:'2016-02-29',total:0,yearsChecked:10,yearsTotal:11};
  assert.deepEqual(lifetimeStat({...base,status:'complete'}),['Lifetime contributions','0','','Since 29 Feb 2016']);
  assert.equal(lifetimeStat({...base,status:'partial',total:15})[1],'≥15');
  assert.match(lifetimeStat({...base,status:'partial'})[3],/10 of 11 years checked/);
  assert.equal(lifetimeStat({...base,total:null,status:'unavailable'})[1],'—');
  assert.equal(lifetimeStat(null,'Temporarily unavailable')[3],'Temporarily unavailable');
});
