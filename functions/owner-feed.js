import {createFeed} from './feed.js';
import {createPersonalCollector} from './github.js';
import {isGitHubLogin} from './owner-settings.js';

export function ownerFromPath(path) {
  const match = /^\/api\/v1\/owners\/(users|orgs)\/([^/]+)$/.exec(path);
  if (!match || !isGitHubLogin(match[2])) return null;
  return {kind: match[1], account: match[2].toLowerCase()};
}

// Share work for the same public owner. Each entry owns its directory and release caches.
export function createOwnerFeeds(makeCollector = createPersonalCollector, clock = Date.now, capacity = 16, concurrency = 2) {
  const entries = new Map();
  let active = 0;
  return async owner => {
    const key = owner.kind + '/' + owner.account;
    let entry = entries.get(key);
    if (!entry) {
      if (active >= concurrency) throw new Error('Owner feeds busy');
      if (entries.size >= capacity) {
        const idle = [...entries].find(([, candidate]) => !candidate.loading);
        if (!idle) throw new Error('Owner feeds busy');
        entries.delete(idle[0]);
      }
      const collect = makeCollector(owner);
      entry = {loading: false, retryAt: 0};
      entry.get = createFeed(async () => {
        if (clock() < entry.retryAt) throw entry.error;
        if (active >= concurrency) throw new Error('Owner feeds busy');
        active++;
        entry.loading = true;
        try {
          return await collect();
        } catch (error) {
          entry.error = error;
          entry.retryAt = clock() + 20_000;
          throw error;
        } finally {
          active--;
          entry.loading = false;
        }
      }, clock);
    }
    entries.delete(key);
    entries.set(key, entry);
    return entry.get();
  };
}

export const publicOwnerFeed = createOwnerFeeds();

export function missingOwner(error) {
  return error?.status === 404 || error?.status === 410;
}
