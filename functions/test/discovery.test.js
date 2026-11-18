import assert from 'node:assert/strict';
import test from 'node:test';
import {createProjectDirectory, directoryRefreshSeconds} from '../discovery.js';
import {collectPortfolio} from '../github.js';

const owner = {account: 'Example', kind: 'users'};
const entry = (number, overrides = {}) => ({
  number, public: true, state: 'open', owner: {login: 'Example'}, ...overrides,
});
const page = (rows, next) => Response.json(rows, {
  headers: next ? {Link: '<' + next + '>; rel="next"'} : {},
});

test('discovers every directory page, validates scope and deduplicates boards', async () => {
  const requests = [];
  const directory = createProjectDirectory(async (url) => {
    requests.push(new URL(url));
    return requests.length === 1
      ? page([entry(2), entry(3, {public: false}), entry(4, {state: 'closed'}),
          entry(5, {owner: {login: 'elsewhere'}}), entry(6, {deleted_at: 'today'}),
          entry(7, {closed_at: 'today'})], 'https://api.github.com/user/123/projectsV2?after=next%2Bpage')
      : page([entry(2), entry(8)]);
  });
  const boards = await directory(owner);
  assert.deepEqual(boards.map(b => b.number), [2, 8]);
  assert.equal(boards[1].url, 'https://github.com/users/Example/projects/8');
  assert.equal(requests[1].pathname, '/users/Example/projectsV2');
  assert.equal(requests[1].searchParams.get('after'), 'next+page');
});

test('refresh introduces a new board and removes closed and deleted boards without an edit', async () => {
  let now = 0, rows = [entry(3)], calls = 0;
  const directory = createProjectDirectory(async () => { calls++; return page(rows); }, () => now);
  assert.deepEqual((await directory(owner)).map(b => b.number), [3]);
  rows = [entry(3, {state: 'closed'}), entry(12)];
  now = directoryRefreshSeconds * 1000 - 1;
  assert.deepEqual((await directory(owner)).map(b => b.number), [3]);
  now++;
  assert.deepEqual((await directory(owner)).map(b => b.number), [12]);
  rows = [];
  now += directoryRefreshSeconds * 1000;
  assert.deepEqual(await directory(owner), []);
  assert.equal(calls, 3);
});

test('broken pagination fails the owner scan and retries without publishing a partial list', async () => {
  for (const next of ['https://example.org/api?after=1', 'https://api.github.com/user/1/projectsV2',
      'https://api.github.com/user/1/projectsV2?after=same']) {
    let broken = true;
    const directory = createProjectDirectory(async (url) => {
      assert.equal(new URL(url).hostname, 'api.github.com');
      return broken ? page([entry(1)], next) : page([entry(9)]);
    });
    await assert.rejects(directory(owner));
    broken = false;
    assert.equal((await directory(owner))[0].number, 9);
  }
});

function boardHtml(number, visible) {
  const data = {
    'memex-data': {number, id:number, public:visible, title:'Synthetic board', updatedAt:'2026-11-18'},
    'memex-owner': {login:'theharithsa'},
    'memex-columns-data': [],
    'memex-paginated-items-get-api-data': {url:'/memexes/' + number + '/paginated_items'},
  };
  return Object.entries(data).map(([id, value]) =>
    '<script id="' + id + '" type="application/json">' + JSON.stringify(value) + '</script>').join('');
}

test('an empty board is visible during a partial directory outage and disappears if it becomes private', async (t) => {
  let visible = true, orgOnline = false, reads = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    const u = new URL(url);
    if (u.pathname === '/orgs/ArohaRetreat/projectsV2') {
      return orgOnline ? page([]) : new Response(null, {status:503});
    }
    if (u.pathname === '/users/theharithsa/projectsV2') {
      return page([entry(71, {owner:{login:'theharithsa'}})]);
    }
    if (u.pathname === '/users/theharithsa/projects/71') {
      reads++;
      return new Response(boardHtml(71, visible));
    }
    if (u.pathname === '/memexes/71/paginated_items') {
      return Response.json({nodes:[], pageInfo:{hasNextPage:false}, totalCount:{value:0,isApproximate:false}});
    }
    throw Error('Unrecognized synthetic route');
  });
  const first = await collectPortfolio();
  assert.deepEqual(first.projects.map(p => [p.key, p.items, p.repos]), [['theharithsa-71', [], []]]);
  assert.deepEqual(first.unavailable.map(s => s.owner), ['ArohaRetreat']);
  visible = false;
  orgOnline = true;
  const next = await collectPortfolio();
  assert.deepEqual(next.projects, []);
  assert.deepEqual(next.repositories, {});
  assert.deepEqual(next.unavailable, []);
  assert.equal(reads, 2);
});
