// @vitest-environment node
/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFeedbackHandler, describeSteps, reportMarkdown, toNodeHandler } from '../src/server';
import { toFormData } from '../src/submit';
import type { FeedbackPayload } from '../src/types';
import { Readable } from 'node:stream';

const payload: FeedbackPayload = {
  type: 'bug',
  title: 'Save button does nothing',
  message: 'Save button does nothing\nIt just spins.',
  severity: 'high',
  area: 'Settings',
  tags: ['Billing Page'],
  sentiment: 'frustrated',
  expected: 'Settings are saved',
  actual: 'Spinner forever',
  checklist: [
    { label: 'I can reproduce this consistently', checked: true },
    { label: "I've tried a hard refresh", checked: false },
  ],
  email: 'jane@acme.com',
  user: { id: 'u1', name: 'Jane' },
  metadata: { appVersion: '2.3.0' },
  context: {
    url: 'https://app.acme.com/settings',
    path: '/settings',
    query: { tab: 'billing' },
    hash: '',
    title: 'Settings',
    referrer: '',
    userAgent: 'Mozilla/5.0 Test',
    language: 'en-US',
    timezone: 'UTC',
    viewport: { width: 1280, height: 800 },
    screen: { width: 1920, height: 1080, pixelRatio: 2 },
    timestamp: '2026-10-23T10:00:00.000Z',
  },
  consoleLogs: [{ level: 'error', message: 'TypeError: x is undefined', timestamp: '2026-10-23T09:59:00.000Z' }],
  networkLogs: [
    { type: 'fetch', method: 'GET', url: 'https://api.acme.com/api/ok', status: 200, ok: true, duration: 40, timestamp: '2026-10-23T09:58:00.000Z' },
    { type: 'xhr', method: 'POST', url: 'https://api.acme.com/save', status: 500, ok: false, duration: 231, timestamp: '2026-10-23T09:58:41.000Z', responseBody: '{"error":"db down"}' },
    { type: 'fetch', method: 'GET', url: 'https://api.acme.com/me', ok: false, duration: 12, timestamp: '2026-10-23T09:58:42.000Z', error: 'Failed to fetch' },
  ],
  breadcrumbs: [
    { type: 'navigation', timestamp: '2026-10-23T09:58:10.000Z', url: 'https://app.acme.com/settings', path: '/settings', title: 'Settings' },
    { type: 'click', timestamp: '2026-10-23T09:58:40.000Z', url: 'https://app.acme.com/settings', path: '/settings', title: 'Settings', target: 'button#save', text: 'Save' },
  ],
  recordingEvents: [
    { type: 'navigation', t: 0, url: 'https://app.acme.com/settings', title: 'Settings' },
    { type: 'pointer', t: 100, x: 10, y: 10 },
    { type: 'scroll', t: 1000, x: 0, y: 100 },
    { type: 'scroll', t: 1300, x: 0, y: 400 },
    { type: 'click', t: 2500, x: 50, y: 60, target: 'button#save', text: 'Save', path: '/settings?tab=billing', title: 'Settings' },
    { type: 'annotation', t: 4000, points: [[1, 1], [2, 2]] },
  ],
  screenshot: new Blob(['png'], { type: 'image/png' }),
  video: new Blob(['webm'], { type: 'video/webm' }),
  attachments: [new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' })],
};

const request = () => new Request('http://localhost/api/feedback', { method: 'POST', body: toFormData(payload) });

type FetchCall = [string, RequestInit];
function mockFetch(responder: (url: string, init: RequestInit) => unknown) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const body = responder(url, init);
    return body instanceof Response ? body : Response.json(body);
  });
  vi.stubGlobal('fetch', fetchMock);
  return () => fetchMock.mock.calls as unknown as FetchCall[];
}

afterEach(() => vi.unstubAllGlobals());

describe('report formatting', () => {
  it('turns recording events into readable steps', () => {
    expect(describeSteps(payload.recordingEvents)).toEqual([
      '0:00 Started on https://app.acme.com/settings',
      '0:01 Scrolled to y=400',
      '0:02 Clicked "Save" (button#save) on /settings?tab=billing',
      '0:04 Drew on the page',
    ]);
  });

  it('builds a markdown description with reporter, environment, steps and errors', () => {
    const { screenshot, video, ...rest } = payload;
    const markdown = reportMarkdown({ payload: rest, screenshot: screenshot as File, video: video as File });
    expect(markdown).toContain('Jane · jane@acme.com · id u1');
    expect(markdown).toContain('- **Page:** Settings · https://app.acme.com/settings');
    expect(markdown).toContain('- **Route:** /settings · query {"tab":"billing"}');
    expect(markdown).toContain('3. 0:02 Clicked "Save" (button#save) on /settings?tab=billing');
    expect(markdown).toContain('- 09:58:10 Opened /settings · Settings');
    expect(markdown).toContain('- 09:58:40 Clicked "Save" (button#save) on /settings · Settings');
    expect(markdown).toContain('- `POST https://api.acme.com/save → 500 (231 ms)`');
    expect(markdown).toContain('- `GET https://api.acme.com/me → Failed to fetch (12 ms)`');
    expect(markdown).not.toContain('/api/ok');
    expect(markdown).toContain('{"error":"db down"}');
    expect(markdown).toContain('Captured 1 console message and 3 API calls (2 failed)');
    expect(markdown).toContain('[error] TypeError: x is undefined');
    expect(markdown).toContain('"appVersion": "2.3.0"');
    expect(markdown.startsWith('**Severity:** High · **Area:** Settings · **Tags:** Billing Page · **Feeling:** Frustrated')).toBe(true);
    expect(markdown).toContain('## Expected behavior\nSettings are saved');
    expect(markdown).toContain('## Actual behavior\nSpinner forever');
    expect(markdown).toContain('- [x] I can reproduce this consistently');
    expect(markdown).toContain("- [ ] I've tried a hard refresh");
  });
});

describe('createFeedbackHandler', () => {
  it('creates a ClickUp task and uploads attachments', async () => {
    const calls = mockFetch((url) =>
      url.endsWith('/task') ? { id: 'abc', url: 'https://app.clickup.com/t/abc' } : {},
    );
    const handler = createFeedbackHandler({
      clickup: { token: 'pk_1', listId: 'L1', priority: { bug: 2 }, listByType: { suggestion: 'L2' } },
    });
    const response = await handler(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ clickup: { id: 'abc' }, errors: [] });

    const [createUrl, createInit] = calls()[0];
    expect(createUrl).toBe('https://api.clickup.com/api/v2/list/L1/task');
    expect((createInit.headers as Record<string, string>).Authorization).toBe('pk_1');
    const body = JSON.parse(createInit.body as string);
    expect(body).toMatchObject({
      name: '[Bug] Save button does nothing',
      priority: 2, // from severity: high
      tags: ['bug', 'feedback-widget', 'settings', 'billing-page'],
    });
    expect(body.markdown_content).toContain('Steps recorded during the video');

    const uploads = calls().slice(1);
    expect(uploads.map(([url]) => url)).toEqual(Array(4).fill('https://api.clickup.com/api/v2/task/abc/attachment'));
    const names = uploads.map(([, init]) => ((init.body as FormData).get('attachment') as File).name);
    expect(names).toEqual(['screenshot.png', 'recording.webm', 'photo.jpg', 'feedback-details.json']);
  });

  it('falls back to the configured ClickUp priority when no severity was picked', async () => {
    const calls = mockFetch((url) => (url.endsWith('/task') ? { id: 't', url: 'u' } : {}));
    const { severity, ...withoutSeverity } = payload;
    void severity;
    const req = new Request('http://localhost/', { method: 'POST', body: toFormData({ ...withoutSeverity, type: 'suggestion' }) });
    await createFeedbackHandler({ clickup: { token: 't', listId: 'L', priority: { suggestion: 4 } } })(req);
    expect(JSON.parse(calls()[0][1].body as string).priority).toBe(4);
  });

  it('shows severity, area and expected/actual in Slack', async () => {
    const calls = mockFetch(() => new Response('ok'));
    await createFeedbackHandler({ slack: { webhookUrl: 'https://hooks.slack.com/x' } })(request());
    const blocks = JSON.stringify(JSON.parse(calls()[0][1].body as string).blocks);
    expect(blocks).toContain('*Severity*\\nHigh');
    expect(blocks).toContain('*Area*\\nSettings');
    expect(blocks).toContain('Spinner forever');
  });

  it('includes failed API calls in the Slack message', async () => {
    const calls = mockFetch(() => new Response('ok'));
    await createFeedbackHandler({ slack: { webhookUrl: 'https://hooks.slack.com/x' } })(request());
    const blocks = JSON.stringify(JSON.parse(calls()[0][1].body as string).blocks);
    expect(blocks).toContain('Failed API calls (2)');
    expect(blocks).toContain('POST https://api.acme.com/save → 500 (231 ms)');
  });

  it('posts to a Slack webhook', async () => {
    const calls = mockFetch(() => new Response('ok'));
    const response = await createFeedbackHandler({ slack: { webhookUrl: 'https://hooks.slack.com/x' } })(request());
    expect(response.status).toBe(201);
    const [url, init] = calls()[0];
    expect(url).toBe('https://hooks.slack.com/x');
    const body = JSON.parse(init.body as string);
    expect(body.text).toBe('[Bug] Save button does nothing');
    expect(JSON.stringify(body.blocks)).toContain('Clicked \\"Save\\" (button#save)');
  });

  it('posts with a Slack bot token and uploads files into the thread', async () => {
    const calls = mockFetch((url) => {
      if (url.endsWith('chat.postMessage')) return { ok: true, channel: 'C1', ts: '111.222' };
      if (url.endsWith('files.getUploadURLExternal')) return { ok: true, upload_url: 'https://files.slack.com/up', file_id: 'F1' };
      if (url.endsWith('files.completeUploadExternal')) return { ok: true };
      return new Response('OK');
    });
    const response = await createFeedbackHandler({
      slack: { botToken: 'xoxb-1', channel: 'C1', channelByType: { bug: 'CBUGS' } },
    })(request());
    expect(response.status).toBe(201);

    const urls = calls().map(([url]) => url);
    expect(urls[0]).toBe('https://slack.com/api/chat.postMessage');
    expect(JSON.parse(calls()[0][1].body as string).channel).toBe('CBUGS');
    expect(urls.filter((u) => u.endsWith('getUploadURLExternal'))).toHaveLength(4);
    const complete = calls().find(([url]) => url.endsWith('completeUploadExternal'))!;
    expect(JSON.parse(complete[1].body as string)).toMatchObject({ channel_id: 'C1', thread_ts: '111.222' });
  });

  it('surfaces Slack API errors', async () => {
    mockFetch(() => ({ ok: false, error: 'channel_not_found' }));
    const onError = vi.fn();
    const response = await createFeedbackHandler({ slack: { botToken: 'x', channel: 'C' }, onError })(request());
    expect(response.status).toBe(502);
    expect(String(onError.mock.calls[0][0])).toContain('channel_not_found');
  });

  it('returns 201 when at least one destination succeeds', async () => {
    mockFetch(() => new Response('boom', { status: 500 }));
    const onFeedback = vi.fn();
    const response = await createFeedbackHandler({
      clickup: { token: 't', listId: 'L' },
      onFeedback,
      onError: () => {},
    })(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ errors: ['clickup'] });
    expect(onFeedback).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ type: 'bug' }) }));
  });

  it('rejects malformed requests and other methods', async () => {
    const handler = createFeedbackHandler({});
    const bad = new Request('http://localhost/', { method: 'POST', body: new FormData() });
    expect((await handler(bad)).status).toBe(400);
    expect((await handler(new Request('http://localhost/'))).status).toBe(405);
  });

  it('answers CORS preflight for allowed origins only', async () => {
    const handler = createFeedbackHandler({ allowedOrigins: ['https://app.acme.com'] });
    const preflight = (origin: string) =>
      handler(new Request('http://api/', { method: 'OPTIONS', headers: { origin } }));
    expect((await preflight('https://app.acme.com')).headers.get('access-control-allow-origin')).toBe('https://app.acme.com');
    expect((await preflight('https://evil.com')).headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('toNodeHandler', () => {
  it('adapts Node req/res to the fetch-style handler', async () => {
    const onFeedback = vi.fn();
    const node = toNodeHandler(createFeedbackHandler({ onFeedback }));
    const req = new Request('http://x', { method: 'POST', body: toFormData(payload) });
    const body = Readable.from(Buffer.from(await req.arrayBuffer()));
    Object.assign(body, {
      method: 'POST',
      url: '/api/feedback',
      headers: { host: 'localhost:3000', 'content-type': req.headers.get('content-type')! },
    });
    const res = { writeHead: vi.fn(), end: vi.fn() };
    await node(body as never, res);
    expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
    expect(onFeedback.mock.calls[0][0].payload.message).toBe(payload.message);
    expect(onFeedback.mock.calls[0][0].screenshot.size).toBe(3);
  });
});
