import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { destroy, getInstance, init } from './index';
import type { FeedbackWidget } from './widget';
import type { FeedbackOptions, FeedbackType, FeedbackUser } from './types';

export type * from './types';
export { FeedbackWidget } from './widget';

const FeedbackContext = createContext<FeedbackWidget | null>(null);

// Every provider shares the one global widget from `init()`.
let mountedProviders = 0;

export interface FeedbackProviderProps extends FeedbackOptions {
  children?: ReactNode;
}

/** A change key for options that ignores function identity, so inline callbacks don't cause re-renders. */
function optionsKey(options: FeedbackOptions): string {
  return JSON.stringify(options, (_key, value: unknown) => {
    if (typeof value === 'function') return '[fn]';
    if (value instanceof RegExp) return value.toString();
    return value;
  });
}

/** Routes callbacks through a ref so the widget always calls the latest props. */
function withLatestCallbacks(latest: { current: FeedbackOptions }): FeedbackOptions {
  const options = latest.current;
  return {
    ...options,
    onSubmit: options.onSubmit && ((payload) => latest.current.onSubmit?.(payload)),
    onOpen: options.onOpen && (() => latest.current.onOpen?.()),
    onClose: options.onClose && (() => latest.current.onClose?.()),
    onError: options.onError && ((error) => latest.current.onError?.(error)),
  };
}

/**
 * Mount once near the root of your app. Renders the floating feedback button
 * on every page matched by `pages`, and lets descendants call `useFeedback()`.
 *
 * The widget is global: a provider that remounts (route change, StrictMode)
 * keeps the same widget, and a recording in progress survives an unmount.
 */
export function FeedbackProvider({ children, ...options }: FeedbackProviderProps) {
  const [widget, setWidget] = useState<FeedbackWidget | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const key = optionsKey(options);

  useEffect(() => {
    mountedProviders += 1;
    const shared = init(withLatestCallbacks(latest));
    setWidget(shared);
    return () => {
      mountedProviders -= 1;
      setWidget(null);
      // Defer so a provider that mounts again straight away keeps the widget,
      // and let a recording in progress finish before tearing down.
      setTimeout(() => {
        void shared.whenIdle().then(() => {
          if (mountedProviders === 0 && getInstance() === shared) destroy();
        });
      });
    };
  }, []);

  const appliedKey = useRef(key);
  useEffect(() => {
    if (!widget || appliedKey.current === key) return;
    appliedKey.current = key;
    widget.configure(withLatestCallbacks(latest));
  }, [widget, key]);

  return <FeedbackContext.Provider value={widget}>{children}</FeedbackContext.Provider>;
}

export interface UseFeedback {
  open(type?: FeedbackType): void;
  close(): void;
  show(): void;
  hide(): void;
  identify(user: FeedbackUser | undefined): void;
  /** The underlying instance; `null` before mount and during SSR. */
  widget: FeedbackWidget | null;
}

/** Controls the widget from any component inside `<FeedbackProvider>`. */
export function useFeedback(): UseFeedback {
  const widget = useContext(FeedbackContext);
  return useMemo(
    () => ({
      open: (type?: FeedbackType) => widget?.open(type),
      close: () => widget?.close(),
      show: () => widget?.show(),
      hide: () => widget?.hide(),
      identify: (user: FeedbackUser | undefined) => widget?.identify(user),
      widget,
    }),
    [widget],
  );
}

/**
 * Hides the floating button while this component is mounted, e.g. on a
 * checkout page. An alternative to `pages.exclude` for component-level control.
 */
export function HideFeedback() {
  const widget = useContext(FeedbackContext);
  useEffect(() => {
    if (!widget) return;
    widget.hide();
    return () => widget.show();
  }, [widget]);
  return null;
}
