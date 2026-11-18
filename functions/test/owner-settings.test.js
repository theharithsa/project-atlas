import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createOwnerSettings, parseOwners, settingsRefreshSeconds} from '../owner-settings.js';
import {collectPortfolio} from '../github.js';

test('the checked-in shared settings pass the same validation used by the feed', async () => {
  const file = new URL('../../config/owners.json', import.meta.url);
  parseOwners(JSON.parse(await readFile(file, 'utf8')));
});

test('owner settings preserve type and order, normalize duplicate logins and support an empty portfolio', () => {
  assert.deepEqual(parseOwners({users:['Octo','octo'],organizations:['Sample-Org']}), [
    {account:'Octo',kind:'users'}, {account:'Sample-Org', kind:'orgs'},
  ]);
  assert.deepEqual(parseOwners({users:[],organizations:[]}), []);
  for (const config of [null, [], {users:[]}, {users:'Owner',organizations:[]},
    {users:['Octo'],organizations:['octo']}, {users:[' /Octo'],organizations:[]},
    {users:['one/two'],organizations:[]}, {users:[null],organizations:[]},
    {users:[],organizations:[],orgs:[]}]) {
    assert.throws(() => parseOwners(config));
  }
});

test('merged settings replace earlier owners and a bad revision never restores an owner that was removed', async () => {
  let source = {users:['First'], organizations:[]}, now = 0, calls = 0;
  const ttl = settingsRefreshSeconds * 1000;
  const load = createOwnerSettings(async () => { calls++; return source; }, () => now);
  assert.equal((await load()).owners[0].account, 'First');
  source = {users:[], organizations:['Next']};
  now = ttl - 1;
  assert.equal((await load()).owners[0].account, 'First');
  now++;
  assert.deepEqual((await load()).owners, [{account:'Next', kind:'orgs'}]);
  source = {};
  now += ttl;
  assert.deepEqual(await load(), {owners:[{account:'Next',kind:'orgs'}], stale:true});
  now += ttl;
  await assert.rejects(load());
  source = {users:[],organizations:[]};
  assert.deepEqual(await load(), {owners:[], stale:false});
  assert.equal(calls,5);
});

test('a valid empty configuration makes no GitHub board requests and returns an empty portfolio', async (t) => {
  const outgoing = t.mock.method(globalThis, 'fetch', () => { throw Error('Unexpected network read'); });
  const result = await collectPortfolio(async () => ({owners:[],stale:false}));
  assert.deepEqual(result.projects, []);
  assert.deepEqual(result.unavailable, []);
  assert.equal(result.owner, null);
  assert.deepEqual(result.sourceSettings.users, []);
  assert.deepEqual(result.sourceSettings.organizations, []);
  assert.equal(outgoing.mock.callCount(),0);
});

test('the portfolio switches from a personal directory to a new organization when settings change', async (t) => {
  let settings = {users: ['FirstAccount'], organizations: []};
  let now = 0;
  const load = createOwnerSettings(async () => settings, () => now);
  const paths = [];
  t.mock.method(globalThis, 'fetch', async (address) => {
    const url = new URL(address);
    assert.equal(url.origin, 'https://api.github.com');
    paths.push(url.pathname);
    return Response.json([]);
  });
  const first = await collectPortfolio(load);
  assert.deepEqual(first.directoryOwners, ['FirstAccount']);
  settings = {users: [], organizations: ['NewOrg']};
  now += settingsRefreshSeconds * 1000;
  const next = await collectPortfolio(load);
  assert.deepEqual(next.directoryOwners, ['NewOrg']);
  assert.deepEqual(next.sourceSettings, {users: [], organizations: ['NewOrg'], refreshSeconds: 300});
  assert.deepEqual(paths, ['/users/FirstAccount/projectsV2', '/orgs/NewOrg/projectsV2']);
});
