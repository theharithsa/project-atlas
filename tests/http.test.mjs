import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';
import test from 'node:test';
import {atlasPublicFeed} from '../functions/index.js';

function response() {
  return {
    headers:{}, code:200,
    set(k,v) { this.headers[k] = v; return this; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

test('production function rejects writes, arbitrary paths and source selectors without contacting GitHub', async (t) => {
  const outgoing = t.mock.method(globalThis, 'fetch', async () => { throw Error('Unexpected request'); });
  for (const [method,path,query,code] of [
    ['POST','/api/v1/portfolio',{},405],
    ['GET','/api/v1/portfolio',{repo:'unlisted'},404],
    ['GET','/local-archive/owner-snapshot.json',{},404],
    ['POST','/api/v1/developers/octocat/contributions/lifetime',{},405],
    ['GET','/api/v1/developers/octocat/contributions/lifetime',{from:'2000'},404],
    ['PATCH','/api/v1/developers/octocat/contributions/'+new Date().getUTCFullYear(),{},405],
    ['GET','/api/v1/developers/octocat/commits/'+new Date().getUTCFullYear(),{extra:'1'},404],
    ['GET','/api/v1/owners/orgs/team/projects/1/commits/2001',{},404],
  ]) {
    const res = response();
    await atlasPublicFeed({method,path,query},res);
    assert.equal(res.code,code);
    if (code === 405) assert.equal(res.headers.Allow,'GET, HEAD');
  }
  assert.equal(outgoing.mock.callCount(),0);
});

test('source outage gives a retryable uncached response with a bounded error body', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw Error('Synthetic upstream outage'); });
  const res = response();
  await atlasPublicFeed({method:'GET',path:'/api/v1/portfolio',query:{}},res);
  assert.equal(res.code,503);
  assert.deepEqual(res.body,{error:'github_unavailable'});
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.equal(res.headers['Retry-After'],'30');
});

test('a fresh local preview serves the frontend and keeps local files outside its routes', {timeout:15000}, async (t) => {
  const src = new URL('../scripts/serve.mjs', import.meta.url);
  const child = spawn(process.execPath,[fileURLToPath(src), '0'],{stdio:['ignore','pipe','pipe']});
  const running = createInterface({input:child.stdout});
  t.after(async () => {
    running.close();
    if (child.exitCode === null && child.signalCode === null) {
      const ended = once(child, 'exit'); child.kill(); await ended;
    }
  });
  const first = await Promise.race([once(running,'line'),once(child,'exit').then(() => { throw Error('Preview failed to start'); })]);
  const origin = first[0].match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  assert.ok(origin);
  const page = await fetch(origin);
  assert.equal(page.status,200);
  const document = await page.text();
  assert.match(document,/Project Atlas/);
  assert.match(document,/<section class="feed-pending" role="status">/);
  assert.match(document,/<h1>Checking public GitHub projects…<\/h1>/);
  assert.doesNotMatch(document,/class="terrain-pin"|class="metric-heading"/);
  assert.match(document,/rel="icon" href="assets\/atlas-mark\.svg"/);
  assert.match(document,/data-astryx-theme="neutral" data-theme="dark"/);
  assert.ok(document.indexOf('src="appearance.js"') < document.indexOf('rel="stylesheet"'));
  assert.match(await (await fetch(origin + '/generated/controls.js')).text(),/astryx-button.*astryx-badge/s);
  for (const path of ['/app.js','/appearance.js','/terrain.js','/portfolio.js','/sharing.js','/activity.js','/activity-range.js','/work.js','/console.css','/atlas-motion.js','/generated/astryx.css','/generated/controls.js','/generated/space-grotesk.woff2','/generated/jetbrains-mono.woff2','/generated/licenses.txt','/assets/atlas-mark.svg']) {
    assert.equal((await fetch(origin + path, {method:'HEAD'})).status,200);
  }
  for (const path of ['/snapshot.json','/local-archive/owner-snapshot.json','/firebase.json','/api/v1/portfolio?repo=other','/api/v1/owners/orgs/not%2Fa%2Flogin','/api/v1/owners/users/octo?extra=1','/api/v1/developers/bad%2Flogin/activity','/api/v1/developers/octo/activity?extra=1']) {
    assert.equal((await fetch(origin + path)).status,404);
  }
  assert.equal((await fetch(origin + '/api/v1/portfolio',{method:'POST'})).status,405);
  const config = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url),'utf8'));
  assert.equal(config.hosting.public,'site');
  assert.equal(config.hosting.rewrites.find(r => r.source === '/api/v1/developers/**')?.function.functionId,'atlasPublicFeed');
  assert.equal(config.hosting.rewrites.find(r => r.source === '/api/v1/owners/**')?.function.functionId,'atlasPublicFeed');
  assert.equal(config.hosting.rewrites.find(r => r.source === '/api/v1/portfolio')?.function.functionId,'atlasPublicFeed');
});

test('public lifetime HTTP responses expose aggregate coverage and bounded source errors', async t=>{
  const now=new Date(),day=new Date(now.getTime()+330*60_000).toISOString().slice(0,10);
  const year=Number(day.slice(0,4)),start=(year-1)+'-12-31';
  const calls=[];
  t.mock.method(globalThis,'fetch',async (url,opts)=>{
    const u=new URL(url);calls.push(u.hostname);
    assert.equal(new Headers(opts.headers).has('authorization'),false);
    if (u.hostname==='api.github.com') {
      const login=u.pathname.split('/').pop();
      if (login==='org-for-lifetime') return Response.json({type:'Organization'});
      if (login==='offline-for-lifetime') return new Response(null,{status:503});
      return Response.json({type:'User',id:1,login,created_at:start+'T00:00:00Z',email:'synthetic@example.test'});
    }
    assert.equal(u.hostname,'github.com');
    const first=u.searchParams.get('from'),last=first.startsWith(year+'-') ? day : u.searchParams.get('to');
    const cells=[];
    for(let time=Date.parse(first);time<=Date.parse(last);time+=86_400_000) {
      const date=new Date(time).toISOString().slice(0,10),id='contribution-day-component-'+date;
      cells.push('<td id="'+id+'" data-date="'+date+'"></td><tool-tip for="'+id+'">1 contribution on this day</tool-tip>');
    }
    return new Response(cells.join(''));
  });
  const hit=async(login,method='GET')=>{
    const r=response();await atlasPublicFeed({method,path:'/api/v1/developers/'+login+'/contributions/lifetime',query:{}},r);return r;
  };
  const good=await hit('fixture-for-lifetime'),l=good.body.lifetime;
  assert.equal(good.code,200);assert.equal(l.start,start);assert.equal(l.through,day);assert.equal(l.status,'complete');
  assert.equal(l.total,Math.round((Date.parse(day)-Date.parse(start))/86_400_000)+1);
  assert.equal(l.yearsChecked,2);assert.doesNotMatch(JSON.stringify(good.body),/synthetic@|"days"/);
  assert.match(good.headers['Cache-Control'],/s-maxage=60/);
  const count=calls.length;assert.equal((await hit('fixture-for-lifetime','HEAD')).code,200);assert.equal(calls.length,count);
  const missing=await hit('org-for-lifetime');assert.equal(missing.code,404);assert.deepEqual(missing.body,{error:'public_history_unavailable'});
  const failure=await hit('offline-for-lifetime');assert.equal(failure.code,503);assert.equal(failure.headers['Retry-After'],'30');
});
