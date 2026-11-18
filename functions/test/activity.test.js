import assert from 'node:assert/strict';
import test from 'node:test';
import {collectActivity, createActivityCache, developerFromPath} from '../activity.js';
import {atlasPublicFeed} from '../index.js';

const now = Date.parse('2026-11-18T10:00:00Z');
const commit = (n, date='2026-11-17T18:30:00Z') => ({
  sha:n.toString(16).padStart(40, '0'), author:{login:'example'}, repository:{private:false,full_name:'example/product'},
  commit:{message:'never returned', committer:{date, email:'example@invalid.test'}},
});
const response = (body, next=false) => Response.json(body, {headers:next ? {Link:'<https://untrusted.invalid/page>; rel="next"'} : {}});

test('repository counts follow signed-out default-branch pages and midnight in India', async () => {
  const requests = [];
  const result = await collectActivity('repository','org/project', async (url,accept,method,signal) => {
    const u = new URL(url);
    assert.equal(u.hostname,'api.github.com');
    assert.equal(u.pathname,'/repos/org/project/commits');
    assert.equal(u.searchParams.get('sha'),null);
    assert.equal(u.searchParams.get('since'),'2026-10-21T18:30:00.000Z');
    assert.equal(u.searchParams.get('until'),new Date(now).toISOString());
    assert.equal(accept,'application/vnd.github+json'); assert.equal(method,'GET'); assert.ok(signal);
    requests.push(u.searchParams.get('page'));
    return requests.length === 1 ? response([commit(1),commit(2,'2026-11-17T18:29:59Z')],true) :
      response([commit(3,'2026-10-21T18:29:59Z'),commit(4,'2026-10-21T18:30:00Z')]);
  }, now);
  assert.deepEqual(requests,['1','2']);
  assert.deepEqual(result,{start:'2026-10-22',through:'2026-11-18',checkedAt:new Date(now).toISOString(),
    days:{'2026-11-18':1,'2026-11-17':1,'2026-10-22':1}, status:'complete'});
});

test('truncation, duplicate pages and upstream outages never fabricate a complete empty window', async () => {
  let n=0;
  const truncated=await collectActivity('repository','org/repo',async()=>response([commit(++n)],true),now);
  assert.equal(n,3); assert.equal(truncated.status,'partial'); assert.equal(truncated.days['2026-11-18'],3);
  const duplicates=await collectActivity('repository','org/repo',async()=>response([commit(1),commit(1)]),now);
  assert.equal(duplicates.status,'partial'); assert.equal(duplicates.days['2026-11-18'],1);
  n=0;
  const interrupted=await collectActivity('repository','org/repo',async()=>{
    if (n++) throw Error('outage'); return response([commit(1)],true);
  },now);
  assert.deepEqual(interrupted.days,{'2026-11-18':1}); assert.equal(interrupted.status,'partial');
  const unavailable=await collectActivity('repository','org/repo',async()=>{throw Error('unavailable')},now);
  assert.equal(unavailable.status,'unavailable'); assert.deepEqual(unavailable.days,{});
  const empty=await collectActivity('repository','org/repo',async()=>response([]),now);
  assert.equal(empty.status,'complete'); assert.deepEqual(empty.days,{});
  const conflict = message => collectActivity('repository','org/repo',async()=>Response.json({message},{status:409}),now);
  assert.equal((await conflict('Git Repository is empty.')).status,'complete');
  assert.equal((await conflict('Other conflict')).status,'unavailable');
});

test('developer counts indexed public commits attributed to the login across repositories', async () => {
  let page=0;
  const result=await collectActivity('developer','example',async url=>{
    const u=new URL(url);
    assert.equal(u.pathname,'/search/commits'); assert.equal(u.searchParams.get('sort'),'committer-date');
    assert.match(u.searchParams.get('q'),/^is:public author:example committer-date:/);
    const first=page++===0;
    return response({items:first?[commit(1)]:[{...commit(1), repository:{private:false,full_name:'other/fork'}},commit(2)],incomplete_results:false,total_count:3}, first);
  },now);
  assert.equal(page,2); assert.equal(result.status,'complete'); assert.equal(result.days['2026-11-18'],2);
  for (const body of [
    {incomplete_results:true,total_count:1,items:[commit(1)]},
    {incomplete_results:false,total_count:5,items:[commit(1)]},
    {incomplete_results:false,total_count:2,items:[commit(1),{...commit(2),repository:{private:true}}]},
    {incomplete_results:false,total_count:2,items:[commit(1),{...commit(2),author:{login:'other'}}]},
  ]) {
    const partial=await collectActivity('developer','example',async()=>response(body),now);
    assert.equal(partial.status,'partial'); assert.deepEqual(partial.days,{'2026-11-18':1});
    assert.doesNotMatch(JSON.stringify(partial),/never returned|@invalid|private|other/);
  }
});

test('activity reads coalesce, bound concurrency, retry errors and renew at India midnight', async () => {
  let clock=Date.parse('2026-11-17T18:29:00Z'), calls=0, release;
  const cache=createActivityCache(2,1,()=>clock);
  const slow=async()=>{calls++; await new Promise(resolve=>{release=resolve}); return response([])};
  const a=cache('repository','Org/Repo',slow), b=cache('repository','org/repo',slow);
  assert.equal((await cache('repository','org/busy',slow)).status,'unavailable');
  release(); assert.deepEqual(await a,await b);
  const empty=async()=>{calls++;return response([])};
  await cache('repository','org/repo',empty); assert.equal(calls,1);
  clock+=60_000;
  assert.equal((await cache('repository','org/repo',empty)).through,'2026-11-18'); assert.equal(calls,2);
  const failure=async()=>{calls++;throw Error('absent')};
  await cache('repository','org/fail',failure); await cache('repository','org/fail',failure); assert.equal(calls,3);
  clock+=300_000;
  assert.equal((await cache('repository','org/fail',empty)).status,'complete'); assert.equal(calls,4);
});

test('public developer route restricts input and returns aggregate activity for anonymous reads', async t=>{
  assert.equal(developerFromPath('/api/v1/developers/Example/activity'),'example');
  for (const path of ['/api/v1/developers/a%2Fb/activity','/api/v1/developers/foo/activity?since=x','/api/v1/developers/../activity'])
    assert.equal(developerFromPath(path), null);
  const outgoing=t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(new URL(url).origin,'https://api.github.com'); assert.ok(!options.headers.Authorization);
    return response({items:[],total_count:0,incomplete_results:false});
  });
  async function call(method,path,query={}) {
    const res={code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(n){this.code=n;return this;},json(body){this.body=body;return this;},end(){return this;}};
    await atlasPublicFeed({method,path,query},res);
    return res;
  }
  const path='/api/v1/developers/example/activity';
  assert.equal((await call('POST',path)).code,405);
  assert.equal((await call('GET',path,{repo:'private'})).code,404);
  const result=await call('GET',path);
  assert.deepEqual(result.body.activity.days,{}); assert.equal(result.body.login,'example');
  assert.match(result.headers['Cache-Control'],/s-maxage=/); assert.equal(outgoing.mock.callCount(),1);
});
