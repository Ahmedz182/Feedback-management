export type FeedbackType = 'bug' | 'feedback' | 'suggestion';

/** How bad a bug is, or how much a suggestion matters. */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type Sentiment = 'happy' | 'neutral' | 'frustrated';

/** A part of your app users can pick in "Where in the app?". */
export interface FeedbackArea {
  label: string;
  /** Pages that belong to this area; used to preselect it from the current route. */
  match?: PageRule | PageRule[];
}

/** Which form fields to show. Everything except `component` is on by default. */
export interface FeedbackFields {
  /** Short title with a character counter. Default `true`. */
  title?: boolean;
  /** Severity (bugs) / priority (suggestions) chips, for these types. Default `['bug', 'suggestion']`; `false` hides it. */
  severity?: boolean | FeedbackType[];
  /** "Where in the app?" select. Shown when `areas` is set. Default `true`. */
  area?: boolean;
  /** Free-text "Component" next to the area. Default `false`. */
  component?: boolean;
  /** "Expected behavior" / "Actual behavior" for bugs. Default `true`. */
  expectedActual?: boolean;
  /** "Before submitting" checklist for bugs. `true` uses a built-in list; pass your own items, or `false`. Default `true`. */
  checklist?: boolean | string[];
  /** Tags the user can pick any of (e.g. product areas), shown as chips. Default none. */
  tags?: string[];
  /** "How are you feeling about this?" Default `true`. */
  sentiment?: boolean;
  /** "Submit anonymously" toggle, shown when a user is known. Default `true`. */
  anonymous?: boolean;
  /** Drop, paste or browse for image and video files. Default `true`. */
  attachments?: boolean;
  /** "What we're sending" disclosure, where users can leave out logs. Default `true`. */
  summary?: boolean;
}

/** Visual tokens. Every value is any CSS value, e.g. `'#0f172a'`, `'12px'`, `'var(--brand)'`. */
export interface FeedbackColors {
  primary?: string;
  primaryText?: string;
  background?: string;
  surface?: string;
  text?: string;
  muted?: string;
  border?: string;
  danger?: string;
  /** Accent per feedback type (tab underline, panel edge). */
  bug?: string;
  feedback?: string;
  suggestion?: string;
}

export interface FeedbackAppearance extends FeedbackColors {
  /** Overrides used in dark mode (`theme: 'dark'`, or `'auto'` on a dark OS). */
  dark?: FeedbackColors;
  /** Font family, or `'inherit'` to use your page's body font. */
  font?: string;
  /** Base font size, e.g. `'14px'`. */
  fontSize?: string;
  /** Corner radius of inputs, chips and buttons, e.g. `'8px'` or `'0'`. The panel uses a larger multiple. */
  radius?: string;
  shadow?: string;
  /** Panel width on larger screens, e.g. `'440px'`. */
  panelWidth?: string;
  /** Launcher look: a labelled pill, an icon-only circle, or a vertical tab on the side edge. Default `'pill'`. */
  launcher?: 'pill' | 'circle' | 'tab';
}

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
  eyebrow: string;
  bugHint: string;
  feedbackHint: string;
  suggestionHint: string;
  titleField: string;
  titlePlaceholder: string;
  required: string;
  messageBug: string;
  messageFeedback: string;
  messageSuggestion: string;
  messageHint: string;
  area: string;
  areaOther: string;
  component: string;
  componentPlaceholder: string;
  expected: string;
  expectedPlaceholder: string;
  actual: string;
  actualPlaceholder: string;
  checklist: string;
  checklistItems: string[];
  severity: string;
  severityHint: string;
  priority: string;
  priorityHint: string;
  critical: string;
  criticalHint: string;
  high: string;
  medium: string;
  low: string;
  lowHint: string;
  priorityCriticalHint: string;
  priorityLowHint: string;
  tags: string;
  tagsHint: string;
  sentiment: string;
  optional: string;
  happy: string;
  neutral: string;
  frustrated: string;
  attachments: string;
  attachmentsHint: string;
  dropTitle: string;
  dropHint: string;
  browse: string;
  edit: string;
  fileTooLarge: string;
  anonymous: string;
  postedAs: string;
  summary: string;
  summaryPage: string;
  summaryConsole: string;
  summaryNetwork: string;
  summaryActions: string;
  cancel: string;
  submitBug: string;
  submitFeedback: string;
  submitSuggestion: string;
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
  | { type: 'annotation'; t: number; points: [number, number][] }
  /** The user left the page's tab (`hidden`) or came back (`visible`). Recording continues either way. */
  | { type: 'visibility'; t: number; state: 'hidden' | 'visible' };

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
  /** Short title; falls back to the first line of `message` when the user leaves it empty. */
  title?: string;
  message: string;
  severity?: Severity;
  /** Label of the chosen "Where in the app?" area. */
  area?: string;
  component?: string;
  expected?: string;
  actual?: string;
  checklist?: { label: string; checked: boolean }[];
  tags?: string[];
  sentiment?: Sentiment;
  /** The user chose to submit anonymously: `user` and `email` are left out. */
  anonymous?: boolean;
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
  /** Image or video files the user dropped, pasted or picked. */
  attachments?: File[];
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
  /**
   * What the screen-share picker suggests for recordings. `window` (default)
   * keeps recording what the user sees when they switch tabs; `screen` also
   * follows them into other apps; `tab` records only this page. The user can
   * always pick something else in the browser's picker.
   */
  recordingSurface?: 'tab' | 'window' | 'screen';
  /** Maximum recording length in seconds. Default 120. */
  maxRecordingSeconds?: number;

  user?: FeedbackUser;
  /** Arbitrary data attached to every submission (app version, tenant, feature flags…). */
  metadata?: Record<string, unknown> | (() => Record<string, unknown>);

  /** Which form fields to show. */
  fields?: FeedbackFields;
  /** Parts of your app for "Where in the app?"; preselected from the current route when `match` is given. */
  areas?: (string | FeedbackArea)[];
  /** Total size limit for dropped/pasted files in MB. Default 25. */
  maxAttachmentMB?: number;

  position?: WidgetPosition;
  /** Accent color; shorthand for `appearance.primary`. Default `#4f46e5`. */
  primaryColor?: string;
  theme?: 'light' | 'dark' | 'auto';
  /** Colors, fonts, radius and launcher shape, so the widget matches your site. */
  appearance?: FeedbackAppearance;
  /** Extra CSS injected inside the widget's shadow root, after its own styles. */
  customCss?: string;
  zIndex?: number;
  /** Hide the floating button; open the widget yourself with `open()`. */
  hideLauncher?: boolean;
  labels?: Partial<FeedbackLabels>;
}
