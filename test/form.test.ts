import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackWidget } from '../src/widget';
import { detectArea } from '../src/ui/form';
import { themeCss } from '../src/ui/theme';
import type { FeedbackOptions, FeedbackPayload } from '../src/types';

const root = () => document.querySelector('[data-feedback-widget]')!.shadowRoot!;
const $ = <T extends Element>(selector: string) => root().querySelector<T>(selector)!;
const $$ = <T extends Element>(selector: string) => Array.from(root().querySelectorAll<T>(selector));
const fill = (selector: string, value: string) => {
  const el = $<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
  el.value = value;
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
};
const chip = (text: string) => $$<HTMLButtonElement>('.fb-chip').find((b) => b.textContent!.includes(text))!;
const submit = () => $<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));

let widget: FeedbackWidget | null = null;
afterEach(() => {
  widget?.destroy();
  widget = null;
  history.replaceState({}, '', '/');
});

async function send(options: FeedbackOptions, act: () => void): Promise<FeedbackPayload> {
  const onSubmit = vi.fn<(p: FeedbackPayload) => void>();
  widget = new FeedbackWidget({ onSubmit, ...options });
  act();
  submit();
  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
  return onSubmit.mock.calls[0][0];
}

describe('report form', () => {
  it('collects title, severity, area, component, expected/actual, checklist, tags and sentiment for bugs', async () => {
    history.replaceState({}, '', '/app/dashboard');
    const payload = await send(
      {
        areas: [{ label: 'Dashboard', match: '/app/dashboard' }, 'Settings'],
        fields: { component: true, tags: ['billing', 'search'] },
      },
      () => {
        widget!.open('bug');
        expect($<HTMLSelectElement>('select[name=area]').value).toBe('Dashboard'); // from the route
        fill('input[name=title]', 'Export broken');
        fill('textarea[name=message]', 'Clicking export does nothing');
        fill('input[name=component]', 'Export button');
        fill('textarea[name=expected]', 'A CSV downloads');
        fill('textarea[name=actual]', 'Nothing happens');
        $<HTMLInputElement>('input[name=check-1]').click();
        chip('High').click();
        chip('billing').click();
        chip('Frustrated').click();
      },
    );
    expect(payload).toMatchObject({
      type: 'bug',
      title: 'Export broken',
      message: 'Clicking export does nothing',
      severity: 'high',
      area: 'Dashboard',
      component: 'Export button',
      expected: 'A CSV downloads',
      actual: 'Nothing happens',
      tags: ['billing'],
      sentiment: 'frustrated',
    });
    expect(payload.checklist).toEqual([
      { label: "I've checked this isn't a duplicate", checked: false },
      { label: 'I can reproduce this consistently', checked: true },
      { label: "I've tried a hard refresh", checked: false },
    ]);
  });

  it('shows bug-only fields for bugs, priority for suggestions, and neither for feedback', () => {
    widget = new FeedbackWidget();
    widget.open('bug');
    const field = (name: string) => $(`textarea[name=${name}]`).closest<HTMLElement>('.fb-grid')!;
    expect(field('expected').hidden).toBe(false);
    expect($('.fb-sev-medium').closest<HTMLElement>('.fb-field')!.hidden).toBe(false);
    expect($('.fb-sev-medium').closest('.fb-field')!.textContent).toContain('Severity');

    $$<HTMLButtonElement>('.fb-tab')[2].click(); // Suggestion
    expect(field('expected').hidden).toBe(true);
    expect($('.fb-sev-medium').closest('.fb-field')!.textContent).toContain('Priority');
    expect($('.fb-sev-low').textContent).toContain('Nice to have');

    $$<HTMLButtonElement>('.fb-tab')[0].click(); // Feedback
    expect($('.fb-sev-medium').closest<HTMLElement>('.fb-field')!.hidden).toBe(true);
  });

  it('uses the first line of the message as title and leaves severity out for feedback', async () => {
    const payload = await send({}, () => {
      widget!.open('feedback');
      fill('textarea[name=message]', 'Love the new charts\nespecially the colors');
    });
    expect(payload.title).toBe('Love the new charts');
    expect(payload.severity).toBeUndefined();
    expect(payload.checklist).toBeUndefined();
  });

  it('submits anonymously without user or email', async () => {
    const payload = await send({ user: { id: 'u1', name: 'Jane', email: 'jane@acme.com' } }, () => {
      widget!.open();
      expect($('.fb-toggle-row').textContent).toContain('Posted as Jane · jane@acme.com');
      fill('textarea[name=message]', 'Hi');
      $<HTMLInputElement>('input[name=anonymous]').click();
    });
    expect(payload.anonymous).toBe(true);
    expect(payload.user).toBeUndefined();
    expect(payload.email).toBeUndefined();
  });

  it('lets the user leave console logs, API calls and clicks out', async () => {
    const payload = await send({}, () => {
      console.info('hello');
      widget!.open();
      fill('textarea[name=message]', 'Hi');
      $<HTMLInputElement>('input[name=include-console]').click();
      $<HTMLInputElement>('input[name=include-actions]').click();
    });
    expect(payload.consoleLogs).toBeUndefined();
    expect(payload.breadcrumbs).toBeUndefined();
    expect(payload.networkLogs).toEqual([]);
  });

  it('accepts pasted and dropped image files within the size limit', async () => {
    const image = new File(['png'], 'shot.png', { type: 'image/png' });
    const text = new File(['x'], 'notes.txt', { type: 'text/plain' });
    const payload = await send({}, () => {
      widget!.open();
      fill('textarea[name=message]', 'See attached');
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.assign(paste, { clipboardData: { files: [image] } });
      $('textarea[name=message]').dispatchEvent(paste);
      const drop = new Event('drop', { bubbles: true, cancelable: true });
      Object.assign(drop, { dataTransfer: { files: [image, text] } });
      $('.fb-drop').dispatchEvent(drop);
      expect($$('.fb-preview')).toHaveLength(2); // the text file is ignored
    });
    expect(payload.attachments?.map((f) => f.name)).toEqual(['shot.png', 'shot.png']);
  });

  it('rejects files over maxAttachmentMB', () => {
    widget = new FeedbackWidget({ maxAttachmentMB: 0.000001 });
    widget.open();
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.assign(drop, { dataTransfer: { files: [new File(['too big'], 'a.png', { type: 'image/png' })] } });
    $('.fb-drop').dispatchEvent(drop);
    expect($$('.fb-preview')).toHaveLength(0);
    expect($('.fb-error').textContent).toContain('MB');
  });

  it('hides fields that are switched off', () => {
    widget = new FeedbackWidget({
      fields: { title: false, severity: false, sentiment: false, checklist: false, attachments: false, summary: false, expectedActual: false },
      features: { screenshot: false, video: false },
    });
    widget.open('bug');
    for (const selector of ['input[name=title]', '.fb-sev-medium', '.fb-mood-happy', '.fb-checklist', '.fb-drop', '.fb-summary', 'textarea[name=expected]', '.fb-actions']) {
      expect($(selector), selector).toBeNull();
    }
    expect($('textarea[name=message]')).not.toBeNull();
  });

  it('labels the submit button per type and keeps the draft across type switches', () => {
    widget = new FeedbackWidget();
    widget.open('bug');
    fill('textarea[name=message]', 'draft');
    expect($('button[type=submit]').textContent).toContain('File bug');
    $$<HTMLButtonElement>('.fb-tab')[2].click();
    expect($('button[type=submit]').textContent).toContain('Submit idea');
    expect($<HTMLTextAreaElement>('textarea[name=message]').value).toBe('draft');
  });
});

describe('detectArea', () => {
  it('picks the first area whose rules match the URL', () => {
    const areas = [{ label: 'Docs', match: ['/docs/**'] }, { label: 'Home', match: '/' }, 'Other'];
    expect(detectArea(areas, new URL('https://x.com/docs/a'))).toBe('Docs');
    expect(detectArea(areas, new URL('https://x.com/'))).toBe('Home');
    expect(detectArea(areas, new URL('https://x.com/nope'))).toBe('');
  });
});

describe('theming', () => {
  it('turns appearance into CSS variables, with dark overrides', () => {
    const css = themeCss({ primary: '#ff0066', radius: '0', font: 'Inter, sans-serif', dark: { background: '#000' } });
    expect(css).toContain('--fb-primary:#ff0066;');
    expect(css).toContain('--fb-radius:0;');
    expect(css).toContain('--fb-font:Inter, sans-serif;');
    expect(css).toContain(':host([data-theme="dark"]){--fb-bg:#000;}');
    expect(css).toContain('@media (prefers-color-scheme: dark){:host([data-theme="auto"]){--fb-bg:#000;}}');
  });

  it('keeps values from breaking out of their declaration', () => {
    expect(themeCss({ primary: 'red;} body{display:none' })).toContain('--fb-primary:red body');
  });

  it('applies appearance, customCss, launcher shape and exposes ::part hooks', () => {
    widget = new FeedbackWidget({
      appearance: { primary: '#0a7', launcher: 'tab' },
      customCss: '.fb-launcher { letter-spacing: 1px; }',
    });
    const css = $('style').textContent!;
    expect(css).toContain('--fb-primary:#0a7;');
    expect(css.trim().endsWith('.fb-launcher { letter-spacing: 1px; }')).toBe(true);
    const launcher = $('.fb-launcher');
    expect(launcher.classList.contains('fb-launcher-tab')).toBe(true);
    expect(launcher.getAttribute('part')).toBe('launcher');
    expect($('.fb-panel').getAttribute('part')).toBe('panel');
  });

  it('renders an icon-only circle launcher with an accessible name', () => {
    widget = new FeedbackWidget({ appearance: { launcher: 'circle' } });
    const launcher = $('.fb-launcher');
    expect(launcher.textContent).toBe('');
    expect(launcher.getAttribute('aria-label')).toBe('Feedback');
  });
});
