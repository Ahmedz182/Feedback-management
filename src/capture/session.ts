import { onRouteChange } from '../route-watcher';
import type { RecordingEvent } from '../types';

const MOVE_INTERVAL_MS = 100;
const SCROLL_INTERVAL_MS = 250;
const MAX_TEXT_LENGTH = 60;
export const INTERACTIVE = 'a,button,[role="button"],[role="link"],[role="tab"],[role="menuitem"],label,summary,select';

/** A short, stable description of an element, such as `button#save.btn.primary`. */
export function describeElement(el: Element): string {
  let description = el.tagName.toLowerCase();
  if (el.id) return `${description}#${el.id}`;
  const testId = el.getAttribute('data-testid');
  if (testId) return `${description}[data-testid="${testId}"]`;
  const href = el.tagName === 'A' ? el.getAttribute('href') : null;
  if (href && !href.startsWith('javascript:')) return `${description}[href="${href.split('?')[0]}"]`;
  const classes = Array.from(el.classList).slice(0, 2);
  if (classes.length) description += `.${classes.join('.')}`;
  return description;
}

/** Visible label of an interactive element. Never reads form field values. */
export function labelOf(el: Element): string | undefined {
  const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text;
}

export interface SessionTracker {
  /** Adds an event, stamped with the time since tracking started. */
  add(event: DistributiveOmit<RecordingEvent, 't'>): void;
  events(): RecordingEvent[];
  stop(): void;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * Logs what the user does while recording (pointer path, clicks, scrolling,
 * form changes, navigation) with millisecond offsets, so reviewers can line
 * the log up with the video. Events from `ignore` (the widget itself) are skipped.
 */
export function startSessionTracking(ignore?: Element): SessionTracker {
  const start = performance.now();
  const log: RecordingEvent[] = [];
  const now = () => Math.round(performance.now() - start);
  const add: SessionTracker['add'] = (event) => log.push({ ...event, t: now() } as RecordingEvent);
  const isOwn = (event: Event) => !!ignore && event.composedPath().includes(ignore);

  let lastMove = -Infinity;
  let lastX = -1;
  let lastY = -1;
  const onPointerMove = (event: PointerEvent) => {
    const t = now();
    if (t - lastMove < MOVE_INTERVAL_MS) return;
    const x = Math.round(event.clientX);
    const y = Math.round(event.clientY);
    if (Math.abs(x - lastX) < 3 && Math.abs(y - lastY) < 3) return;
    lastMove = t;
    lastX = x;
    lastY = y;
    log.push({ type: 'pointer', t, x, y });
  };

  const onClick = (event: MouseEvent) => {
    if (isOwn(event) || !(event.target instanceof Element)) return;
    const target = event.target.closest(INTERACTIVE) ?? event.target;
    add({
      type: 'click',
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      target: describeElement(target),
      text: target.matches(INTERACTIVE) ? labelOf(target) : undefined,
      path: location.pathname + location.search + location.hash,
      title: document.title,
    });
  };

  const onChange = (event: Event) => {
    if (isOwn(event) || !(event.target instanceof Element)) return;
    add({ type: 'input', target: describeElement(event.target) });
  };

  let lastScroll = -Infinity;
  const onScroll = () => {
    const t = now();
    if (t - lastScroll < SCROLL_INTERVAL_MS) return;
    lastScroll = t;
    log.push({ type: 'scroll', t, x: Math.round(window.scrollX), y: Math.round(window.scrollY) });
  };

  const onVisibility = () => add({ type: 'visibility', state: document.visibilityState === 'hidden' ? 'hidden' : 'visible' });

  let lastUrl = location.href;
  const stopRouteWatch = onRouteChange(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    add({ type: 'navigation', url: lastUrl, title: document.title });
  });

  add({ type: 'navigation', url: lastUrl, title: document.title });
  document.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
  document.addEventListener('click', onClick, true);
  document.addEventListener('change', onChange, true);
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  return {
    add,
    events: () => log.slice(),
    stop() {
      stopRouteWatch();
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('change', onChange, true);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
