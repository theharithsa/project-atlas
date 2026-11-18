import assert from 'node:assert/strict';
import test from 'node:test';
import {ownerLists, personalPortfolio, readPreferences, writePreferences} from '../site/portfolio.js';
import {isGitHubLogin} from '../functions/owner-settings.js';
const signal = () => new AbortController().signal;

test('personal owner input validates GitHub logins, deduplicates and preserves account types', () => {
  assert.deepEqual(ownerLists('Octo, octo  Team-A', 'Example_Org'), {users:['Octo','Team-A'], organizations:['Example_Org']});
  for (const name of ['.', 'a/b', 'https://github.com/octo', '-octo', 'octo-', 'bad--login', '#', 'a'.repeat(40)]) {
    assert.equal(isGitHubLogin(name),false);
    assert.throws(() => ownerLists(name,''));
  }
  assert.throws(() => ownerLists('Octo','octo'), /either/);
  assert.throws(() => ownerLists(Array.from({length:13},(_,i)=>'u'+i).join(','),''), /12/);
});

test('browser preferences default to shared, survive reload, and handle unavailable storage', () => {
  const blank={mode:'shared',users:[],organizations:[]};
  for(const raw of [null, 'bad-json', '{}', '{"mode":"personal","users":[],"organizations":[{}]}']) {
    assert.deepEqual(readPreferences(()=>raw),blank);
  }
  const values = {mode:'personal',users:['One'],organizations:['Group']};
  let stored;
  assert.ok(writePreferences(values, v => { stored=v; }));
  assert.deepEqual(readPreferences(() => stored),values);
  assert.equal(writePreferences(values, () => { throw new Error(); }),false);
  assert.deepEqual(readPreferences(() => { throw new Error(); }),blank);
});

function snapshot(owner, date='2026-11-18T10:00:00Z') {
  return {schemaVersion:1,owner,directoryOwners:[owner],capturedAt:date,asOf:date.slice(0,10),
    projects:[{key:owner+'-1',owner,public:true}],repositories:{'shared/repo':{capturedAt:date}},unavailable:[]};
}
test('personal owners merge by public repository, preserve oldest freshness, and report missing directories', async () => {
  const paths = [];
  const read = async path => {
    paths.push(path);
    if (path.endsWith('/missing')) throw Object.assign(new Error(),{status:404});
    if (path.endsWith('/first')) return snapshot('First','2026-11-17T18:00:00Z');
    return snapshot('Next');
  };
  const data = await personalPortfolio({users:['First'], organizations:['Next','Missing']},signal(),read);
  assert.deepEqual(paths.sort(),['/api/v1/owners/orgs/missing','/api/v1/owners/orgs/next','/api/v1/owners/users/first']);
  assert.deepEqual(data.projects.map(p=>p.owner), ['First','Next']);
  assert.equal(data.asOf,'2026-11-17');
  assert.equal(data.repositories['shared/repo'].capturedAt,'2026-11-18T10:00:00Z');
  assert.deepEqual(data.unavailable,[{owner:'Missing',reason:'Public owner directory not found for this account type'}]);
});

test('empty personal lists make no request and an unavailable or mismatched feed never substitutes shared data', async () => {
  const prefs=ownerLists('','');
  const empty=await personalPortfolio(prefs,signal(),()=>assert.fail('Unexpected request'));
  assert.deepEqual(empty.projects,[]);
  assert.deepEqual(empty.unavailable,[]);
  for(const wrong of [snapshot('elsewhere'),{...snapshot('requested'),projects:[{public:false,owner:'requested'}]}]) {
    await assert.rejects(personalPortfolio(ownerLists('requested',''),signal(),async()=>wrong), err => err.unavailable[0].owner === 'requested');
  }
  const abort=new AbortController();
  abort.abort();
  await assert.rejects(personalPortfolio(ownerLists('one',''),abort.signal,()=>assert.fail('Unexpected request')), {name:'AbortError'});
});
