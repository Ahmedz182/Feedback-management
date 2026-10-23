// Demo backend: serves the demo page and receives submissions.
// Every report is saved to ./uploads. Set env vars to also forward to Slack and/or ClickUp:
//   SLACK_WEBHOOK_URL=…                       (text message)
//   SLACK_BOT_TOKEN=xoxb-… SLACK_CHANNEL=C0…  (message + screenshot/video in the thread)
//   CLICKUP_TOKEN=pk_… CLICKUP_LIST_ID=…      (task with attachments)
// Run with `npm run example`, then open http://localhost:3000
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFeedbackHandler, toNodeHandler } from '../../dist/server.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const uploads = join(here, 'uploads');
const port = Number(process.env.PORT) || 3000;
const env = process.env;

const slack = env.SLACK_BOT_TOKEN
  ? { botToken: env.SLACK_BOT_TOKEN, channel: env.SLACK_CHANNEL }
  : env.SLACK_WEBHOOK_URL
    ? { webhookUrl: env.SLACK_WEBHOOK_URL }
    : undefined;
const clickup = env.CLICKUP_TOKEN
  ? { token: env.CLICKUP_TOKEN, listId: env.CLICKUP_LIST_ID, priority: { bug: 2 } }
  : undefined;

async function saveToDisk({ payload, screenshot, video }) {
  const dir = join(uploads, `${Date.now()}-${payload.type}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'payload.json'), JSON.stringify(payload, null, 2));
  for (const file of [screenshot, video]) {
    if (file) await writeFile(join(dir, file.name), Buffer.from(await file.arrayBuffer()));
  }
  console.log(`[${payload.type}] ${payload.message}  →  ${dir}`);
}

const handleFeedback = toNodeHandler(createFeedbackHandler({ slack, clickup, onFeedback: saveToDisk }));

const types = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json' };
const staticFiles = {
  '/': join(root, 'examples', 'vanilla.html'),
  '/feedback-widget.global.js': join(root, 'dist', 'feedback-widget.global.js'),
  '/feedback-widget.global.js.map': join(root, 'dist', 'feedback-widget.global.js.map'),
};

createServer(async (req, res) => {
  try {
    const path = req.url.split('?')[0];
    if (path === '/api/feedback') return await handleFeedback(req, res);
    if (path === '/api/export') {
      // Always fails, so the demo has a broken API call to report.
      res.writeHead(500, { 'content-type': 'application/json' }).end('{"error":"Export service unavailable"}');
      return;
    }
    // The demo is an SPA: unknown paths serve the page so client-side routes survive a reload.
    const file = staticFiles[path] ?? staticFiles['/'];
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'text/plain' }).end(await readFile(file));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end('Internal error');
  }
}).listen(port, () => {
  console.log(`Feedback demo running at http://localhost:${port}`);
  console.log(`Forwarding to: ${[slack && 'Slack', clickup && 'ClickUp', 'disk'].filter(Boolean).join(', ')}`);
});
