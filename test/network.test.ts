import { afterEach, describe, expect, it, vi } from 'vitest';
import { redactUrl, sanitizeBody, startNetworkCapture, type NetworkCapture } from '../src/capture/network';

let capture: NetworkCapture | null = null;
afterEach(() => {
  capture?.stop();
  capture = null;
  vi.unstubAllGlobals();
});

const start = (overrides: Partial<Parameters<typeof startNetworkCapture>[0]> = {}) =>
  (capture = startNetworkCapture({ limit: 100, bodies: false, maxBodyLength: 2000, ignore: [], ...overrides }));

describe('redaction', () => {
  it('redacts sensitive query parameters', () => {
    expect(redactUrl('https://a.com/x?token=abc&page=2')).toBe('https://a.com/x?token=%5Bredacted%5D&page=2');
    expect(redactUrl('https://a.com/x?page=2')).toBe('https://a.com/x?page=2');
  });

  it('redacts sensitive JSON keys and form fields, and truncates', () => {
    expect(sanitizeBody('{"email":"a@b.c","password":"x","nested":{"apiKey":"k"}}', 1000)).toBe(
      '{"email":"a@b.c","password":"[redacted]","nested":{"apiKey":"[redacted]"}}',
    );
    expect(sanitizeBody('user=jo&password=x', 1000)).toBe('user=jo&password=%5Bredacted%5D');
    expect(sanitizeBody('abcdef', 3)).toBe('abc…');
  });
});

describe('startNetworkCapture: fetch', () => {
  it('records method, URL, status and duration without changing the response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":false}', { status: 503, headers: { 'content-type': 'application/json' } })));
    start({ bodies: true });
    const response = await fetch('/api/orders?secret=s', { method: 'post', body: '{"qty":2}' });
    expect(await response.text()).toBe('{"ok":false}');
    await vi.waitFor(() => expect(capture!.entries()[0].responseBody).toBe('{"ok":false}'));
    expect(capture!.entries()[0]).toMatchObject({
      type: 'fetch',
      method: 'POST',
      url: 'http://localhost:3000/api/orders?secret=%5Bredacted%5D',
      status: 503,
      ok: false,
      requestBody: '{"qty":2}',
    });
  });

  it('records network failures and rethrows them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    start();
    await expect(fetch('https://api.example.com/x')).rejects.toThrow('Failed to fetch');
    expect(capture!.entries()[0]).toMatchObject({ ok: false, error: 'Failed to fetch' });
    expect(capture!.entries()[0].status).toBeUndefined();
  });

  it('skips ignored URLs and leaves bodies out by default', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x')));
    start({ ignore: ['analytics', (url) => url.endsWith('/feedback')] });
    await fetch('https://analytics.example.com/hit');
    await fetch('/api/feedback');
    await fetch('/api/data', { method: 'PUT', body: 'secret' });
    const entries = capture!.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0].requestBody).toBeUndefined();
  });

  it('keeps only the most recent entries and restores fetch on stop', async () => {
    const original = vi.fn(async () => new Response('x'));
    vi.stubGlobal('fetch', original);
    start({ limit: 2 });
    for (const n of [1, 2, 3]) await fetch(`/n/${n}`);
    expect(capture!.entries().map((e) => e.url)).toEqual(['http://localhost:3000/n/2', 'http://localhost:3000/n/3']);
    capture!.stop();
    expect(window.fetch).toBe(original);
  });
});

describe('startNetworkCapture: XMLHttpRequest', () => {
  it('records XHR calls', () => {
    class FakeXHR extends EventTarget {
      status = 0;
      responseType = '';
      responseText = '';
      open(_method: string, _url: string) {}
      send(_body?: unknown) {
        this.status = 404;
        this.responseText = '{"error":"not found"}';
        this.dispatchEvent(new Event('loadend'));
      }
      getResponseHeader() {
        return 'application/json';
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    start({ bodies: true });
    const xhr = new FakeXHR();
    xhr.open('get', '/api/items/9');
    xhr.send();
    expect(capture!.entries()[0]).toMatchObject({
      type: 'xhr',
      method: 'GET',
      url: 'http://localhost:3000/api/items/9',
      status: 404,
      ok: false,
      responseBody: '{"error":"not found"}',
    });
  });
});
