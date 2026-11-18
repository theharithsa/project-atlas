import assert from 'node:assert/strict';
import test from 'node:test';
import {readSearch} from '../activity.js';
import {createYearHistory, historyPayload, historyRoute, profileDays} from '../history.js';

const now=Date.parse('2026-11-18T10:00:00Z');
const sha=n=>n.toString(16).padStart(40,'0');
const webCommit=n=>({oid:sha(n),committedDate:'2024-02-29T20:00:00Z'});
function repoResponse(url,commits,next=false,offset=34) {
  const p=new URL(url);
  return Response.json({payload:{commitsRefRoute:{repo:{public:true,private:false,ownerLogin:'Org',name:'Repo'},
    timedOutMessage:'',currentCommit:{oid:sha(9999)},filters:{since:p.searchParams.get('since'),until:p.searchParams.get('until'),
      pagination:{hasNextPage:next,endCursor:next ? sha(9999)+' '+offset:null}},commitGroups:[{commits}]}}});
}
function htmlFor(start,counts) {
  return counts.map((n,i)=>{
    const d=new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10),id='contribution-day-component-'+i;
    return '<td id="'+id+'" data-date="'+d+'" data-level="0"></td><tool-tip for="'+id+'">'+(n===0?'No':n.toLocaleString('en-US'))+' contribution'+(n===1?'':'s')+' on a date.</tool-tip>';
  }).join('');
}
test('annual profile cells use exact tooltip counts and preserve leap days and zeros',()=>{
  const html=htmlFor('2024-02-28',[1,1302,0]);
  assert.deepEqual(profileDays(html,'2024-02-28','2024-03-01'),{'2024-02-28':1,'2024-02-29':1302});
  assert.throws(()=>profileDays(html.replace('1,302 contributions','unknown'),'2024-02-28','2024-03-01'));
  assert.throws(()=>profileDays(html+html,'2024-02-28','2024-03-01'));
  assert.throws(()=>profileDays(html,'2024-02-27','2024-03-01'));
});
test('history routes whitelist canonical public scopes, time bounds and methods',()=>{
  assert.deepEqual(historyRoute('/api/v1/owners/orgs/Team/projects/4/commits/2021',now),
    {kind:'board',owner:{kind:'orgs',account:'team'},number:4,year:2021});
  assert.deepEqual(historyRoute('/api/v1/developers/Example/contributions/2026',now),{kind:'contributions',login:'example',year:2026});
  for (const p of ['/api/v1/developers/a%2Fb/contributions/2024','/api/v1/developers/a/commits/2020','/api/v1/developers/a/commits/2027',
    '/api/v1/owners/users/a/projects/01/commits/2024','/api/v1/owners/users/a/projects/1/commits/2024?repo=other'])
    assert.equal(historyRoute(p,now),null);
});
test('project history fetches only repositories verified on the named public owner board',async()=>{
  const route={kind:'board',owner:{kind:'users',account:'team'},number:1,year:2024};
  const boards=async()=>({projects:[{public:true,key:'team-1',repos:['org/repo','org/repo']},{public:true,key:'team-9',repos:['other/repo']}],unavailable:[]});
  const calls=[];
  const x=await historyPayload(route,boards,async(...args)=>{calls.push(args);return {days:{},status:'complete'}});
  assert.deepEqual(calls,[['repository','org/repo',2024]]); assert.equal(x.project,'team-1');
  await assert.rejects(historyPayload({...route,number:2},boards),e=>e.status===404);
  await assert.rejects(historyPayload(route,async()=>({projects:[],unavailable:[{}]})),e=>e.status===503);
});
test('yearly repository reads pin the revision, resume later pages and preserve public-only counts',async()=>{
  let time=now,calls=0;
  const get=createYearHistory({web:async url=>{
    calls++;
    const u=new URL(url);
    if (calls===1) assert.equal(u.pathname,'/org/repo/commits/HEAD');
    else {assert.equal(u.pathname,'/org/repo/commits/'+sha(9999));assert.equal(u.searchParams.get('after'),sha(9999)+' '+(calls-1));}
    return repoResponse(url,[webCommit(calls)],calls<15,calls);
  }},()=>time);
  const one=await get('repository','Org/Repo',2024);
  assert.equal(one.status,'partial'); assert.deepEqual(one.days,{'2024-03-01':12});
  await get('repository','Org/Repo',2024);assert.equal(calls,12);
  time+=4_000;
  const finished=await get('repository','org/repo',2024);
  assert.equal(finished.status,'complete');assert.deepEqual(finished.days,{'2024-03-01':15});
  assert.doesNotMatch(JSON.stringify(finished),/committedDate|oid|org\/repo/);
  const hidden=createYearHistory({web:async url=>{
    const doc=await repoResponse(url,[webCommit(1)]).json();
    doc.payload.commitsRefRoute.repo.private=true; return Response.json(doc);
  }},()=>now);
  assert.equal((await hidden('repository','org/repo',2024)).status,'unavailable');
});
test('developer search splits over 1000 matches into disjoint intervals and deduplicates commits across forks',async()=>{
  const bounds=[];
  const search=async url=>{
    const u=new URL(url),q=u.searchParams.get('q');
    const [a,b]=q.split('committer-date:')[1].split('..').map(Date.parse);bounds.push([a,b]);
    if(bounds.length===1)return Response.json({items:[],total_count:1200,incomplete_results:false});
    const row={sha:sha(bounds.length),author:{login:'dev'},commit:{committer:{date:new Date(a).toISOString()}},repository:{private:false,full_name:'dev/a'}};
    return Response.json({items:[row,{...row,repository:{private:false,full_name:'another/fork'}}],total_count:2,incomplete_results:false});
  };
  const get=createYearHistory({search},()=>now);
  const r=await get('commits','dev',2024);
  assert.equal(r.status,'complete');assert.equal(Object.values(r.days).reduce((x,y)=>x+y,0),2);
  assert.equal(bounds[1][1],bounds[0][1]);assert.equal(bounds[2][0],bounds[0][0]);assert.equal(bounds[1][0],bounds[2][1]+1);
});
test('rate limiting and source failures retain the cursor, distinguish unknown and retry',async()=>{
  let time=now,calls=0;
  const search=async()=>{
    calls++;
    if(calls===1)throw Object.assign(Error('Quota'),{retryAt:time+60_000});
    return Response.json({items:[],total_count:0,incomplete_results:false});
  };
  const get=createYearHistory({search},()=>time);
  const a=await get('commits','dev',2023);
  assert.equal(a.status,'unavailable');assert.equal(a.retryAfterSeconds,60);
  time+=50_000;await get('commits','dev',2023);assert.equal(calls,1);
  time+=10_001;assert.equal((await get('commits','dev',2023)).status,'complete');
});

test('concurrent lookups share a calendar read and the current window advances at India midnight',async()=>{
  let time=Date.parse('2024-01-01T18:29:00Z'),calls=0,release;
  const get=createYearHistory({web:async()=>{
    calls++;
    if(calls===1)await new Promise(resolve=>{release=resolve});
    return new Response(htmlFor('2024-01-01',[2,3]));
  }},()=>time);
  const a=get('contributions','Example',2024),b=get('contributions','example',2024);
  release();const [first,second]=await Promise.all([a,b]);
  assert.deepEqual(first,second);assert.deepEqual(first.days,{'2024-01-01':2});assert.equal(calls,1);
  time+=60_000; const next=await get('contributions','example',2024);
  assert.equal(next.through,'2024-01-02');assert.deepEqual(next.days,{'2024-01-01':2,'2024-01-02':3});assert.equal(calls,2);
});


test('anonymous history respects GitHub’s secondary rate-limit retry interval',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:403,headers:{'retry-after':'120','x-ratelimit-remaining':'9'}}));
  const before=Date.now();
  const read=()=>readSearch('https://api.github.com/search/commits','application/vnd.github+json','GET',AbortSignal.timeout(100));
  await assert.rejects(read(),error=>error.retryAt>=before+120_000);
  await assert.rejects(read(),error=>error.retryAt>=before+120_000);
  assert.equal(fetch.mock.callCount(),1);
});

test('a December 31 calendar is rechecked after India New Year even while its hourly cache is fresh',async()=>{
  let time=Date.parse('2025-12-31T18:29:50Z'),calls=0;
  const get=createYearHistory({web:async()=>{
    const days=Array(365).fill(0);days[364]=++calls;
    return new Response(htmlFor('2025-01-01',days));
  }},()=>time);
  assert.equal((await get('contributions','alice',2025)).days['2025-12-31'],1);
  time+=20_000;
  assert.equal((await get('contributions','alice',2025)).days['2025-12-31'],2);
  assert.equal(calls,2);
});
