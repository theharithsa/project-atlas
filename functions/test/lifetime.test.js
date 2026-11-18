import assert from 'node:assert/strict';
import test from 'node:test';
import {createLifetimeHistory} from '../lifetime.js';
import {historyPayload,historyRoute} from '../history.js';

const tick = Date.parse('2026-11-18T12:00:00Z');
const user = (date,login='alice') => ({id:1,login,type:'User',created_at:date+'T12:00:00Z'});
const calendar = (year,days={},status='complete',end='2026-11-18') => ({
  start:year+'-01-01',through:year===Number(end.slice(0,4)) ? end : year+'-12-31',days,status,
  retryAfterSeconds:status==='complete' ? 3600 : 15,
});

test('lifetime starts on the creation date, includes empty years, and bounds cold reads',async()=>{
  let time=tick, calls=0, metadata=0;
  const get=createLifetimeHistory(async()=>{metadata++;return user('2015-09-21');},async(kind,name,year)=>{
    assert.equal(kind,'contributions');assert.equal(name,'alice');calls++;
    const days=year===2015 ? {'2015-09-20':999,'2015-09-21':2} :
      year===2024 ? {'2024-02-29':5} : year===2026 ? {'2026-11-18':3,'2026-11-19':900} : {};
    return calendar(year,days);
  },()=>time);
  const a=await get('alice');assert.equal(a.status,'partial');assert.equal(a.total,8);assert.equal(a.yearsChecked,4);
  assert.equal(a.yearsTotal,12);assert.equal(calls,4);
  assert.deepEqual(await get('alice'),a);
  time+=a.retryAfterSeconds*1000;
  const b=await get('alice');assert.equal(b.yearsChecked,8);assert.equal(calls,8);
  time+=b.retryAfterSeconds*1000;
  const c=await get('alice');assert.equal(c.status,'complete');assert.equal(c.total,10);
  assert.equal(c.start,'2015-09-21');assert.equal(c.through,'2026-11-18');assert.equal(c.yearsChecked,12);
  assert.equal(metadata,1);assert.equal(calls,12);assert.ok(!Object.hasOwn(c,'days'));
});

test('failed calendar, confirmed zero and partial lower bound remain distinct and recover',async()=>{
  let time=tick,attempts=0;
  const get=createLifetimeHistory(async()=>user('2026-04-01'),async(_k,_l,y)=>{
    attempts++;
    return calendar(y, attempts===2 ? {'2026-05-01':2} : {}, ['unavailable','partial','complete'][attempts-1]);
  },()=>time);
  const a=await get('alice');assert.equal(a.total,null);assert.equal(a.status,'unavailable');
  time+=15_000;const b=await get('alice');assert.equal(b.total,2);assert.equal(b.status,'partial');assert.equal(b.yearsChecked,0);
  time+=15_000;const c=await get('alice');assert.equal(c.total,0);assert.equal(c.status,'complete');
});

test('a missing older year retries without recounting or blocking verified years',async()=>{
  let time=tick,failed=0;const calls={};
  const get=createLifetimeHistory(async()=>user('2023-03-01'),async(_k,_l,y)=>{
    calls[y]=(calls[y]||0)+1;
    if(y===2024 && !failed++)throw Error('offline');
    return calendar(y,{[y+'-05-05']:1});
  },()=>time);
  const r=await get('alice');assert.equal(r.yearsChecked,3);assert.equal(r.total,3);
  time+=30_000;assert.equal((await get('alice')).total,4);assert.deepEqual(calls,{2023:1,2024:2,2025:1,2026:1});
});

test('concurrent reads coalesce, unrelated logins are bounded and user totals stay isolated',async()=>{
  let release;const stop=new Promise(ok=>{release=ok;});let reads=0;
  const get=createLifetimeHistory(async login=>{reads++;await stop;return user('2026-01-01',login);},
    async(_k,login,y)=>calendar(y,{'2026-01-02':login==='alice'?8:12}),()=>tick,2);
  const a=get('alice'),b=get('alice'),c=get('bob');
  await assert.rejects(get('carol'),/busy/);release();
  assert.equal((await a).total,8);assert.equal((await b).total,8);assert.equal((await c).total,12);
  assert.equal(reads,2);
});

test('account lookup failures are bounded and an organization is never counted as a developer',async()=>{
  for (const data of [{...user('2020-01-01'),type:'Organization'},user('2030-01-01'),user('2020-01-01','other')]) {
    let reads=0,years=0;
    const get=createLifetimeHistory(async()=>{reads++;return data;},async()=>{years++;},()=>tick);
    const check=e=>data.type==='Organization'?e.status===404:/Invalid/.test(e.message);
    await assert.rejects(get('alice'),check);await assert.rejects(get('alice'),check);
    assert.equal(reads,1);assert.equal(years,0);
  }
});

test('India New Year refreshes the final prior-year day and opens the next year',async()=>{
  let time=Date.parse('2025-12-31T18:29:00Z'),end='2025-12-31';const calls=[];
  const get=createLifetimeHistory(async()=>user('2025-03-01'),async(_k,_l,y)=>{
    calls.push(y);return calendar(y,{[y===2025?'2025-12-31':'2026-01-01']:end==='2025-12-31'?2:3},'complete',end);
  },()=>time);
  const dec=await get('alice');assert.equal(dec.total,2);assert.equal(dec.retryAfterSeconds,60);
  end='2026-01-01';time+=60_000;
  const r=await get('alice');assert.equal(r.total,6);assert.equal(r.yearsTotal,2);
  assert.deepEqual(calls,[2025,2026,2025]);
});

test('only the validated developer contribution route exposes a lifetime aggregate',async()=>{
  const route=historyRoute('/api/v1/developers/Alice/contributions/lifetime',tick);
  assert.deepEqual(route,{kind:'lifetime',login:'alice'});
  for(const path of ['/api/v1/developers/alice/commits/lifetime','/api/v1/developers/a%2Fb/contributions/lifetime',
    '/api/v1/developers/alice/contributions/lifetime?from=2000','/api/v1/owners/users/alice/projects/1/commits/lifetime'])
    assert.equal(historyRoute(path,tick),null);
  const unexpected=()=>{throw Error('unexpected lookup');};
  assert.deepEqual(await historyPayload(route,unexpected,unexpected,async login=>({total:login==='alice'?11:0})),
    {login:'alice',lifetime:{total:11}});
});
