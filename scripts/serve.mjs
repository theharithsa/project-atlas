import {historyRoute, historyPayload} from '../functions/history.js';
import {developerFromPath, publicDeveloperActivity} from '../functions/activity.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import {ownerFromPath, publicOwnerFeed, missingOwner} from '../functions/owner-feed.js';
import { createFeed } from '../functions/feed.js';
import { collectPortfolio } from '../functions/github.js';
import { createOwnerSettings } from '../functions/owner-settings.js';

const settingsFile = new URL('../config/owners.json', import.meta.url);
const localSettings = createOwnerSettings(async () =>
  JSON.parse(await readFile(settingsFile, 'utf8')));
const currentPortfolio = createFeed(() => collectPortfolio(localSettings));

const site = new URL('../site/', import.meta.url);
const mime = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ...['styles.css','console.css','generated/astryx.css'].map(f => [f,'text/css; charset=utf-8']),
  ...['app', 'ui', 'work', 'overview', 'model', 'portfolio', 'sharing', 'activity', 'activity-range', 'atlas-motion', 'generated/controls'].map((f) => [
    f + '.js',
    'text/javascript; charset=utf-8',
  ]),
  ['assets/atlas.svg', 'image/svg+xml'],
  ['generated/space-grotesk.woff2', 'font/woff2'],
  ['generated/jetbrains-mono.woff2', 'font/woff2'],
  ['generated/licenses.txt', 'text/plain; charset=utf-8'],
]);
const server = createServer(async (req, res) => {
  const path = req.url === '/' ? 'index.html' : req.url.slice(1);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const history = historyRoute(req.url);
  const owner = ownerFromPath(req.url);
  const developer = developerFromPath(req.url);
  try {
    if (history || developer || owner || path === 'api/v1/portfolio') {
      const data = history ? await historyPayload(history, publicOwnerFeed) : developer ? {login:developer, activity:await publicDeveloperActivity(developer)} : owner ? await publicOwnerFeed(owner) : await currentPortfolio();
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(req.method === 'HEAD' ? undefined : JSON.stringify(data));
    } else if (mime.has(path)) {
      const content = await readFile(new URL(path, site));
      res
        .writeHead(200, { 'Content-Type': mime.get(path) })
        .end(req.method === 'HEAD' ? undefined : content);
    } else res.writeHead(404).end();
  } catch (error) {
    if (history && missingOwner(error)) {
      res.writeHead(404, {'Content-Type':'application/json','Cache-Control':'no-store'}).end('{"error":"public_history_unavailable"}');
      return;
    }
    if (owner && missingOwner(error)) {
      res.writeHead(404, {'Content-Type':'application/json', 'Cache-Control':'no-store'}).end('{"error":"public_owner_unavailable"}');
      return;
    }
    res
      .writeHead(503, {
        'Content-Type': 'application/json',
        'Retry-After': '30',
      })
      .end('{"error":"source_unavailable"}');
  }
});
server.listen(Number(process.argv[2] || 4179), '127.0.0.1', () =>
  console.log(
    'Project Atlas on http://127.0.0.1:' + server.address().port + '/',
  ),
);
