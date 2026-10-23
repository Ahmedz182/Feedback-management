import { onRouteChange } from '../route-watcher';
import type { Breadcrumb } from '../types';
import { describeElement, INTERACTIVE, labelOf } from './session';

type BreadcrumbInput = { type: 'click'; target: string; text?: string } | { type: 'navigation'; from?: string };

export interface BreadcrumbCapture {
  entries(): Breadcrumb[];
  stop(): void;
}

/** Where the user currently is: path, full URL and page title. */
export function currentPage(): Pick<Breadcrumb, 'url' | 'path' | 'title'> {
  return { url: location.href, path: location.pathname + location.search + location.hash, title: document.title };
}

/**
 * Keeps a trail of the user's last `limit` clicks and page changes for the
 * whole session, each with the route and page it happened on. Clicks inside
 * `ignore` (the widget itself) are skipped.
 */
export function startBreadcrumbs(limit = 50, ignore?: () => Element | null): BreadcrumbCapture {
  const trail: Breadcrumb[] = [];
  const push = (crumb: BreadcrumbInput) => {
    trail.push({ ...crumb, ...currentPage(), timestamp: new Date().toISOString() });
    if (trail.length > limit) trail.shift();
  };

  const onClick = (event: MouseEvent) => {
    const own = ignore?.();
    if ((own && event.composedPath().includes(own)) || !(event.target instanceof Element)) return;
    const target = event.target.closest(INTERACTIVE) ?? event.target;
    push({
      type: 'click',
      target: describeElement(target),
      text: target.matches(INTERACTIVE) ? labelOf(target) : undefined,
    });
  };

  let lastUrl = location.href;
  const stopRouteWatch = onRouteChange(() => {
    if (location.href === lastUrl) return;
    const from = lastUrl;
    lastUrl = location.href;
    push({ type: 'navigation', from });
  });

  push({ type: 'navigation' });
  document.addEventListener('click', onClick, true);

  return {
    entries: () => trail.slice(),
    stop() {
      stopRouteWatch();
      document.removeEventListener('click', onClick, true);
    },
  };
}
