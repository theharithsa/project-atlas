const api = 'https://api.github.com';
export const directoryRefreshSeconds = 600;
export const owners = [
  { account: 'theharithsa', kind: 'users' },
  { account: 'ArohaRetreat', kind: 'orgs' },
];

function nextCursor(link) {
  const next = link?.split(',').find((part) => /;\s*rel="next"/.test(part));
  if (!next) return null;
  const location = /^ *<([^>]+)>/.exec(next)?.[1];
  const url = new URL(location);
  const cursor = url.searchParams.get('after');
  if (url.origin !== api || !cursor) throw new Error('Invalid project directory cursor');
  return cursor;
}

// Cache membership only. Every feed refresh still verifies each board while signed out.
export function createProjectDirectory(readPage, clock = Date.now) {
  const cache = new Map();
  return async function discover({account, kind}) {
    const endpoint = new URL(api + '/' + kind + '/' + account + '/projectsV2');
    const key = endpoint.href;
    const cached = cache.get(key);
    if (cached && clock() < cached.expires) return cached.boards;
    endpoint.searchParams.set('q', 'is:open');
    endpoint.searchParams.set('per_page', '100');
    const found = new Map(), seenCursors = new Set();
    for (let page = 0; page < 100; page++) {
      const response = await readPage(endpoint.href);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid project directory');
      for (const row of rows) {
        if (row?.public !== true || row.state !== 'open' || row.closed_at || row.deleted_at ||
            row.owner?.login?.toLowerCase() !== account.toLowerCase() ||
            !Number.isSafeInteger(row.number) || row.number < 1) continue;
        found.set(row.number, {
          account, number: row.number,
          url: 'https://github.com/' + kind + '/' + account + '/projects/' + row.number,
        });
      }
      const cursor = nextCursor(response.headers.get('link'));
      if (!cursor) {
        const boards = [...found.values()];
        cache.set(key, {boards, expires: clock() + directoryRefreshSeconds * 1000});
        return boards;
      }
      if (seenCursors.has(cursor)) throw new Error('Repeated project directory cursor');
      seenCursors.add(cursor);
      // GitHub can return numeric owner aliases. Rebuild the route from the configured owner.
      endpoint.searchParams.set('after', cursor);
    }
    throw new Error('Project directory exceeds page limit');
  };
}
