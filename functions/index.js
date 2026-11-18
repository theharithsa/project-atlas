import {historyRoute, historyPayload} from './history.js';
import {developerFromPath, publicDeveloperActivity} from './activity.js';
import { onRequest } from 'firebase-functions/v2/https';
import { currentPortfolio } from './feed.js';
import {ownerFromPath, publicOwnerFeed, missingOwner} from './owner-feed.js';

export const atlasPublicFeed = onRequest(
  {
    region: 'us-east1',
    timeoutSeconds: 100,
    memory: '512MiB',
    maxInstances: 2,
    minInstances: 0,
    invoker: 'public',
  },
  async (req, res) => {
    res.set('X-Content-Type-Options', 'nosniff');
    const history = historyRoute(req.path);
    const owner = ownerFromPath(req.path);
    const developer = developerFromPath(req.path);
    if (
      (!owner && !developer && !history && !['/', '/api/v1/portfolio'].includes(req.path)) ||
      Object.keys(req.query).length
    )
      return res.status(404).end();
    if (!['GET', 'HEAD'].includes(req.method))
      return res.set('Allow', 'GET, HEAD').status(405).end();
    try {
      if (history) {
        const result = await historyPayload(history, publicOwnerFeed);
        const records = result.activity ? [result.activity] : Object.values(result.repositories);
        const ttl = Math.min(60, ...records.map(item => item.retryAfterSeconds));
        return res.set('Cache-Control', 'public, max-age=0, s-maxage=' + ttl + ', must-revalidate').json(result);
      }
      if (developer) {
        const activity = await publicDeveloperActivity(developer);
        const ttl = activity.status === 'complete' ? 3600 : 300;
        const age = Math.ceil((Date.now() - Date.parse(activity.checkedAt)) / 1000);
        return res.set('Cache-Control', 'public, max-age=0, s-maxage=' + Math.max(0, Math.min(60, ttl - age)) + ', must-revalidate')
          .json({login:developer, activity});
      }
      const data = owner ? await publicOwnerFeed(owner) : await currentPortfolio();
      // Share the remaining cache lifetime across Hosting edges and across visitors.
      const ttl = data.unavailable.length ? 20 : 60;
      const remaining = Math.max(
        0,
        ttl - Math.ceil((Date.now() - Date.parse(data.capturedAt)) / 1000),
      );
      return res
        .set(
          'Cache-Control',
          'public, max-age=0, s-maxage=' + remaining + ', must-revalidate',
        )
        .json(data);
    } catch (error) {
      if (history && missingOwner(error)) return res.status(404).set('Cache-Control','no-store').json({error:'public_history_unavailable'});
      if (owner && missingOwner(error))
        return res.status(404).set('Cache-Control', 'no-store').json({error: 'public_owner_unavailable'});
      return res
        .status(503)
        .set('Cache-Control', 'no-store')
        .set('Retry-After', '30')
        .json({ error: 'github_unavailable' });
    }
  },
);
