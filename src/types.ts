export type FeedbackType = 'bug' | 'feedback' | 'suggestion';

/**
 * A page rule. Strings are globs matched against the pathname
 * (`/dashboard/*`, `/docs/**`), or against the full URL when they start with a
 * protocol (`https://app.example.com/**`). RegExps are tested against both the
 * pathname and the full URL. Functions receive the current URL.
 */
export type PageRule = string | RegExp | ((url: URL) => boolean);

export interface PageRules {
  /** Show the widget only on pages matching one of these rules. Empty or omitted = every page. */
  include?: PageRule[];
  /** Never show the widget on pages matching one of these rules. Wins over `include`. */
  exclude?: PageRule[];
}

export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface FeedbackUser {
  id?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export interface FeedbackFeatures {
  /** Allow attaching an annotated screenshot. Default `true`. */
  screenshot?: boolean;
  /** Allow attaching a screen recording. Default `true`. */
  video?: boolean;
  /** Ask for an email when no `user.email` is known. Default `true`. */
  email?: boolean;
  /** Attach recent console output (all levels) and uncaught errors. Default `true`. */
  consoleLogs?: boolean;
  /** Attach recent API calls made with fetch or XMLHttpRequest. Default `true`. */
  networkLogs?: boolean;
  /** Attach the user's recent clicks and page changes, each with its route and page title. Default `true`. */
  breadcrumbs?: boolean;
  /** While recording, show a cursor halo and click ripples in the video. Default `true`. */
  cursorHighlight?: boolean;
  /** While recording, let the user draw on the page to point things out. Default `true`. */
  recordingDrawing?: boolean;
  /** While recording, log mouse movement, clicks, scrolling and navigation as `recordingEvents`. Default `true`. */
  interactionLog?: boolean;
}

export interface FeedbackLabels {
  launcher: string;
  title: string;
  bug: string;
  feedback: string;
  suggestion: string;
  placeholderBug: string;
  placeholderFeedback: string;
  placeholderSuggestion: string;
  email: string;
  screenshot: string;
  record: string;
  stopRecording: string;
  drawOnPage: string;
  clearDrawing: string;
  remove: string;
  submit: string;
  sending: string;
  success: string;
  error: string;
  close: string;
  annotateDraw: string;
  annotateBox: string;
  annotateHide: string;
  annotateUndo: string;
  annotateCancel: string;
  annotateDone: string;
}

export interface FeedbackContext {
  url: string;
  path: string;
  /** Query string parameters of the current route. */
  query: Record<string, string>;
  /** URL hash, e.g. `#/settings` for hash routers. */
  hash: string;
  title: string;
  referrer: string;
  userAgent: string;
  language: string;
  timezone: string;
  viewport: { width: number; height: number };
  screen: { width: number; height: number; pixelRatio: number };
  timestamp: string;
}

export interface ConsoleEntry {
  level: 'debug' | 'log' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

/** An API call made by the page with fetch or XMLHttpRequest. */
export interface NetworkEntry {
  type: 'fetch' | 'xhr';
  method: string;
  /** Absolute URL; sensitive query parameters (token, key, password…) are redacted. */
  url: string;
  /** HTTP status; absent or 0 when the request failed before a response. */
  status?: number;
  ok: boolean;
  /** Milliseconds from start to completion. */
  duration: number;
  /** When the request started (ISO 8601). */
  timestamp: string;
  /** Network failure or abort message. */
  error?: string;
  /** Only with `capture.networkBodies`. Sensitive JSON keys and form fields are redacted. */
  requestBody?: string;
  /** Only with `capture.networkBodies`, for text/JSON responses. */
  responseBody?: string;
}

export interface CaptureOptions {
  /** Console messages kept. Default 200. */
  consoleLimit?: number;
  /** API calls kept. Default 100. */
  networkLimit?: number;
  /** Also record request/response bodies of API calls. Default `false`. */
  networkBodies?: boolean;
  /** Clicks and page changes kept in `breadcrumbs`. Default 50. */
  breadcrumbLimit?: number;
  /** Maximum characters per recorded body. Default 2000. */
  maxBodyLength?: number;
  /** API calls to leave out (substring or RegExp of the URL), e.g. analytics. Your `endpoint` is always left out. */
  ignoreUrls?: (string | RegExp)[];
}

/**
 * Something the user did while recording. `t` is milliseconds since the
 * recording started, so events line up with the video timeline.
 * Coordinates are viewport pixels. Form field values are never recorded.
 */
export type RecordingEvent =
  | { type: 'pointer'; t: number; x: number; y: number }
  | { type: 'click'; t: number; x: number; y: number; target: string; text?: string; path: string; title: string }
  | { type: 'scroll'; t: number; x: number; y: number }
  | { type: 'input'; t: number; target: string }
  | { type: 'navigation'; t: number; url: string; title: string }
  | { type: 'annotation'; t: number; points: [number, number][] };

/**
 * A click or page change from anywhere in the session (not only while
 * recording), with the route and page it happened on.
 */
export type Breadcrumb = {
  timestamp: string;
  /** Full URL at the time. */
  url: string;
  /** Route: pathname + query + hash. */
  path: string;
  /** Page title at the time. */
  title: string;
} & (
  | { type: 'click'; target: string; text?: string }
  | { type: 'navigation'; /** Previous URL; absent for the first page. */ from?: string }
);

export interface FeedbackPayload {
  type: FeedbackType;
  message: string;
  email?: string;
  user?: FeedbackUser;
  metadata?: Record<string, unknown>;
  context: FeedbackContext;
  consoleLogs?: ConsoleEntry[];
  networkLogs?: NetworkEntry[];
  /** Recent clicks and page changes, oldest first. */
  breadcrumbs?: Breadcrumb[];
  /** PNG image, if the user attached a screenshot. */
  screenshot?: Blob;
  /** WebM/MP4 video, if the user attached a recording. */
  video?: Blob;
  /** Mouse path, clicks, scrolling, navigation and drawings made during the recording. */
  recordingEvents?: RecordingEvent[];
}

export interface FeedbackOptions {
  /**
   * URL to POST submissions to as `multipart/form-data` with fields
   * `payload` (JSON), `screenshot` (file) and `video` (file).
   */
  endpoint?: string;
  /** Extra headers for the `endpoint` request, e.g. an API key. */
  headers?: Record<string, string> | (() => Record<string, string>);
  /** Handle submissions yourself. Runs before the `endpoint` POST, if both are set. Throw to show an error. */
  onSubmit?: (payload: FeedbackPayload) => void | Promise<void>;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: unknown) => void;

  pages?: PageRules;
  /** Feedback types offered, in order. Default `['feedback', 'bug', 'suggestion']`. */
  types?: FeedbackType[];
  features?: FeedbackFeatures;
  /** Screenshot method. `dom` renders the page silently; `display` uses the browser's screen-capture prompt (pixel-perfect). Default `dom`, falling back to `display`. */
  screenshotMode?: 'dom' | 'display';
  /** How much console and network history to keep. Read once, when the widget starts. */
  capture?: CaptureOptions;
  /** Maximum recording length in seconds. Default 120. */
  maxRecordingSeconds?: number;

  user?: FeedbackUser;
  /** Arbitrary data attached to every submission (app version, tenant, feature flags…). */
  metadata?: Record<string, unknown> | (() => Record<string, unknown>);

  position?: WidgetPosition;
  /** Accent color. Default `#4f46e5`. */
  primaryColor?: string;
  theme?: 'light' | 'dark' | 'auto';
  zIndex?: number;
  /** Hide the floating button; open the widget yourself with `open()`. */
  hideLauncher?: boolean;
  labels?: Partial<FeedbackLabels>;
}
