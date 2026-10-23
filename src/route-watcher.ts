type Listener = () => void;

const listeners = new Set<Listener>();
let teardown: (() => void) | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

function install() {
  const { pushState, replaceState } = history;
  const patchedPush: History['pushState'] = function (this: History, ...args) {
    const result = pushState.apply(this, args);
    notify();
    return result;
  };
  const patchedReplace: History['replaceState'] = function (this: History, ...args) {
    const result = replaceState.apply(this, args);
    notify();
    return result;
  };
  history.pushState = patchedPush;
  history.replaceState = patchedReplace;
  window.addEventListener('popstate', notify);
  window.addEventListener('hashchange', notify);

  teardown = () => {
    // Only unpatch if nobody wrapped history after us, otherwise we would drop their patch.
    if (history.pushState === patchedPush) history.pushState = pushState;
    if (history.replaceState === patchedReplace) history.replaceState = replaceState;
    window.removeEventListener('popstate', notify);
    window.removeEventListener('hashchange', notify);
  };
}

/**
 * Calls `listener` whenever the URL changes, including client-side navigation
 * in SPA routers (React Router, Next.js, Vue Router…) that use the History API.
 * Returns an unsubscribe function.
 */
export function onRouteChange(listener: Listener): () => void {
  listeners.add(listener);
  if (!teardown) install();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && teardown) {
      teardown();
      teardown = null;
    }
  };
}
