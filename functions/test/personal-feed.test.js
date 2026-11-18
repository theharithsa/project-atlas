import assert from 'node:assert/strict';
import test from 'node:test';
import {createOwnerFeeds, ownerFromPath} from '../owner-feed.js';
import {atlasPublicFeed} from '../index.js';

test('only a canonical, typed GitHub owner can select a public feed', () => {
  assert.deepEqual(ownerFromPath('/api/v1/owners/orgs/Example-Labs'), {kind:'orgs', account:'example-labs'});
  assert.deepEqual(ownerFromPath('/api/v1/owners/users/octo_cat'), {kind:'users', account:'octo_cat'});
  for (const path of ['/api/v1/owners/org/acme','/api/v1/owners/users/','/api/v1/owners/users/../repo',
    '/api/v1/owners/users/a%2Fb','/api/v1/owners/users/foo?include=private','/api/v1/owners/users/'+'x'.repeat(40)]) {
    assert.equal(ownerFromPath(path),null);
  }
});

test('owner reads coalesce, reuse fresh results, respect concurrency, and evict idle entries', async () => {
  const created = [];
  let release;
  const get = createOwnerFeeds(owner => {
    created.push(owner.account);
    return async () => {
      if (owner.account === 'first') await new Promise(resolve => { release = resolve; });
      return {owner:owner.account, unavailable:[]};
    };
  }, () => 0, 2, 1);
  const load = account => get({kind:'users', account});
  const a = load('first'), b = load('first');
  await assert.rejects(load('other'), /busy/);
  release();
  assert.equal(await a, await b);
  await load('second'); await load('first');
  await load('third'); await load('second');
  assert.deepEqual(created,['first','second','third','second']);
});

test('failed owners have a short retry interval and recover independently', async () => {
  let now = 0, reads = 0;
  const get = createOwnerFeeds(() => async () => {
    if (++reads === 1) throw new Error('Unavailable');
    return {unavailable:[]};
  }, () => now);
  const owner = {kind:'orgs',account:'example'};
  await assert.rejects(get(owner));
  now = 19_999;
  await assert.rejects(get(owner));
  assert.equal(reads,1);
  now++;
  assert.deepEqual(await get(owner),{unavailable:[]});
  assert.equal(reads,2);
});

test('the HTTPS owner route reads the specified directory anonymously and returns typed errors', async (t) => {
  const paths = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin,'https://api.github.com');
    assert.ok(!options.headers.Authorization && !options.headers.Cookie);
    paths.push(parsed.pathname);
    return parsed.pathname.includes('/missing-account/') ? new Response(null,{status:404}) : Response.json([]);
  });
  async function request(method, path, query = {}) {
    const res = {code:200,headers:{}, status(n){ this.code=n; return this; },
      set(k,v){this.headers[k]=v; return this;}, json(body){this.body=body;return this;}, end(){return this;}};
    await atlasPublicFeed({method,path,query},res);
    return res;
  }
  const route='/api/v1/owners/orgs/Outside-Shared';
  assert.equal((await request('POST',route)).code,405);
  assert.equal((await request('GET',route,{url:'invalid'})).code,404);
  assert.deepEqual(paths,[]);
  const ok=await request('GET',route);
  assert.equal(ok.code,200);
  assert.deepEqual(ok.body.directoryOwners,['outside-shared']);
  assert.deepEqual(ok.body.projects,[]);
  assert.ok(!Object.hasOwn(ok.body,'sourceSettings'));
  assert.match(ok.headers['Cache-Control'],/s-maxage=/);
  await request('HEAD',route);
  const bad=await request('GET','/api/v1/owners/users/missing-account');
  assert.equal(bad.code,404);
  assert.deepEqual(bad.body,{error:'public_owner_unavailable'});
  assert.deepEqual(paths,['/orgs/outside-shared/projectsV2','/users/missing-account/projectsV2']);
});

test('low anonymous GitHub REST quota pauses fresh personal directories while the shared feed can refresh', async (t) => {
  const {createPersonalCollector, collectPortfolio} = await import('../github.js');
  const calls = [];
  t.mock.method(globalThis,'fetch',async url => {
    calls.push(new URL(url).pathname);
    return Response.json([], {headers:{'x-ratelimit-remaining':'9','x-ratelimit-reset':String(Math.ceil(Date.now()/1000)+100)}});
  });
  await createPersonalCollector({kind:'users',account:'first-test'})();
  await assert.rejects(createPersonalCollector({kind:'users',account:'second-test'})());
  await collectPortfolio(async () => ({owners:[{kind:'orgs',account:'shared-test'}],stale:false}));
  assert.deepEqual(calls,['/users/first-test/projectsV2','/orgs/shared-test/projectsV2']);
});
