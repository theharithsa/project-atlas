import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPages, publicItem, flatBoardPage } from '../github.js';
import { createFeed } from '../feed.js';

const slug = 'owner/product';
const fields = { byName: new Map(), periods: new Map() };
function example() {
  return {
    id: 5,
    contentType: 'Issue',
    content: { url: 'https://github.com/owner/product/issues/3' },
    memexProjectColumnValues: [
      {
        memexProjectColumnId: 'Repository',
        value: { isPublic: true, nameWithOwner: slug },
      },
      {
        memexProjectColumnId: 'Title',
        value: { title: { raw: 'Issue <example>' }, number: 3, state: 'open' },
      },
      { memexProjectColumnId: 'Sub-issues progress', value: { total: 2 } },
    ],
  };
}
function batch(ids, more, total) {
  return {
    nodes: ids.map((id) => ({ id })),
    pageInfo: { hasNextPage: more, endCursor: more ? 'next' : null },
    totalCount: { value: total, isApproximate: false },
  };
}
test('a flat board requests child issues on every page', () => {
  for (const cursor of [null, 'a+b/=']) {
    const u = flatBoardPage('/memexes/17/paginated_items', cursor);
    assert.equal(u.searchParams.get('hierarchy'), 'false');
    assert.equal(u.searchParams.get('layout'), 'table');
    assert.equal(u.searchParams.get('after'), cursor);
  }
});
test('collects every page and checks the final total', async () => {
  const values = await publicPages(async (cursor) =>
    cursor ? batch([3], false, 3) : batch([1, 2], true, 3),
  );
  assert.deepEqual(
    values.map((v) => v.id),
    [1, 2, 3],
  );
});
test('rejects changing or incomplete membership totals', async () => {
  await assert.rejects(
    publicPages(async (c) => (c ? batch([1], false, 2) : batch([1], true, 2))),
  );
  await assert.rejects(publicPages(async () => batch([1], false, 2)));
});
test('projects only allowlisted, public issue fields', () => {
  const row = example();
  row.privateNotes = 'ignore';
  row.memexProjectColumnValues.push({
    memexProjectColumnId: 'Parent issue',
    value: { owner: 'private', repository: 'other', number: 1 },
  });
  const item = publicItem(row, [slug], fields);
  assert.equal(item.kind, 'Issue');
  assert.equal(item.rollup, true);
  assert.equal(item.title, 'Issue <example>');
  assert.equal(item.parent, null);
  assert.ok(!('privateNotes' in item));
});
test('omits drafts, archived entries, private repositories and unexpected URLs', () => {
  for (const mutate of [
    (r) => {
      r.contentType = 'DraftIssue';
    },
    (r) => {
      r.isArchived = true;
    },
    (r) => {
      r.contentType = 'Redacted';
    },
    (r) => {
      r.memexProjectColumnValues[0].value.isPublic = false;
    },
    (r) => {
      r.content.url = 'https://example.com/';
    },
  ]) {
    const row = example();
    mutate(row);
    assert.equal(publicItem(row, [slug], fields), null);
  }
  assert.equal(publicItem(example(), ['another/repo'], fields), null);
});
test('maps native sprint, status, priority, milestone and merged pull request states', () => {
  const row = example();
  row.contentType = 'PullRequest';
  row.content.url = 'https://github.com/owner/product/pull/3';
  row.memexProjectColumnValues[1].value.state = 'merged';
  row.memexProjectColumnValues.push(
    ...[
      ['Status', { id: 'ready' }],
      [71, { id: 'p0' }],
      [72, { id: 's2' }],
      [
        'Milestone',
        { repoNameWithOwner: slug, number: 9, state: 'open', title: 'v2.0.0' },
      ],
    ].map(([memexProjectColumnId, value]) => ({ memexProjectColumnId, value })),
  );
  const f = {
    byName: new Map([
      [
        'status',
        {
          id: 'Status',
          settings: { options: [{ id: 'ready', name: 'Ready' }] },
        },
      ],
      [
        'priority',
        { id: 71, settings: { options: [{ id: 'p0', name: 'P0' }] } },
      ],
    ]),
    sprint: { id: 72 },
    periods: new Map([['s2', {}]]),
  };
  const item = publicItem(row, [slug], f);
  assert.deepEqual(
    [item.state, item.status, item.priority, item.sprint, item.milestone],
    [
      'MERGED',
      'Ready',
      'P0',
      's2',
      'https://github.com/owner/product/milestone/9',
    ],
  );
});
test('parallel visitors share a single refresh and get a new result after expiry', async () => {
  let calls = 0,
    now = 0;
  const feed = createFeed(
    async () => ({ unavailable: [], version: ++calls }),
    () => now,
  );
  const [first, second] = await Promise.all([feed(), feed()]);
  assert.equal(first, second);
  assert.equal(calls, 1);
  now = 59000;
  assert.equal((await feed()).version, 1);
  now = 60000;
  assert.equal((await feed()).version, 2);
});
test('failed refreshes retry and do not redate expired data', async () => {
  let loads = 0,
    now = 0;
  const feed = createFeed(
    async () => {
      if (++loads === 2) throw Error('source unavailable');
      return { unavailable: [], version: loads };
    },
    () => now,
  );
  await feed();
  now = 61000;
  await assert.rejects(feed());
  assert.equal((await feed()).version, 3);
});
