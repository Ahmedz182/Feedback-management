import { describe, expect, it, vi } from 'vitest';
import { onRouteChange } from '../src/route-watcher';

describe('onRouteChange', () => {
  it('fires on pushState, replaceState and popstate', () => {
    const listener = vi.fn();
    const stop = onRouteChange(listener);
    history.pushState({}, '', '/one');
    history.replaceState({}, '', '/two');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
  });

  it('restores the original History methods after the last unsubscribe', () => {
    const original = history.pushState;
    const stopA = onRouteChange(() => {});
    const stopB = onRouteChange(() => {});
    expect(history.pushState).not.toBe(original);
    stopA();
    expect(history.pushState).not.toBe(original);
    stopB();
    expect(history.pushState).toBe(original);
  });
});
