import { collectPortfolio } from './github.js';

export function createFeed(load = collectPortfolio, clock = Date.now) {
  let cached,
    expires = 0,
    pending;
  return async () => {
    if (clock() < expires && cached) return cached;
    if (!pending)
      pending = load()
        .then((result) => {
          cached = result;
          expires = clock() + (result.unavailable.length ? 20_000 : 60_000);
          return result;
        })
        .finally(() => {
          pending = undefined;
        });
    return pending;
  };
}
export const currentPortfolio = createFeed();
