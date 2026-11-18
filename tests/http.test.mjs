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
  assert.match(await page.text(), /Project Atlas/);
  for (const path of ['/app.js','/work.js','/assets/dm-sans.ttf','/assets/atlas.svg']) {
    assert.equal((await fetch(origin + path, {method:'HEAD'})).status,200);
  }
  for (const path of ['/snapshot.json','/local-archive/owner-snapshot.json','/firebase.json','/api/v1/portfolio?repo=other']) {
    assert.equal((await fetch(origin + path)).status,404);
  }
  assert.equal((await fetch(origin + '/api/v1/portfolio',{method:'POST'})).status,405);
  const config = JSON.parse(await readFile(new URL('../firebase.json', import.meta.url),'utf8'));
  assert.equal(config.hosting.public,'site');
  assert.equal(config.hosting.rewrites.find(r => r.source === '/api/v1/portfolio')?.function.functionId,'atlasPublicFeed');
});
