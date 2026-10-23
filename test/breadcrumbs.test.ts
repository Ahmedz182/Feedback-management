import { afterEach, describe, expect, it } from 'vitest';
import { startBreadcrumbs, type BreadcrumbCapture } from '../src/capture/breadcrumbs';

let capture: BreadcrumbCapture | null = null;
afterEach(() => {
  capture?.stop();
  capture = null;
  document.body.innerHTML = '';
  document.title = '';
  history.replaceState({}, '', '/');
});

describe('startBreadcrumbs', () => {
  it('records clicks with the route and page they happened on', () => {
    history.replaceState({}, '', '/dashboard?range=7d');
    document.title = 'Dashboard';
    document.body.innerHTML = '<a href="#" class="nav-link">Reports</a>';
    capture = startBreadcrumbs();
    document.querySelector('a')!.click();
    expect(capture.entries()[1]).toMatchObject({
      type: 'click',
      target: 'a[href="#"]',
      text: 'Reports',
      path: '/dashboard?range=7d',
      url: 'http://localhost:3000/dashboard?range=7d',
      title: 'Dashboard',
    });
  });

  it('records page changes with the previous URL', () => {
    capture = startBreadcrumbs();
    document.title = 'Reports';
    history.pushState({}, '', '/reports#q3');
    const [first, second] = capture.entries();
    expect(first).toMatchObject({ type: 'navigation', path: '/' });
    expect(second).toMatchObject({ type: 'navigation', path: '/reports#q3', title: 'Reports', from: 'http://localhost:3000/' });
  });

  it('skips clicks inside the widget and caps the trail', () => {
    const host = document.createElement('div');
    host.innerHTML = '<button>Send</button>';
    document.body.append(host, Object.assign(document.createElement('button'), { textContent: 'Page' }));
    capture = startBreadcrumbs(3, () => host);
    host.querySelector('button')!.click();
    const pageButton = document.body.lastElementChild as HTMLButtonElement;
    for (let i = 0; i < 4; i++) pageButton.click();
    const entries = capture.entries();
    expect(entries).toHaveLength(3);
    expect(entries.every((e) => e.type === 'click' && e.text === 'Page')).toBe(true);
  });
});
