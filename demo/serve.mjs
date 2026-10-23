// Serves the live demo locally the same way GitHub Pages does: static files only,
// so unknown URLs (like the demo's ./api/orders/42) return 404.
// Run with `npm run demo`, then open http://localhost:4173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 4173;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.map': 'application/json' };
const files = {
  '/': join(here, 'index.html'),
  '/data.json': join(here, 'data.json'),
  '/feedback-widget.global.js': join(here, '..', 'dist', 'feedback-widget.global.js'),
  '/feedback-widget.global.js.map': join(here, '..', 'dist', 'feedback-widget.global.js.map'),
};

createServer(async (req, res) => {
  const file = files[normalize(new URL(req.url, 'http://x').pathname)];
  if (!file) return res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"Not found"}');
  try {
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'text/plain' }).end(await readFile(file));
  } catch {
    res.writeHead(500).end('Run `npm run build` first.');
  }
}).listen(port, () => console.log(`Live demo at http://localhost:${port}`));
