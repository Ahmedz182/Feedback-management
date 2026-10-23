// Zero-dependency demo backend: serves the demo page and stores submissions on disk.
// Run with `npm run example`, then open http://localhost:3000
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const uploads = join(here, 'uploads');
const port = Number(process.env.PORT) || 3000;

const types = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json' };
const staticFiles = {
  '/': join(root, 'examples', 'vanilla.html'),
  '/feedback-widget.global.js': join(root, 'dist', 'feedback-widget.global.js'),
  '/feedback-widget.global.js.map': join(root, 'dist', 'feedback-widget.global.js.map'),
};

async function saveFeedback(req) {
  // Node's built-in Request parses multipart/form-data, so no upload library is needed.
  const request = new Request('http://localhost' + req.url, {
    method: 'POST',
    headers: req.headers,
    body: req,
    duplex: 'half',
  });
  const form = await request.formData();
  const payload = JSON.parse(form.get('payload'));
  const id = `${Date.now()}-${payload.type}`;
  const dir = join(uploads, id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'payload.json'), JSON.stringify(payload, null, 2));
  for (const field of ['screenshot', 'video']) {
    const file = form.get(field);
    if (file) await writeFile(join(dir, file.name), Buffer.from(await file.arrayBuffer()));
  }
  console.log(`[${payload.type}] ${payload.message}  →  ${dir}`);
  return id;
}

createServer(async (req, res) => {
  try {
    const path = req.url.split('?')[0];
    if (req.method === 'POST' && path === '/api/feedback') {
      const id = await saveFeedback(req);
      res.writeHead(201, { 'content-type': 'application/json' }).end(JSON.stringify({ id }));
      return;
    }
    // The demo is an SPA: unknown paths serve the page so client-side routes survive a reload.
    const file = staticFiles[path] ?? staticFiles['/'];
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'text/plain' }).end(await readFile(file));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end('Internal error');
  }
}).listen(port, () => console.log(`Feedback demo running at http://localhost:${port}`));
