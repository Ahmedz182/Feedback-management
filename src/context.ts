import type { ConsoleEntry, FeedbackContext } from './types';

export function collectContext(): FeedbackContext {
  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Intl unavailable; leave blank.
  }
  return {
    url: location.href,
    path: location.pathname,
    title: document.title,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    screen: { width: screen.width, height: screen.height, pixelRatio: window.devicePixelRatio || 1 },
    timestamp: new Date().toISOString(),
  };
}

const MAX_MESSAGE_LENGTH = 2000;
const LEVELS = ['log', 'info', 'warn', 'error'] as const;

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (_key, v: unknown) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      return v;
    }) ?? String(value);
  } catch {
    return String(value);
  }
}

export interface ConsoleCapture {
  entries(): ConsoleEntry[];
  stop(): void;
}

/** Records the last `limit` console messages and uncaught errors without altering console output. */
export function startConsoleCapture(limit = 50): ConsoleCapture {
  const buffer: ConsoleEntry[] = [];
  const push = (level: ConsoleEntry['level'], args: unknown[]) => {
    const message = args.map(stringify).join(' ');
    buffer.push({
      level,
      message: message.length > MAX_MESSAGE_LENGTH ? `${message.slice(0, MAX_MESSAGE_LENGTH)}…` : message,
      timestamp: new Date().toISOString(),
    });
    if (buffer.length > limit) buffer.shift();
  };

  const originals = LEVELS.map((level) => {
    const original = console[level];
    const wrapped = (...args: unknown[]) => {
      push(level, args);
      original.apply(console, args);
    };
    console[level] = wrapped;
    return { level, original, wrapped };
  });

  const onError = (event: ErrorEvent) => push('error', [event.error ?? event.message]);
  const onRejection = (event: PromiseRejectionEvent) => push('error', ['Unhandled rejection:', event.reason]);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return {
    entries: () => buffer.slice(),
    stop() {
      for (const { level, original, wrapped } of originals) {
        if (console[level] === wrapped) console[level] = original;
      }
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    },
  };
}
