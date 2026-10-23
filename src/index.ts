import { FeedbackWidget } from './widget';
import type { FeedbackOptions, FeedbackType, FeedbackUser } from './types';

export { FeedbackWidget, DEFAULT_LABELS } from './widget';
export { isPageAllowed, matchesRule, globToRegExp } from './pages';
export { toFormData } from './submit';
export type * from './types';

let instance: FeedbackWidget | null = null;

/**
 * Sets up the widget once for the whole app and returns it. Calling it again
 * (hot reloading, a remounted layout) reconfigures the same widget instead of
 * creating another, so a recording in progress keeps going.
 */
export function init(options: FeedbackOptions = {}): FeedbackWidget {
  if (instance && !instance.isDestroyed) {
    instance.configure(options);
    return instance;
  }
  instance = new FeedbackWidget(options);
  return instance;
}

/** The instance created by `init()`, if any. */
export function getInstance(): FeedbackWidget | null {
  return instance;
}

export function open(type?: FeedbackType): void {
  instance?.open(type);
}

export function close(): void {
  instance?.close();
}

export function identify(user: FeedbackUser | undefined): void {
  instance?.identify(user);
}

export function destroy(): void {
  instance?.destroy();
  instance = null;
}
