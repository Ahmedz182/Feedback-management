import { annotate } from './capture/annotate';
import { startBreadcrumbs, type BreadcrumbCapture } from './capture/breadcrumbs';
import { startNetworkCapture, type NetworkCapture } from './capture/network';
import { RecordingOverlay } from './capture/overlay';
import { startRecording, isRecordingSupported, type Recording } from './capture/recorder';
import { captureDisplay, captureDom, isDisplayCaptureSupported } from './capture/screenshot';
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
import { ReportForm, type FormValues } from './ui/form';
import { icons } from './ui/icons';
import { DEFAULT_LABELS } from './ui/labels';
import { styles } from './ui/styles';
import { themeCss } from './ui/theme';

export { DEFAULT_LABELS };

const ALL_TYPES: FeedbackType[] = ['feedback', 'bug', 'suggestion'];

/** True when the user dismissed a browser permission / screen-share prompt. */
const isUserCancel = (error: unknown) =>
  error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError');

const formatSeconds = (total: number) =>
  `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;

interface Elements {
  launcher: HTMLButtonElement;
  panel: HTMLElement;
  form: ReportForm;
  success: HTMLElement;
  recordingBar: HTMLElement;
  timer: HTMLElement;
  drawButton: HTMLButtonElement | null;
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
  private files: File[] = [];
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
  private idleWaiters: (() => void)[] = [];

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
    if (!this.els.success.hidden) this.resetForm();
    if (type && this.types().includes(type)) this.setType(type);
    this.isOpen = true;
    this.els.panel.hidden = false;
    this.els.form.syncArea(new URL(location.href));
    this.refreshSummary();
    this.updateLauncher();
    this.els.form.focus();
    this.els.form.syncScrollShadows();
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

  /** Hides the floating button (and closes the panel) until `show()` is called. A recording in progress keeps going. */
  hide(): void {
    this.manuallyHidden = true;
    if (!this.busy) this.close();
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

  /** Changes some options after setup. Any message the user is typing, and any recording in progress, is kept. */
  update(options: Partial<FeedbackOptions>): void {
    this.configure({ ...this.options, ...options });
  }

  /** Replaces all options. Any message the user is typing, and any recording in progress, is kept. */
  configure(options: FeedbackOptions): void {
    if (this.destroyed) return;
    this.options = options;
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
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    this.host?.remove();
    this.host = this.root = this.els = null;
    this.idleWaiters.splice(0).forEach((resolve) => resolve());
  }

  get opened(): boolean {
    return this.isOpen;
  }

  /** True after `destroy()`, or when created without a DOM (server-side rendering). */
  get isDestroyed(): boolean {
    return this.destroyed;
  }

  /** True while a screen recording is running. */
  get isRecording(): boolean {
    return !!this.recording;
  }

  /** Resolves once no recording or screenshot is in progress. */
  whenIdle(): Promise<void> {
    if (!this.busy) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private get busy(): boolean {
    return this.capturing || !!this.recording;
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
    const { zIndex = 2147483000, theme = 'light' } = this.options;
    // A zero-size fixed host gives every fixed child one shared stacking context.
    this.host.style.cssText = `position:fixed;top:0;left:0;width:0;height:0;z-index:${zIndex};`;
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
    // A recording or screenshot in progress follows the user across routes; it is never cut short here.
    if (!this.pageAllowed && this.isOpen && !this.busy) this.close();
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
    this.els.form.setType(type);
    this.els.panel.setAttribute('data-type', type);
  }

  private refreshSummary() {
    if (!this.els) return;
    const logs = this.consoleCapture?.entries() ?? [];
    const calls = this.networkCapture?.entries() ?? [];
    this.els.form.updateSummary({
      console: logs.length,
      errors: logs.filter((entry) => entry.level === 'error').length,
      network: calls.length,
      failed: calls.filter((entry) => !entry.ok).length,
      actions: this.breadcrumbs?.entries().length ?? 0,
    });
  }

  private showError(message: string | null) {
    this.els?.form.showError(message);
  }

  private handleError(error: unknown) {
    if (isUserCancel(error)) return;
    this.showError(this.labels.error);
    this.options.onError?.(error);
  }

  private clearAttachments() {
    this.screenshot = null;
    this.video = null;
    this.recordingEvents = null;
    this.files = [];
  }

  private revokeObjectUrls() {
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrls = [];
  }

  private resetForm() {
    this.clearAttachments();
    this.render(null);
  }

  private updateSubmit() {
    this.els?.form.setSubmitting(this.submitting);
  }

  // ---------------------------------------------------------------- rendering

  /** Builds the widget's DOM. `draft` restores what the user typed; it defaults to the current form's values. */
  private render(draft: FormValues | null = this.els?.form.draft() ?? null) {
    if (!this.root) return;
    this.renderPending = false;

    const position = this.options.position ?? 'bottom-right';
    const shape = this.options.appearance?.launcher ?? 'pill';
    const l = this.labels;

    const launcher = h(
      'button',
      {
        type: 'button',
        class: `fb-launcher fb-launcher-${shape} ${position}`,
        part: 'launcher',
        'aria-haspopup': 'dialog',
        'aria-label': l.launcher,
        onclick: () => this.open(),
      },
      icon(icons.chat),
      shape === 'circle' ? null : h('span', {}, l.launcher),
    );

    const form = new ReportForm({
      options: this.options,
      labels: l,
      types: this.types(),
      type: this.type,
      canRecord: isRecordingSupported(),
      draft,
      handlers: {
        onInput: () => this.updateSubmit(),
        onSubmit: () => void this.submit(),
        onCancel: () => this.close(),
        onTypeChange: (type) => this.setType(type),
        onScreenshot: () => void this.takeScreenshot(),
        onRecord: () => void this.record(),
        onFiles: (files) => this.addFiles(files),
      },
    });

    const success = h(
      'div',
      { class: 'fb-success', hidden: true, role: 'status' },
      h('span', { class: 'fb-success-badge' }, icon(icons.check)),
      h('p', {}, l.success),
      h('button', { type: 'button', class: 'fb-btn', onclick: () => this.close() }, l.close),
    );

    const panel = h(
      'div',
      {
        class: `fb-panel ${position}`,
        part: 'panel',
        role: 'dialog',
        'aria-label': l.title,
        'data-type': this.type,
        hidden: !this.isOpen,
      },
      h(
        'div',
        { class: 'fb-header', part: 'header' },
        h('div', {}, h('div', { class: 'fb-eyebrow' }, l.eyebrow), h('h2', {}, l.title)),
        h('kbd', { class: 'fb-kbd fb-esc' }, 'Esc'),
        h('button', { type: 'button', class: 'fb-close', 'aria-label': l.close, onclick: () => this.close() }, icon(icons.close)),
      ),
      form.tabs,
      form.form,
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
      { class: 'fb-recording', part: 'recording-bar', hidden: true, role: 'toolbar', 'aria-label': l.record },
      h('span', { class: 'fb-dot' }),
      timer,
      drawButton,
      clearButton,
      h('button', { type: 'button', class: 'fb-btn fb-stop', onclick: () => this.recording?.stop() }, l.stopRecording),
    );

    const css = styles + themeCss(this.options.appearance, this.options.primaryColor) + (this.options.customCss ?? '');
    this.root.replaceChildren(h('style', {}, css), launcher, panel, recordingBar);
    this.els = { launcher, panel, form, success, recordingBar, timer, drawButton };
    this.renderPreviews();
    this.updateSubmit();
    this.updateLauncher();
  }

  private renderPreviews() {
    if (!this.els) return;
    this.revokeObjectUrls();
    const l = this.labels;
    const items: HTMLElement[] = [];
    const preview = (media: HTMLElement, onRemove: () => void, onEdit?: () => void) =>
      h(
        'div',
        { class: 'fb-preview' },
        media,
        h('button', { type: 'button', class: 'fb-preview-btn fb-preview-remove', 'aria-label': l.remove, title: l.remove, onclick: onRemove }, icon(icons.close)),
        onEdit
          ? h('button', { type: 'button', class: 'fb-preview-btn fb-preview-edit', 'aria-label': l.edit, title: l.edit, onclick: onEdit }, icon(icons.pen))
          : null,
      );
    const url = (blob: Blob) => {
      const created = URL.createObjectURL(blob);
      this.objectUrls.push(created);
      return created;
    };

    if (this.screenshot) {
      const shot = this.screenshot;
      items.push(
        preview(
          h('img', { src: url(shot), alt: l.screenshot }),
          () => {
            this.screenshot = null;
            this.renderPreviews();
          },
          () => void this.editImage(shot, (edited) => (this.screenshot = edited)),
        ),
      );
    }
    if (this.video) {
      items.push(
        preview(h('video', { src: url(this.video), muted: true, playsinline: true, preload: 'metadata', 'aria-label': l.record }), () => {
          this.video = null;
          this.recordingEvents = null;
          this.renderPreviews();
        }),
      );
    }
    this.files.forEach((file, index) => {
      const isImage = file.type.startsWith('image/');
      const media = isImage
        ? h('img', { src: url(file), alt: file.name })
        : h('video', { src: url(file), muted: true, playsinline: true, preload: 'metadata', 'aria-label': file.name });
      items.push(
        preview(
          media,
          () => {
            this.files.splice(index, 1);
            this.renderPreviews();
          },
          isImage
            ? () =>
                void this.editImage(file, (edited) => {
                  this.files[index] = new File([edited], file.name.replace(/\.\w+$/, '') + '.png', { type: 'image/png' });
                })
            : undefined,
        ),
      );
    });
    this.els.form.previews.replaceChildren(...items);
    this.els.form.previews.hidden = items.length === 0;
  }

  /** Adds dropped/pasted/picked image and video files, within the size limit. */
  private addFiles(files: File[]) {
    const accepted = files.filter((file) => /^(image|video)\//.test(file.type));
    const limitMb = this.options.maxAttachmentMB ?? 25;
    const total = [...this.files, ...accepted].reduce((sum, file) => sum + file.size, 0);
    if (total > limitMb * 1024 * 1024) {
      this.showError(this.labels.fileTooLarge.replace('{mb}', String(limitMb)));
      return;
    }
    this.showError(null);
    this.files.push(...accepted);
    this.renderPreviews();
  }

  private async editImage(image: Blob, apply: (edited: Blob) => void) {
    if (!this.root || !this.els) return;
    this.els.panel.hidden = true;
    try {
      const edited = await annotate(this.root, image, this.labels);
      if (edited) apply(edited);
    } finally {
      if (this.els) this.els.panel.hidden = !this.isOpen;
      this.renderPreviews();
    }
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
        surface: this.options.recordingSurface ?? 'window',
        onTick: (seconds) => (els.timer.textContent = formatSeconds(seconds)),
      });
      // SPA route changes keep recording; a full page load would end it, so ask first.
      window.addEventListener('beforeunload', this.onBeforeUnload);
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
      window.removeEventListener('beforeunload', this.onBeforeUnload);
      this.recording = null;
      this.overlay?.destroy();
      this.overlay = null;
      this.els?.drawButton?.setAttribute('aria-pressed', 'false');
      this.finishCapture();
    }
  }

  private onBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = '';
  };

  private toggleDrawing() {
    if (!this.overlay) return;
    const on = !this.overlay.isDrawing;
    this.overlay.setDrawing(on);
    this.els?.drawButton?.setAttribute('aria-pressed', String(on));
  }

  private finishCapture() {
    this.capturing = false;
    if (!this.destroyed && this.els) {
      if (this.renderPending) this.render();
      this.els.recordingBar.hidden = true;
      this.renderPreviews();
      // Bring the report back even if the user navigated somewhere the launcher is hidden.
      this.isOpen = true;
      this.els.panel.hidden = false;
      this.refreshSummary();
      this.updateLauncher();
    }
    this.idleWaiters.splice(0).forEach((resolve) => resolve());
  }

  // ------------------------------------------------------------------- submit

  private buildPayload(values: FormValues): FeedbackPayload {
    const { user, metadata } = this.options;
    const payload: FeedbackPayload = {
      type: this.type,
      title: values.title || values.message.split('\n')[0].slice(0, 80),
      message: values.message,
      context: collectContext(),
    };
    if (values.severity) payload.severity = values.severity;
    if (values.area) payload.area = values.area;
    if (values.component) payload.component = values.component;
    if (values.expected) payload.expected = values.expected;
    if (values.actual) payload.actual = values.actual;
    if (values.checklist.length) payload.checklist = values.checklist;
    if (values.tags.length) payload.tags = values.tags;
    if (values.sentiment) payload.sentiment = values.sentiment;
    if (values.anonymous) {
      payload.anonymous = true;
    } else {
      const email = values.email || user?.email;
      if (email) payload.email = email;
      if (user) payload.user = user;
    }
    const resolvedMetadata = typeof metadata === 'function' ? metadata() : metadata;
    if (resolvedMetadata) payload.metadata = resolvedMetadata;
    if (this.consoleCapture && values.include.console) payload.consoleLogs = this.consoleCapture.entries();
    if (this.networkCapture && values.include.network) payload.networkLogs = this.networkCapture.entries();
    if (this.breadcrumbs && values.include.actions) payload.breadcrumbs = this.breadcrumbs.entries();
    if (this.screenshot) payload.screenshot = this.screenshot;
    if (this.video) payload.video = this.video;
    if (this.video && this.recordingEvents) payload.recordingEvents = this.recordingEvents;
    if (this.files.length) payload.attachments = this.files.slice();
    return payload;
  }

  private async submit() {
    if (!this.els || this.submitting || !this.els.form.isValid()) return;
    const { onSubmit, endpoint, headers } = this.options;
    if (!onSubmit && !endpoint) {
      console.warn('[feedback-management] Set `endpoint` or `onSubmit` to receive submissions.');
    }

    this.submitting = true;
    this.showError(null);
    this.updateSubmit();
    try {
      const payload = this.buildPayload(this.els.form.values());
      await onSubmit?.(payload);
      if (endpoint) {
        await postFeedback(endpoint, payload, typeof headers === 'function' ? headers() : headers);
      }
      if (this.destroyed || !this.els) return;
      this.clearAttachments();
      this.els.form.form.hidden = true;
      this.els.form.tabs?.setAttribute('hidden', '');
      this.els.success.hidden = false;
    } catch (error) {
      this.showError(this.labels.error);
      this.options.onError?.(error);
    } finally {
      this.submitting = false;
      this.updateSubmit();
    }
  }
}
