import { annotate } from './capture/annotate';
import { RecordingOverlay } from './capture/overlay';
import { startRecording, isRecordingSupported, type Recording } from './capture/recorder';
import { captureDisplay, captureDom, isDisplayCaptureSupported } from './capture/screenshot';
import { startBreadcrumbs, type BreadcrumbCapture } from './capture/breadcrumbs';
import { startNetworkCapture, type NetworkCapture } from './capture/network';
import { startSessionTracking } from './capture/session';
import { collectContext, startConsoleCapture, type ConsoleCapture } from './context';
import { isPageAllowed } from './pages';
import { onRouteChange } from './route-watcher';
import { postFeedback } from './submit';
import type {
  FeedbackLabels,
  FeedbackOptions,
  FeedbackPayload,
  FeedbackType,
  FeedbackUser,
  RecordingEvent,
} from './types';
import { h, icon, nextFrame } from './ui/dom';
import { icons } from './ui/icons';
import { styles } from './ui/styles';

export const DEFAULT_LABELS: FeedbackLabels = {
  launcher: 'Feedback',
  title: 'Send feedback',
  bug: 'Bug',
  feedback: 'Feedback',
  suggestion: 'Suggestion',
  placeholderBug: 'What went wrong? Steps to reproduce help a lot.',
  placeholderFeedback: 'What do you think? We read everything.',
  placeholderSuggestion: 'What would make this better for you?',
  email: 'Your email (optional)',
  screenshot: 'Screenshot',
  record: 'Record screen',
  stopRecording: 'Stop',
  drawOnPage: 'Draw on the page',
  clearDrawing: 'Clear drawings',
  remove: 'Remove',
  submit: 'Send',
  sending: 'Sending…',
  success: 'Thanks! Your feedback has been sent.',
  error: 'Something went wrong. Please try again.',
  close: 'Close',
  annotateDraw: 'Draw',
  annotateBox: 'Highlight area',
  annotateHide: 'Hide sensitive info',
  annotateUndo: 'Undo',
  annotateCancel: 'Cancel',
  annotateDone: 'Attach',
};

const ALL_TYPES: FeedbackType[] = ['feedback', 'bug', 'suggestion'];
const TYPE_ICONS: Record<FeedbackType, string> = {
  bug: icons.bug,
  feedback: icons.feedback,
  suggestion: icons.suggestion,
};

/** True when the user dismissed a browser permission / screen-share prompt. */
const isUserCancel = (error: unknown) =>
  error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError');

const formatSeconds = (total: number) =>
  `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;

interface Elements {
  launcher: HTMLButtonElement;
  panel: HTMLElement;
  form: HTMLFormElement;
  success: HTMLElement;
  typeButtons: Map<FeedbackType, HTMLButtonElement>;
  message: HTMLTextAreaElement;
  email: HTMLInputElement | null;
  screenshotButton: HTMLButtonElement | null;
  recordButton: HTMLButtonElement | null;
  previews: HTMLElement;
  error: HTMLElement;
  submit: HTMLButtonElement;
  recordingBar: HTMLElement;
  timer: HTMLElement;
  drawButton: HTMLButtonElement | null;
  clearButton: HTMLButtonElement | null;
}

export class FeedbackWidget {
  private options: FeedbackOptions;
  private labels: FeedbackLabels;
  private host: HTMLElement | null = null;
  private root: ShadowRoot | null = null;
  private els: Elements | null = null;

  private type: FeedbackType;
  private screenshot: Blob | null = null;
  private video: Blob | null = null;
  private recordingEvents: RecordingEvent[] | null = null;
  private overlay: RecordingOverlay | null = null;
  private objectUrls: string[] = [];
  private recording: Recording | null = null;
  private capturing = false;
  private submitting = false;
  private isOpen = false;
  private pageAllowed = true;
  private manuallyHidden = false;
  private renderPending = false;
  private destroyed = false;

  private stopRouteWatch: (() => void) | null = null;
  private consoleCapture: ConsoleCapture | null = null;
  private networkCapture: NetworkCapture | null = null;
  private breadcrumbs: BreadcrumbCapture | null = null;

  constructor(options: FeedbackOptions = {}) {
    this.options = options;
    this.labels = { ...DEFAULT_LABELS, ...options.labels };
    this.type = this.types()[0];

    // No DOM (server-side rendering): stay inert so callers don't have to guard.
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      this.destroyed = true;
      return;
    }

    this.host = document.createElement('div');
    this.host.setAttribute('data-feedback-widget', '');
    this.root = this.host.attachShadow({ mode: 'open' });
    document.body.append(this.host);

    this.applyHostStyles();
    this.render();
    this.syncLogCapture();
    this.stopRouteWatch = onRouteChange(() => this.syncPage());
    this.syncPage();
    document.addEventListener('keydown', this.onKeyDown);
  }

  // ---------------------------------------------------------------- public API

  /** Opens the panel, optionally preselecting a feedback type. Works on any page, regardless of `pages` rules. */
  open(type?: FeedbackType): void {
    if (this.destroyed || !this.els || this.recording || this.capturing) return;
    if (type && this.types().includes(type)) this.setType(type);
    if (!this.els.success.hidden) this.resetForm();
    this.isOpen = true;
    this.els.panel.hidden = false;
    this.updateLauncher();
    this.els.message.focus();
    this.options.onOpen?.();
  }

  close(): void {
    if (!this.els || !this.isOpen) return;
    this.isOpen = false;
    this.els.panel.hidden = true;
    this.updateLauncher();
    if (!this.els.launcher.hidden) this.els.launcher.focus();
    this.options.onClose?.();
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Shows the floating button again after `hide()`. */
  show(): void {
    this.manuallyHidden = false;
    this.updateLauncher();
  }

  /** Hides the floating button (and closes the panel) until `show()` is called. */
  hide(): void {
    this.manuallyHidden = true;
    this.close();
    this.updateLauncher();
  }

  /** Sets or clears the current user; their details are attached to every submission. */
  identify(user: FeedbackUser | undefined): void {
    this.update({ user });
  }

  /** Replaces the metadata attached to every submission. */
  setMetadata(metadata: FeedbackOptions['metadata']): void {
    this.options = { ...this.options, metadata };
  }

  /** Changes options after setup. Any message the user is typing is kept. */
  update(options: Partial<FeedbackOptions>): void {
    if (this.destroyed) return;
    this.options = { ...this.options, ...options };
    this.labels = { ...DEFAULT_LABELS, ...this.options.labels };
    if (!this.types().includes(this.type)) this.type = this.types()[0];
    this.applyHostStyles();
    this.syncLogCapture();
    if (this.recording || this.capturing) {
      this.renderPending = true;
    } else {
      this.render();
    }
    this.syncPage();
  }

  /** Removes the widget and undoes every global change it made. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.recording?.stop();
    this.overlay?.destroy();
    this.stopRouteWatch?.();
    this.consoleCapture?.stop();
    this.networkCapture?.stop();
    this.breadcrumbs?.stop();
    this.revokeObjectUrls();
    document.removeEventListener('keydown', this.onKeyDown);
    this.host?.remove();
    this.host = this.root = this.els = null;
  }

  get opened(): boolean {
    return this.isOpen;
  }

  // ------------------------------------------------------------------ helpers

  private types(): FeedbackType[] {
    const types = this.options.types?.filter((t) => ALL_TYPES.includes(t));
    return types && types.length > 0 ? types : ALL_TYPES;
  }

  private feature(name: keyof NonNullable<FeedbackOptions['features']>): boolean {
    return this.options.features?.[name] ?? true;
  }

  private applyHostStyles() {
    if (!this.host) return;
    const { zIndex = 2147483000, primaryColor, theme = 'light' } = this.options;
    // A zero-size fixed host gives every fixed child one shared stacking context.
    this.host.style.cssText = `position:fixed;top:0;left:0;width:0;height:0;z-index:${zIndex};`;
    if (primaryColor) this.host.style.setProperty('--fb-primary', primaryColor);
    this.host.setAttribute('data-theme', theme);
  }

  /** Starts or stops console, network and breadcrumb capture to match `features`. */
  private syncLogCapture() {
    const capture = this.options.capture ?? {};
    const wantConsole = this.feature('consoleLogs');
    if (wantConsole && !this.consoleCapture) this.consoleCapture = startConsoleCapture(capture.consoleLimit);
    if (!wantConsole && this.consoleCapture) {
      this.consoleCapture.stop();
      this.consoleCapture = null;
    }

    const wantNetwork = this.feature('networkLogs');
    if (wantNetwork && !this.networkCapture) {
      this.networkCapture = startNetworkCapture({
        limit: capture.networkLimit ?? 100,
        bodies: capture.networkBodies ?? false,
        maxBodyLength: capture.maxBodyLength ?? 2000,
        // The widget's own submissions are not part of the user's session.
        ignore: [...(capture.ignoreUrls ?? []), (url: string) => this.isOwnEndpoint(url)],
      });
    }
    if (!wantNetwork && this.networkCapture) {
      this.networkCapture.stop();
      this.networkCapture = null;
    }

    const wantBreadcrumbs = this.feature('breadcrumbs');
    if (wantBreadcrumbs && !this.breadcrumbs) {
      this.breadcrumbs = startBreadcrumbs(capture.breadcrumbLimit, () => this.host);
    }
    if (!wantBreadcrumbs && this.breadcrumbs) {
      this.breadcrumbs.stop();
      this.breadcrumbs = null;
    }
  }

  private isOwnEndpoint(url: string): boolean {
    const { endpoint } = this.options;
    if (!endpoint) return false;
    try {
      return new URL(endpoint, location.href).href === url.split('?')[0];
    } catch {
      return false;
    }
  }

  private syncPage() {
    if (this.destroyed) return;
    let url: URL;
    try {
      url = new URL(location.href);
    } catch {
      return;
    }
    this.pageAllowed = isPageAllowed(this.options.pages, url);
    if (!this.pageAllowed && this.isOpen) this.close();
    this.updateLauncher();
  }

  private updateLauncher() {
    if (!this.els) return;
    this.els.launcher.hidden =
      !!this.options.hideLauncher ||
      !this.pageAllowed ||
      this.manuallyHidden ||
      this.isOpen ||
      !!this.recording ||
      this.capturing;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (this.overlay?.isDrawing) this.toggleDrawing();
    else if (this.isOpen && !this.capturing) this.close();
  };

  private setType(type: FeedbackType) {
    this.type = type;
    if (!this.els) return;
    this.els.typeButtons.forEach((button, t) => button.setAttribute('aria-checked', String(t === type)));
    this.els.message.placeholder = this.placeholder();
  }

  private placeholder(): string {
    const { placeholderBug, placeholderFeedback, placeholderSuggestion } = this.labels;
    return { bug: placeholderBug, feedback: placeholderFeedback, suggestion: placeholderSuggestion }[this.type];
  }

  private showError(message: string | null) {
    if (!this.els) return;
    this.els.error.textContent = message ?? '';
    this.els.error.hidden = !message;
  }

  private handleError(error: unknown) {
    if (isUserCancel(error)) return;
    this.showError(this.labels.error);
    this.options.onError?.(error);
  }

  private clearVideo() {
    this.video = null;
    this.recordingEvents = null;
  }

  private revokeObjectUrls() {
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrls = [];
  }

  private resetForm() {
    if (!this.els) return;
    this.els.message.value = '';
    this.screenshot = null;
    this.clearVideo();
    this.renderPreviews();
    this.showError(null);
    this.els.form.hidden = false;
    this.els.success.hidden = true;
    this.updateSubmit();
  }

  private updateSubmit() {
    if (!this.els) return;
    const empty = this.els.message.value.trim().length === 0;
    this.els.submit.disabled = empty || this.submitting;
    this.els.submit.textContent = this.submitting ? this.labels.sending : this.labels.submit;
    if (this.els.screenshotButton) this.els.screenshotButton.disabled = this.submitting;
    if (this.els.recordButton) this.els.recordButton.disabled = this.submitting;
  }

  // ---------------------------------------------------------------- rendering

  private render() {
    if (!this.root) return;
    this.renderPending = false;

    // Keep whatever the user has typed across re-renders.
    const draft = this.els ? { message: this.els.message.value, email: this.els.email?.value ?? '' } : null;
    const position = this.options.position ?? 'bottom-right';
    const l = this.labels;

    const launcher = h(
      'button',
      { type: 'button', class: `fb-launcher ${position}`, 'aria-haspopup': 'dialog', onclick: () => this.open() },
      icon(icons.chat),
      l.launcher,
    );

    const typeButtons = new Map<FeedbackType, HTMLButtonElement>();
    const types = this.types();
    const typeRow =
      types.length > 1
        ? h(
            'div',
            { class: 'fb-types', role: 'radiogroup', 'aria-label': l.title },
            ...types.map((type) => {
              const button = h(
                'button',
                {
                  type: 'button',
                  class: 'fb-type',
                  role: 'radio',
                  'aria-checked': String(type === this.type),
                  onclick: () => this.setType(type),
                },
                icon(TYPE_ICONS[type]),
                l[type],
              );
              typeButtons.set(type, button);
              return button;
            }),
          )
        : null;

    const message = h('textarea', {
      class: 'fb-input',
      name: 'message',
      'aria-label': l.title,
      placeholder: this.placeholder(),
      required: true,
      oninput: () => this.updateSubmit(),
      onkeydown: (event: Event) => {
        const e = event as KeyboardEvent;
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          form.requestSubmit();
        }
      },
    });
    message.value = draft?.message ?? '';

    const email =
      this.feature('email') && !this.options.user?.email
        ? h('input', { class: 'fb-input', type: 'email', name: 'email', placeholder: l.email, 'aria-label': l.email, autocomplete: 'email' })
        : null;
    if (email) email.value = draft?.email ?? '';

    const screenshotButton = this.feature('screenshot')
      ? h('button', { type: 'button', class: 'fb-btn', onclick: () => this.takeScreenshot() }, icon(icons.camera), l.screenshot)
      : null;
    const recordButton =
      this.feature('video') && isRecordingSupported()
        ? h('button', { type: 'button', class: 'fb-btn', onclick: () => this.record() }, icon(icons.video), l.record)
        : null;

    const previews = h('div', { class: 'fb-previews' });
    const error = h('p', { class: 'fb-error', role: 'alert', hidden: true });
    const submit = h('button', { type: 'submit', class: 'fb-btn fb-btn-primary fb-submit' }, l.submit);

    const form = h(
      'form',
      {
        class: 'fb-body',
        novalidate: true,
        onsubmit: (event: Event) => {
          event.preventDefault();
          void this.submit();
        },
      },
      typeRow,
      message,
      email,
      screenshotButton || recordButton ? h('div', { class: 'fb-actions' }, screenshotButton, recordButton) : null,
      previews,
      error,
      submit,
    );

    const success = h(
      'div',
      { class: 'fb-success', hidden: true, role: 'status' },
      h('span', { class: 'fb-success-badge' }, icon(icons.check)),
      h('p', {}, l.success),
      h('button', { type: 'button', class: 'fb-btn', onclick: () => this.close() }, l.close),
    );

    const panel = h(
      'div',
      { class: `fb-panel ${position}`, role: 'dialog', 'aria-label': l.title, hidden: !this.isOpen },
      h(
        'div',
        { class: 'fb-header' },
        h('h2', {}, l.title),
        h('button', { type: 'button', class: 'fb-close', 'aria-label': l.close, onclick: () => this.close() }, icon(icons.close)),
      ),
      form,
      success,
    );

    const timer = h('span', { class: 'fb-timer' }, '0:00');
    const drawButton = this.feature('recordingDrawing')
      ? h(
          'button',
          { type: 'button', class: 'fb-tool', title: l.drawOnPage, 'aria-label': l.drawOnPage, 'aria-pressed': 'false', onclick: () => this.toggleDrawing() },
          icon(icons.pen),
        )
      : null;
    const clearButton = drawButton
      ? h(
          'button',
          { type: 'button', class: 'fb-tool', title: l.clearDrawing, 'aria-label': l.clearDrawing, onclick: () => this.overlay?.clear() },
          icon(icons.eraser),
        )
      : null;
    const recordingBar = h(
      'div',
      { class: 'fb-recording', hidden: true, role: 'toolbar', 'aria-label': l.record },
      h('span', { class: 'fb-dot' }),
      timer,
      drawButton,
      clearButton,
      h('button', { type: 'button', class: 'fb-btn fb-stop', onclick: () => this.recording?.stop() }, l.stopRecording),
    );

    const style = h('style', {}, styles);
    this.root.replaceChildren(style, launcher, panel, recordingBar);
    this.els = {
      launcher,
      panel,
      form,
      success,
      typeButtons,
      message,
      email,
      screenshotButton,
      recordButton,
      previews,
      error,
      submit,
      recordingBar,
      timer,
      drawButton,
      clearButton,
    };
    this.renderPreviews();
    this.updateSubmit();
    this.updateLauncher();
  }

  private renderPreviews() {
    if (!this.els) return;
    this.revokeObjectUrls();
    const items: HTMLElement[] = [];
    const removeButton = (onRemove: () => void) =>
      h(
        'button',
        { type: 'button', class: 'fb-preview-remove', 'aria-label': this.labels.remove, title: this.labels.remove, onclick: onRemove },
        icon(icons.close),
      );

    if (this.screenshot) {
      const url = URL.createObjectURL(this.screenshot);
      this.objectUrls.push(url);
      items.push(
        h(
          'div',
          { class: 'fb-preview' },
          h('img', { src: url, alt: this.labels.screenshot }),
          removeButton(() => {
            this.screenshot = null;
            this.renderPreviews();
          }),
        ),
      );
    }
    if (this.video) {
      const url = URL.createObjectURL(this.video);
      this.objectUrls.push(url);
      items.push(
        h(
          'div',
          { class: 'fb-preview' },
          h('video', { src: url, muted: true, playsinline: true, preload: 'metadata', 'aria-label': this.labels.record }),
          removeButton(() => {
            this.clearVideo();
            this.renderPreviews();
          }),
        ),
      );
    }
    this.els.previews.replaceChildren(...items);
    this.els.previews.hidden = items.length === 0;
  }

  // ------------------------------------------------------------------ capture

  private async takeScreenshot() {
    if (!this.els || !this.root || this.capturing) return;
    this.capturing = true;
    this.showError(null);
    this.els.panel.hidden = true;
    this.updateLauncher();
    try {
      await nextFrame();
      await nextFrame();
      let image: Blob;
      if (this.options.screenshotMode === 'display') {
        image = await captureDisplay();
      } else {
        try {
          image = await captureDom(this.host ?? undefined);
        } catch (domError) {
          if (!isDisplayCaptureSupported()) throw domError;
          image = await captureDisplay();
        }
      }
      if (this.destroyed) return;
      const annotated = await annotate(this.root, image, this.labels);
      if (annotated) this.screenshot = annotated;
    } catch (error) {
      this.handleError(error);
    } finally {
      this.finishCapture();
    }
  }

  private async record() {
    if (!this.els || this.recording || this.capturing) return;
    this.capturing = true;
    this.showError(null);
    this.els.panel.hidden = true;
    this.updateLauncher();
    try {
      const els = this.els;
      els.timer.textContent = formatSeconds(0);
      this.recording = await startRecording({
        maxSeconds: this.options.maxRecordingSeconds ?? 120,
        onTick: (seconds) => (els.timer.textContent = formatSeconds(seconds)),
      });
      const tracker = this.feature('interactionLog') ? startSessionTracking(this.host ?? undefined) : null;
      if (this.root && (this.feature('cursorHighlight') || this.feature('recordingDrawing'))) {
        this.overlay = new RecordingOverlay(this.root, {
          cursor: this.feature('cursorHighlight'),
          onStroke: (points) => tracker?.add({ type: 'annotation', points }),
        });
      }
      els.recordingBar.hidden = false;
      try {
        const video = await this.recording.result;
        if (video.size > 0) {
          this.video = video;
          this.recordingEvents = tracker ? tracker.events() : null;
        }
      } finally {
        tracker?.stop();
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.recording = null;
      this.overlay?.destroy();
      this.overlay = null;
      this.els?.drawButton?.setAttribute('aria-pressed', 'false');
      this.finishCapture();
    }
  }

  private toggleDrawing() {
    if (!this.overlay) return;
    const on = !this.overlay.isDrawing;
    this.overlay.setDrawing(on);
    this.els?.drawButton?.setAttribute('aria-pressed', String(on));
  }

  private finishCapture() {
    this.capturing = false;
    if (this.destroyed || !this.els) return;
    if (this.renderPending) this.render();
    this.els.recordingBar.hidden = true;
    this.renderPreviews();
    if (this.isOpen) this.els.panel.hidden = false;
    this.updateLauncher();
  }

  // ------------------------------------------------------------------- submit

  private buildPayload(): FeedbackPayload {
    const { user, metadata } = this.options;
    const email = this.els?.email?.value.trim() || user?.email || undefined;
    const payload: FeedbackPayload = {
      type: this.type,
      message: this.els?.message.value.trim() ?? '',
      context: collectContext(),
    };
    if (email) payload.email = email;
    if (user) payload.user = user;
    const resolvedMetadata = typeof metadata === 'function' ? metadata() : metadata;
    if (resolvedMetadata) payload.metadata = resolvedMetadata;
    if (this.consoleCapture) payload.consoleLogs = this.consoleCapture.entries();
    if (this.networkCapture) payload.networkLogs = this.networkCapture.entries();
    if (this.breadcrumbs) payload.breadcrumbs = this.breadcrumbs.entries();
    if (this.screenshot) payload.screenshot = this.screenshot;
    if (this.video) payload.video = this.video;
    if (this.video && this.recordingEvents) payload.recordingEvents = this.recordingEvents;
    return payload;
  }

  private async submit() {
    if (!this.els || this.submitting || this.els.message.value.trim().length === 0) return;
    const { onSubmit, endpoint, headers } = this.options;
    if (!onSubmit && !endpoint) {
      console.warn('[feedback-management] Set `endpoint` or `onSubmit` to receive submissions.');
    }

    this.submitting = true;
    this.showError(null);
    this.updateSubmit();
    try {
      const payload = this.buildPayload();
      await onSubmit?.(payload);
      if (endpoint) {
        await postFeedback(endpoint, payload, typeof headers === 'function' ? headers() : headers);
      }
      if (this.destroyed) return;
      this.els.form.hidden = true;
      this.els.success.hidden = false;
      this.els.message.value = '';
      this.screenshot = null;
      this.clearVideo();
      this.renderPreviews();
    } catch (error) {
      this.showError(this.labels.error);
      this.options.onError?.(error);
    } finally {
      this.submitting = false;
      this.updateSubmit();
    }
  }
}
