import { matchesRule } from '../pages';
import type {
  FeedbackArea,
  FeedbackLabels,
  FeedbackOptions,
  FeedbackType,
  Sentiment,
  Severity,
} from '../types';
import { h, icon } from './dom';
import { icons } from './icons';

export interface FormValues {
  title: string;
  message: string;
  email: string;
  area: string;
  component: string;
  expected: string;
  actual: string;
  severity: Severity | '';
  tags: string[];
  sentiment: Sentiment | '';
  checklist: { label: string; checked: boolean }[];
  anonymous: boolean;
  include: { console: boolean; network: boolean; actions: boolean };
}

export interface SummaryInfo {
  console: number;
  errors: number;
  network: number;
  failed: number;
  actions: number;
}

export interface FormHandlers {
  onInput(): void;
  onSubmit(): void;
  onCancel(): void;
  onTypeChange(type: FeedbackType): void;
  onScreenshot(): void;
  onRecord(): void;
  onFiles(files: File[]): void;
}

export interface FormConfig {
  options: FeedbackOptions;
  labels: FeedbackLabels;
  types: FeedbackType[];
  type: FeedbackType;
  canRecord: boolean;
  handlers: FormHandlers;
  /** Values to restore after a re-render. */
  draft?: FormValues | null;
}

const TITLE_MAX = 80;
const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
const SENTIMENTS: Sentiment[] = ['happy', 'neutral', 'frustrated'];
const TYPE_ICONS: Record<FeedbackType, string> = {
  bug: icons.bug,
  feedback: icons.feedback,
  suggestion: icons.suggestion,
};

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** `Chrome 155 · MacIntel` from the user agent. */
export function browserSummary(): string {
  const ua = navigator.userAgent;
  const match =
    ua.match(/(Edg|OPR|Firefox|Chrome|Version)\/(\d+)/) ?? ua.match(/(Safari)\/(\d+)/);
  const names: Record<string, string> = { Edg: 'Edge', OPR: 'Opera', Version: 'Safari' };
  const browser = match ? `${names[match[1]] ?? match[1]} ${match[2]}` : 'Browser';
  return `${browser} · ${navigator.platform || 'unknown OS'}`;
}

function normalizeAreas(areas: FeedbackOptions['areas']): FeedbackArea[] {
  return (areas ?? []).map((area) => (typeof area === 'string' ? { label: area } : area));
}

/** The area whose `match` rules fit the current URL, if any. */
export function detectArea(areas: FeedbackOptions['areas'], url: URL): string {
  for (const area of normalizeAreas(areas)) {
    const rules = area.match === undefined ? [] : Array.isArray(area.match) ? area.match : [area.match];
    if (rules.some((rule) => matchesRule(rule, url))) return area.label;
  }
  return '';
}

/**
 * The report form: type tabs, fields, attachments, privacy summary and
 * footer. It owns its inputs; the widget reads them through `values()`.
 */
export class ReportForm {
  readonly tabs: HTMLElement | null;
  readonly form: HTMLFormElement;
  readonly previews: HTMLElement;
  readonly error: HTMLElement;
  readonly submit: HTMLButtonElement;
  readonly screenshotButton: HTMLButtonElement | null;
  readonly recordButton: HTMLButtonElement | null;

  private type: FeedbackType;
  private areaTouched = false;
  private readonly labels: FeedbackLabels;
  private readonly typeButtons = new Map<FeedbackType, HTMLButtonElement>();
  /** Elements shown only for some types. */
  private readonly perType: { el: HTMLElement; types: FeedbackType[] }[] = [];
  private readonly title: HTMLInputElement | null;
  private readonly titleCount: HTMLElement | null;
  private readonly message: HTMLTextAreaElement;
  private readonly messageLabel: HTMLElement;
  private readonly messageHint: HTMLElement;
  private readonly email: HTMLInputElement | null;
  private readonly area: HTMLSelectElement | null;
  private readonly component: HTMLInputElement | null;
  private readonly expected: HTMLTextAreaElement | null;
  private readonly actual: HTMLTextAreaElement | null;
  private readonly checklist: HTMLInputElement[] = [];
  private readonly severityButtons = new Map<Severity, HTMLButtonElement>();
  private readonly severityLabel: HTMLElement | null = null;
  private readonly severityHint: HTMLElement | null = null;
  private readonly tagButtons: HTMLButtonElement[] = [];
  private readonly tagCount: HTMLElement | null = null;
  private readonly sentimentButtons = new Map<Sentiment, HTMLButtonElement>();
  private readonly anonymous: HTMLInputElement | null = null;
  private readonly include: Record<'console' | 'network' | 'actions', HTMLInputElement> | null = null;
  private readonly summaryLine: HTMLElement | null = null;
  private readonly summaryCounts: Record<'console' | 'network' | 'actions', HTMLElement> | null = null;
  private readonly severityTypes: FeedbackType[];
  private severity: Severity | '';
  private sentiment: Sentiment | '';

  constructor(private readonly config: FormConfig) {
    const { options, labels: l, handlers, draft } = config;
    const fields = options.fields ?? {};
    this.labels = l;
    this.type = config.type;
    this.severity = draft?.severity ?? 'medium';
    this.sentiment = draft?.sentiment ?? '';

    // ---- type tabs
    this.tabs =
      config.types.length > 1
        ? h(
            'div',
            { class: 'fb-tabs', role: 'tablist', 'aria-label': l.eyebrow, part: 'tabs' },
            ...config.types.map((type) => {
              const button = h(
                'button',
                {
                  type: 'button',
                  class: `fb-tab fb-tab-${type}`,
                  role: 'tab',
                  'aria-selected': String(type === this.type),
                  onclick: () => handlers.onTypeChange(type),
                },
                h('span', { class: 'fb-tab-title' }, icon(TYPE_ICONS[type]), l[type]),
                h('span', { class: 'fb-tab-hint' }, l[`${type}Hint`]),
              );
              this.typeButtons.set(type, button);
              return button;
            }),
          )
        : null;

    // ---- media row
    this.screenshotButton =
      options.features?.screenshot === false
        ? null
        : h('button', { type: 'button', class: 'fb-btn', part: 'button', onclick: () => handlers.onScreenshot() }, icon(icons.camera), l.screenshot);
    this.recordButton =
      options.features?.video === false || !config.canRecord
        ? null
        : h('button', { type: 'button', class: 'fb-btn', part: 'button', onclick: () => handlers.onRecord() }, icon(icons.video), l.record);
    this.previews = h('div', { class: 'fb-previews', hidden: true });

    // ---- title + message
    if (fields.title !== false) {
      this.title = h('input', {
        class: 'fb-input',
        part: 'input',
        name: 'title',
        maxlength: TITLE_MAX,
        placeholder: l.titlePlaceholder,
        oninput: () => this.updateTitleCount(),
      });
      this.title.value = draft?.title ?? '';
      this.titleCount = h('span', { class: 'fb-hint' });
    } else {
      this.title = this.titleCount = null;
    }
    this.message = h('textarea', { class: 'fb-input', part: 'input', name: 'message', rows: 4, required: true, oninput: () => handlers.onInput() });
    this.message.value = draft?.message ?? '';
    this.messageLabel = h('span', {});
    this.messageHint = h('span', { class: 'fb-hint' }, l.messageHint);

    // ---- area / component
    const areas = normalizeAreas(options.areas);
    if (fields.area !== false && areas.length) {
      this.area = h(
        'select',
        { class: 'fb-input', part: 'input', name: 'area', onchange: () => (this.areaTouched = true) },
        h('option', { value: '' }, '—'),
        ...areas.map((area) => h('option', { value: area.label }, area.label)),
        h('option', { value: l.areaOther }, l.areaOther),
      );
      this.area.value = draft?.area ?? '';
      this.areaTouched = !!draft?.area;
    } else {
      this.area = null;
    }
    if (fields.component) {
      this.component = h('input', { class: 'fb-input', part: 'input', name: 'component', placeholder: l.componentPlaceholder });
      this.component.value = draft?.component ?? '';
    } else {
      this.component = null;
    }

    // ---- expected / actual
    if (fields.expectedActual !== false) {
      this.expected = h('textarea', { class: 'fb-input', part: 'input', name: 'expected', rows: 2, placeholder: l.expectedPlaceholder });
      this.actual = h('textarea', { class: 'fb-input', part: 'input', name: 'actual', rows: 2, placeholder: l.actualPlaceholder });
      this.expected.value = draft?.expected ?? '';
      this.actual.value = draft?.actual ?? '';
    } else {
      this.expected = this.actual = null;
    }

    // ---- checklist
    const checklistItems =
      fields.checklist === false ? [] : Array.isArray(fields.checklist) ? fields.checklist : l.checklistItems;
    const checklistBox = checklistItems.length
      ? h(
          'div',
          { class: 'fb-checklist' },
          ...checklistItems.map((label, i) => {
            const input = h('input', { type: 'checkbox', name: `check-${i}` });
            input.checked = draft?.checklist[i]?.checked ?? false;
            this.checklist.push(input);
            return h('label', { class: 'fb-check' }, input, h('span', {}, label));
          }),
        )
      : null;

    // ---- severity / priority
    const severityTypes =
      fields.severity === false ? [] : Array.isArray(fields.severity) ? fields.severity : (['bug', 'suggestion'] as FeedbackType[]);
    this.severityTypes = severityTypes;
    let severityRow: HTMLElement | null = null;
    if (severityTypes.length) {
      this.severityLabel = h('span', {});
      this.severityHint = h('span', { class: 'fb-hint' });
      severityRow = this.section(
        this.severityLabel,
        this.severityHint,
        h(
          'div',
          { class: 'fb-chips', role: 'radiogroup' },
          ...SEVERITIES.map((value) => {
            const button = h(
              'button',
              {
                type: 'button',
                class: `fb-chip fb-sev-${value}`,
                part: 'chip',
                role: 'radio',
                onclick: () => this.setSeverity(value),
              },
              h('span', { class: 'fb-dot-sm' }),
              h('span', { class: 'fb-chip-label' }),
              h('span', { class: 'fb-chip-hint' }),
            );
            this.severityButtons.set(value, button);
            return button;
          }),
        ),
      );
      this.perType.push({ el: severityRow, types: severityTypes });
    }

    // ---- tags
    let tagsRow: HTMLElement | null = null;
    if (fields.tags?.length) {
      const selected = new Set(draft?.tags ?? []);
      this.tagCount = h('span', { class: 'fb-hint' });
      tagsRow = this.section(
        l.tags,
        this.tagCount,
        h(
          'div',
          { class: 'fb-chips' },
          ...fields.tags.map((tag) => {
            const button = h(
              'button',
              { type: 'button', class: 'fb-chip', part: 'chip', 'aria-pressed': String(selected.has(tag)), 'data-value': tag },
              tag,
            );
            button.addEventListener('click', () => {
              button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
              this.updateTagCount();
            });
            this.tagButtons.push(button);
            return button;
          }),
        ),
      );
    }

    // ---- sentiment
    const sentimentRow =
      fields.sentiment === false
        ? null
        : this.section(
            l.sentiment,
            h('span', { class: 'fb-hint' }, l.optional),
            h(
              'div',
              { class: 'fb-chips', role: 'radiogroup' },
              ...SENTIMENTS.map((value) => {
                const button = h(
                  'button',
                  {
                    type: 'button',
                    class: `fb-chip fb-mood-${value}`,
                    part: 'chip',
                    role: 'radio',
                    onclick: () => this.setSentiment(this.sentiment === value ? '' : value),
                  },
                  h('span', { class: 'fb-dot-sm' }),
                  l[value],
                );
                this.sentimentButtons.set(value, button);
                return button;
              }),
            ),
          );

    // ---- attachments drop zone
    let dropRow: HTMLElement | null = null;
    if (fields.attachments !== false) {
      const picker = h('input', { type: 'file', accept: 'image/*,video/*', multiple: true, hidden: true });
      picker.addEventListener('change', () => {
        if (picker.files?.length) handlers.onFiles(Array.from(picker.files));
        picker.value = '';
      });
      const zone = h(
        'div',
        { class: 'fb-drop', part: 'dropzone', tabindex: 0, role: 'button', 'aria-label': `${l.dropTitle}. ${l.browse}` },
        h('strong', {}, l.dropTitle),
        h('span', { class: 'fb-hint' }, l.dropHint),
        picker,
      );
      zone.addEventListener('click', () => picker.click());
      zone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          picker.click();
        }
      });
      zone.addEventListener('dragover', (event) => {
        event.preventDefault();
        zone.classList.add('fb-drop-active');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('fb-drop-active'));
      zone.addEventListener('drop', (event) => {
        event.preventDefault();
        zone.classList.remove('fb-drop-active');
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length) handlers.onFiles(files);
      });
      dropRow = this.section(l.attachments, h('span', { class: 'fb-hint' }, `${l.attachmentsHint}${isMac() ? ' (⌘V)' : ''}`), zone);
    }

    // ---- email / anonymous
    const { user } = options;
    this.email =
      options.features?.email !== false && !user?.email
        ? h('input', { class: 'fb-input', part: 'input', type: 'email', name: 'email', placeholder: l.email, 'aria-label': l.email, autocomplete: 'email' })
        : null;
    if (this.email) this.email.value = draft?.email ?? '';
    const identity = [user?.name, user?.email].filter(Boolean).join(' · ') || (user?.id ? `#${user.id}` : '');
    let anonymousRow: HTMLElement | null = null;
    if (fields.anonymous !== false && identity) {
      this.anonymous = h('input', { type: 'checkbox', class: 'fb-switch-input', name: 'anonymous', role: 'switch' });
      this.anonymous.checked = draft?.anonymous ?? false;
      anonymousRow = h(
        'label',
        { class: 'fb-card fb-toggle-row' },
        h('span', {}, h('strong', {}, l.anonymous), h('span', { class: 'fb-hint fb-block' }, `${l.postedAs} ${identity}`)),
        this.anonymous,
        h('span', { class: 'fb-switch', 'aria-hidden': 'true' }),
      );
    }

    // ---- what we're sending
    let summaryRow: HTMLElement | null = null;
    if (fields.summary !== false) {
      const toggle = (key: 'console' | 'network' | 'actions', label: string, enabled: boolean) => {
        const input = h('input', { type: 'checkbox', name: `include-${key}` });
        input.checked = draft?.include[key] ?? true;
        const count = h('span', { class: 'fb-hint' });
        const row = h('label', { class: 'fb-check', hidden: !enabled }, input, h('span', {}, label), count);
        return { input, count, row };
      };
      const features = options.features ?? {};
      const consoleToggle = toggle('console', l.summaryConsole, features.consoleLogs !== false);
      const networkToggle = toggle('network', l.summaryNetwork, features.networkLogs !== false);
      const actionsToggle = toggle('actions', l.summaryActions, features.breadcrumbs !== false);
      this.include = { console: consoleToggle.input, network: networkToggle.input, actions: actionsToggle.input };
      this.summaryCounts = { console: consoleToggle.count, network: networkToggle.count, actions: actionsToggle.count };
      this.summaryLine = h('span', { class: 'fb-hint' });
      summaryRow = h(
        'details',
        { class: 'fb-card fb-summary' },
        h('summary', {}, h('span', { class: 'fb-label' }, h('span', { class: 'fb-dot-sm fb-ok' }), l.summary), this.summaryLine),
        h(
          'div',
          { class: 'fb-checklist' },
          h('label', { class: 'fb-check' }, h('input', { type: 'checkbox', checked: true, disabled: true }), h('span', {}, l.summaryPage)),
          consoleToggle.row,
          networkToggle.row,
          actionsToggle.row,
        ),
      );
    }

    // ---- footer
    this.error = h('p', { class: 'fb-error', role: 'alert', hidden: true });
    this.submit = h('button', { type: 'submit', class: 'fb-btn fb-btn-primary', part: 'submit' });
    const footer = h(
      'div',
      { class: 'fb-footer', part: 'footer' },
      this.error,
      h('span', { class: 'fb-spacer' }),
      h('button', { type: 'button', class: 'fb-btn fb-btn-ghost', part: 'button', onclick: () => handlers.onCancel() }, l.cancel),
      this.submit,
    );

    const expectedActual =
      this.expected && this.actual
        ? h('div', { class: 'fb-grid' }, this.section(l.expected, null, this.expected), this.section(l.actual, null, this.actual))
        : null;
    if (expectedActual) this.perType.push({ el: expectedActual, types: ['bug'] });
    const checklistRow = checklistBox ? this.section(l.checklist, null, checklistBox) : null;
    if (checklistRow) this.perType.push({ el: checklistRow, types: ['bug'] });

    const body = h(
      'div',
      { class: 'fb-body', part: 'body' },
      this.screenshotButton || this.recordButton
        ? h('div', { class: 'fb-actions' }, this.screenshotButton, this.recordButton)
        : null,
      this.previews,
      this.title
        ? this.section(
            h('span', {}, l.titleField),
            this.titleCount,
            this.title,
          )
        : null,
      this.section(h('span', {}, this.messageLabel, h('span', { class: 'fb-badge' }, l.required)), this.messageHint, this.message),
      this.area || this.component
        ? h(
            'div',
            { class: this.area && this.component ? 'fb-grid' : '' },
            this.area ? this.section(l.area, null, this.area) : null,
            this.component ? this.section(l.component, null, this.component) : null,
          )
        : null,
      expectedActual,
      checklistRow,
      severityRow,
      tagsRow,
      sentimentRow,
      dropRow,
      this.email,
      anonymousRow,
      summaryRow,
    );

    this.form = h(
      'form',
      {
        class: 'fb-form',
        novalidate: true,
        onsubmit: (event: Event) => {
          event.preventDefault();
          handlers.onSubmit();
        },
      },
      body,
      footer,
    );
    this.form.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        this.form.requestSubmit();
      }
    });
    this.form.addEventListener('paste', (event) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((f) => /^(image|video)\//.test(f.type));
      if (files.length && fields.attachments !== false) {
        event.preventDefault();
        handlers.onFiles(files);
      }
    });

    this.updateTitleCount();
    this.updateTagCount();
    this.setSentiment(this.sentiment);
    this.setType(this.type);
  }

  /** A labelled block: uppercase label, optional right-aligned hint, then the control. */
  private section(label: string | Node, hint: Node | null, control: Node): HTMLElement {
    return h(
      'div',
      { class: 'fb-field', part: 'field' },
      h('div', { class: 'fb-field-head' }, h('span', { class: 'fb-label' }, label), hint),
      control,
    );
  }

  setType(type: FeedbackType): void {
    this.type = type;
    const l = this.labels;
    this.typeButtons.forEach((button, t) => button.setAttribute('aria-selected', String(t === type)));
    for (const { el, types } of this.perType) el.hidden = !types.includes(type);
    this.messageLabel.textContent = { bug: l.messageBug, feedback: l.messageFeedback, suggestion: l.messageSuggestion }[type];
    this.messageHint.hidden = type !== 'bug';
    this.message.placeholder = { bug: l.placeholderBug, feedback: l.placeholderFeedback, suggestion: l.placeholderSuggestion }[type];
    if (this.severityLabel && this.severityHint) {
      const isBug = type === 'bug';
      this.severityLabel.textContent = isBug ? l.severity : l.priority;
      this.severityHint.textContent = isBug ? l.severityHint : l.priorityHint;
      const hints: Record<Severity, string> = {
        critical: isBug ? l.criticalHint : l.priorityCriticalHint,
        high: '',
        medium: '',
        low: isBug ? l.lowHint : l.priorityLowHint,
      };
      this.severityButtons.forEach((button, value) => {
        button.querySelector('.fb-chip-label')!.textContent = l[value];
        button.querySelector('.fb-chip-hint')!.textContent = hints[value] ? `· ${hints[value]}` : '';
      });
    }
    this.setSeverity(this.severity);
    this.submit.dataset.label = { bug: l.submitBug, feedback: l.submitFeedback, suggestion: l.submitSuggestion }[type];
    this.setSubmitting(false);
  }

  get currentType(): FeedbackType {
    return this.type;
  }

  private setSeverity(value: Severity | '') {
    this.severity = value;
    this.severityButtons.forEach((button, v) => button.setAttribute('aria-checked', String(v === value)));
  }

  private setSentiment(value: Sentiment | '') {
    this.sentiment = value;
    this.sentimentButtons.forEach((button, v) => button.setAttribute('aria-checked', String(v === value)));
  }

  private updateTitleCount() {
    if (this.title && this.titleCount) this.titleCount.textContent = `${this.title.value.length}/${TITLE_MAX}`;
  }

  private updateTagCount() {
    if (!this.tagCount) return;
    const count = this.tagButtons.filter((b) => b.getAttribute('aria-pressed') === 'true').length;
    this.tagCount.textContent = `${count} selected · ${this.labels.tagsHint}`;
  }

  /** Preselects "Where in the app?" from the current route, unless the user already chose. */
  syncArea(url: URL): void {
    if (!this.area || this.areaTouched) return;
    this.area.value = detectArea(this.config.options.areas, url);
  }

  updateSummary(info: SummaryInfo): void {
    if (!this.summaryLine || !this.summaryCounts) return;
    this.summaryLine.textContent = `${browserSummary()} · ${info.errors} err`;
    this.summaryCounts.console.textContent = `${info.console}${info.errors ? ` · ${info.errors} error${info.errors === 1 ? '' : 's'}` : ''}`;
    this.summaryCounts.network.textContent = `${info.network}${info.failed ? ` · ${info.failed} failed` : ''}`;
    this.summaryCounts.actions.textContent = String(info.actions);
  }

  focus(): void {
    (this.title ?? this.message).focus();
  }

  isValid(): boolean {
    return this.message.value.trim().length > 0;
  }

  setSubmitting(submitting: boolean): void {
    this.submit.disabled = submitting || !this.isValid();
    const label = this.submit.dataset.label ?? this.labels.submit;
    this.submit.replaceChildren(
      submitting ? this.labels.sending : label,
      submitting ? '' : h('kbd', { class: 'fb-kbd' }, isMac() ? '⌘↵' : 'Ctrl↵'),
    );
    if (this.screenshotButton) this.screenshotButton.disabled = submitting;
    if (this.recordButton) this.recordButton.disabled = submitting;
  }

  showError(message: string | null): void {
    this.error.textContent = message ?? '';
    this.error.hidden = !message;
  }

  values(): FormValues {
    const text = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null) => el?.value.trim() ?? '';
    const isBug = this.type === 'bug';
    return {
      title: text(this.title),
      message: text(this.message),
      email: text(this.email),
      area: text(this.area),
      component: text(this.component),
      expected: isBug ? text(this.expected) : '',
      actual: isBug ? text(this.actual) : '',
      severity: this.severityTypes.includes(this.type) ? this.severity : '',
      tags: this.tagButtons.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.value!),
      sentiment: this.sentiment,
      checklist: isBug
        ? this.checklist.map((input) => ({ label: input.parentElement!.textContent ?? '', checked: input.checked }))
        : [],
      anonymous: this.anonymous?.checked ?? false,
      include: {
        console: this.include?.console.checked ?? true,
        network: this.include?.network.checked ?? true,
        actions: this.include?.actions.checked ?? true,
      },
    };
  }

  /** Raw values for restoring after a re-render (keeps type-specific fields regardless of the current type). */
  draft(): FormValues {
    const values = this.values();
    return {
      ...values,
      expected: this.expected?.value ?? '',
      actual: this.actual?.value ?? '',
      severity: this.severity,
      checklist: this.checklist.map((input) => ({ label: '', checked: input.checked })),
    };
  }
}
