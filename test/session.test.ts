import { afterEach, describe, expect, it } from 'vitest';
import { describeElement, startSessionTracking, type SessionTracker } from '../src/capture/session';

let tracker: SessionTracker | null = null;
afterEach(() => {
  tracker?.stop();
  tracker = null;
  document.body.innerHTML = '';
  history.replaceState({}, '', '/');
});

describe('describeElement', () => {
  it('prefers id, then data-testid, then classes', () => {
    document.body.innerHTML = '<a id="home"></a><div data-testid="card" class="x"></div><span class="a b c"></span>';
    expect(describeElement(document.querySelector('a')!)).toBe('a#home');
    expect(describeElement(document.querySelector('div')!)).toBe('div[data-testid="card"]');
    expect(describeElement(document.querySelector('span')!)).toBe('span.a.b');
  });
});

describe('startSessionTracking', () => {
  it('logs clicks with the interactive element and its label', () => {
    document.body.innerHTML = '<button id="save"><span>Save   changes</span></button>';
    tracker = startSessionTracking();
    document.querySelector('span')!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 5, clientY: 6 }));
    expect(tracker.events()).toContainEqual(
      expect.objectContaining({ type: 'click', target: 'button#save', text: 'Save changes', x: 5, y: 6 }),
    );
  });

  it('logs navigation and form changes without values', () => {
    document.body.innerHTML = '<input id="email" value="secret@x.com">';
    tracker = startSessionTracking();
    history.pushState({}, '', '/next');
    document.querySelector('input')!.dispatchEvent(new Event('change', { bubbles: true }));
    const events = tracker.events();
    expect(events[0]).toMatchObject({ type: 'navigation', url: 'http://localhost:3000/' });
    expect(events).toContainEqual(expect.objectContaining({ type: 'navigation', url: 'http://localhost:3000/next' }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'input', target: 'input#email' }));
    expect(JSON.stringify(events)).not.toContain('secret');
  });

  it('ignores events from the widget itself', () => {
    const host = document.createElement('div');
    host.innerHTML = '<button>Stop</button>';
    document.body.append(host);
    tracker = startSessionTracking(host);
    host.querySelector('button')!.click();
    expect(tracker.events().some((e) => e.type === 'click')).toBe(false);
  });
});
