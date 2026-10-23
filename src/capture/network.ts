import type { NetworkEntry } from '../types';

export interface NetworkCaptureOptions {
  /** Keep the most recent N requests. */
  limit: number;
  /** Also record request and response bodies (text-like content only, truncated, secrets redacted). */
  bodies: boolean;
  /** Maximum characters kept per body. */
  maxBodyLength: number;
  /** Requests to leave out, matched against the absolute URL: substrings, RegExps or predicates. */
  ignore: (string | RegExp | ((url: string) => boolean))[];
}

export interface NetworkCapture {
  entries(): NetworkEntry[];
  stop(): void;
}

const SENSITIVE_KEY = /pass(word)?|secret|token|api[-_]?key|auth|session|cookie|signature|credential|^code$|otp|ssn|card/i;
const REDACTED = '[redacted]';
const TEXT_TYPE = /json|text|xml|x-www-form-urlencoded|graphql|javascript/i;

function absoluteUrl(url: string): string {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

/** Replaces the values of sensitive-looking query parameters, such as `?token=…`. */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let changed = false;
    parsed.searchParams.forEach((_value, key) => {
      if (SENSITIVE_KEY.test(key)) {
        parsed.searchParams.set(key, REDACTED);
        changed = true;
      }
    });
    return changed ? parsed.href : url;
  } catch {
    return url;
  }
}

function redactJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, SENSITIVE_KEY.test(key) ? REDACTED : redactJson(v)]),
    );
  }
  return value;
}

/** Redacts sensitive JSON keys and form fields, then truncates. */
export function sanitizeBody(body: string, maxLength: number): string {
  let result = body;
  try {
    result = JSON.stringify(redactJson(JSON.parse(body)));
  } catch {
    if (/^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(body)) {
      const params = new URLSearchParams(body);
      params.forEach((_value, key) => {
        if (SENSITIVE_KEY.test(key)) params.set(key, REDACTED);
      });
      result = params.toString();
    }
  }
  return result.length > maxLength ? `${result.slice(0, maxLength)}…` : result;
}

function requestBodyText(body: unknown): string | undefined {
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  if (body === undefined || body === null) return undefined;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return '[FormData]';
  if (typeof Blob !== 'undefined' && body instanceof Blob) return `[Blob ${body.size} bytes]`;
  return '[binary]';
}

/**
 * Records fetch and XMLHttpRequest calls (method, URL, status, duration,
 * errors, and optionally bodies) without changing how they behave.
 */
export function startNetworkCapture(options: NetworkCaptureOptions): NetworkCapture {
  const buffer: NetworkEntry[] = [];
  const ignored = (url: string) =>
    /^(data|blob):/.test(url) ||
    options.ignore.some((rule) =>
      typeof rule === 'string' ? url.includes(rule) : typeof rule === 'function' ? rule(url) : rule.test(url),
    );
  const push = (entry: NetworkEntry) => {
    buffer.push(entry);
    if (buffer.length > options.limit) buffer.shift();
  };
  const body = (text: string | undefined) =>
    options.bodies && text !== undefined ? sanitizeBody(text, options.maxBodyLength) : undefined;

  // ---- fetch
  const originalFetch = typeof window.fetch === 'function' ? window.fetch : null;
  const patchedFetch: typeof fetch = async function (input, init) {
    const request = input instanceof Request ? input : null;
    const url = absoluteUrl(request ? request.url : String(input));
    if (ignored(url)) return originalFetch!.call(window, input, init);

    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const started = performance.now();
    const entry: NetworkEntry = {
      type: 'fetch',
      method,
      url: redactUrl(url),
      ok: false,
      duration: 0,
      timestamp: new Date().toISOString(),
    };
    const requestBody = body(requestBodyText(init?.body));
    if (requestBody !== undefined) entry.requestBody = requestBody;

    try {
      const response = await originalFetch!.call(window, input, init);
      entry.status = response.status;
      entry.ok = response.ok;
      entry.duration = Math.round(performance.now() - started);
      push(entry);
      if (options.bodies && TEXT_TYPE.test(response.headers.get('content-type') ?? '')) {
        // Read a clone in the background so the caller's response stays untouched.
        response
          .clone()
          .text()
          .then((text) => (entry.responseBody = body(text)))
          .catch(() => {});
      }
      return response;
    } catch (error) {
      entry.duration = Math.round(performance.now() - started);
      entry.error = error instanceof Error ? error.message : String(error);
      push(entry);
      throw error;
    }
  };
  if (originalFetch) window.fetch = patchedFetch;

  // ---- XMLHttpRequest
  const XHR = typeof XMLHttpRequest !== 'undefined' ? XMLHttpRequest.prototype : null;
  const originalOpen = XHR?.open;
  const originalSend = XHR?.send;
  const pending = new WeakMap<XMLHttpRequest, { method: string; url: string }>();

  const patchedOpen = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    pending.set(this, { method: method.toUpperCase(), url: absoluteUrl(String(url)) });
    return (originalOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as XMLHttpRequest['open'];

  const patchedSend = function (this: XMLHttpRequest, sent?: Document | XMLHttpRequestBodyInit | null) {
    const info = pending.get(this);
    if (info && !ignored(info.url)) {
      const started = performance.now();
      const entry: NetworkEntry = {
        type: 'xhr',
        method: info.method,
        url: redactUrl(info.url),
        ok: false,
        duration: 0,
        timestamp: new Date().toISOString(),
      };
      const requestBody = body(requestBodyText(sent));
      if (requestBody !== undefined) entry.requestBody = requestBody;
      this.addEventListener('loadend', () => {
        entry.duration = Math.round(performance.now() - started);
        entry.status = this.status;
        entry.ok = this.status >= 200 && this.status < 400;
        if (this.status === 0) entry.error = 'Network error or request aborted';
        if (
          options.bodies &&
          (this.responseType === '' || this.responseType === 'text') &&
          TEXT_TYPE.test(this.getResponseHeader('content-type') ?? '')
        ) {
          entry.responseBody = body(this.responseText);
        }
        push(entry);
      });
    }
    return originalSend!.call(this, sent);
  };
  if (XHR) {
    XHR.open = patchedOpen;
    XHR.send = patchedSend;
  }

  return {
    entries: () => buffer.map((entry) => ({ ...entry })),
    stop() {
      // Only unpatch if nobody wrapped these after us, otherwise we would drop their patch.
      if (originalFetch && window.fetch === patchedFetch) window.fetch = originalFetch;
      if (XHR && XHR.open === patchedOpen) XHR.open = originalOpen!;
      if (XHR && XHR.send === patchedSend) XHR.send = originalSend!;
    },
  };
}
