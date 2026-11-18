import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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
  ['styles.css', 'text/css; charset=utf-8'],
  ...['app', 'ui', 'work', 'overview', 'model'].map((f) => [
    f + '.js',
    'text/javascript; charset=utf-8',
  ]),
  ['assets/atlas.svg', 'image/svg+xml'],
  ['assets/dm-sans.ttf', 'font/ttf'],
  ['assets/dm-sans-license.txt', 'text/plain; charset=utf-8'],
]);
const server = createServer(async (req, res) => {
  const path = req.url === '/' ? 'index.html' : req.url.slice(1);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    if (path === 'api/v1/portfolio') {
      const data = await currentPortfolio();
      res
        .writeHead(200, { 'Content-Type': 'application/json' })
        .end(req.method === 'HEAD' ? undefined : JSON.stringify(data));
    } else if (mime.has(path)) {
      const content = await readFile(new URL(path, site));
      res
        .writeHead(200, { 'Content-Type': mime.get(path) })
        .end(req.method === 'HEAD' ? undefined : content);
    } else res.writeHead(404).end();
  } catch {
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
