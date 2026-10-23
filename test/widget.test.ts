import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackWidget } from '../src/widget';
import { destroy, getInstance, init } from '../src/index';
import type { FeedbackPayload } from '../src/types';

const shadow = () => document.querySelector('[data-feedback-widget]')?.shadowRoot ?? null;
const $ = <T extends Element>(selector: string) => shadow()!.querySelector<T>(selector)!;

let widget: FeedbackWidget | null = null;

afterEach(() => {
  widget?.destroy();
  widget = null;
  destroy();
  history.replaceState({}, '', '/');
});

function type(text: string) {
  const textarea = $<HTMLTextAreaElement>('textarea');
  textarea.value = text;
  textarea.dispatchEvent(new Event('input'));
}

describe('FeedbackWidget', () => {
  it('mounts a launcher inside a shadow root and opens the panel', () => {
    widget = new FeedbackWidget({ onSubmit: () => {} });
    const launcher = $<HTMLButtonElement>('.fb-launcher');
    expect(launcher.hidden).toBe(false);
    expect($<HTMLElement>('.fb-panel').hidden).toBe(true);

    launcher.click();
    expect(widget.opened).toBe(true);
    expect($<HTMLElement>('.fb-panel').hidden).toBe(false);
    expect(launcher.hidden).toBe(true);
  });

  it('follows SPA navigation for include/exclude rules', () => {
    history.replaceState({}, '', '/app/home');
    widget = new FeedbackWidget({ pages: { include: ['/app/**'], exclude: ['/app/checkout'] } });
    const launcher = $<HTMLButtonElement>('.fb-launcher');
    expect(launcher.hidden).toBe(false);

    history.pushState({}, '', '/app/checkout');
    expect(launcher.hidden).toBe(true);

    history.pushState({}, '', '/marketing');
    expect(launcher.hidden).toBe(true);

    history.pushState({}, '', '/app/settings');
    expect(launcher.hidden).toBe(false);
  });

  it('closes the panel when navigating to an excluded page', () => {
    widget = new FeedbackWidget({ pages: { exclude: ['/private'] } });
    widget.open();
    history.pushState({}, '', '/private');
    expect(widget.opened).toBe(false);
  });

  it('submits a payload with type, message, user, metadata and context', async () => {
    const onSubmit = vi.fn<(p: FeedbackPayload) => void>();
    widget = new FeedbackWidget({
      onSubmit,
      user: { id: 'u1', email: 'jane@example.com' },
      metadata: () => ({ version: '1.2.3' }),
    });
    widget.open('suggestion');
    expect($('input[type=email]')).toBeNull(); // known user email: no email field

    const submit = $<HTMLButtonElement>('button[type=submit]');
    expect(submit.disabled).toBe(true);
    type('  Add dark mode  ');
    expect(submit.disabled).toBe(false);

    $<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());

    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({
      type: 'suggestion',
      message: 'Add dark mode',
      email: 'jane@example.com',
      user: { id: 'u1' },
      metadata: { version: '1.2.3' },
      context: { path: '/' },
    });
    await vi.waitFor(() => expect($<HTMLElement>('.fb-success').hidden).toBe(false));
  });

  it('posts multipart form data to the endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    widget = new FeedbackWidget({ endpoint: '/api/feedback', headers: { 'x-api-key': 'k' } });
    widget.open('bug');
    type('Button does nothing');
    $<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [endpoint, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe('/api/feedback');
    expect(init.headers).toEqual({ 'x-api-key': 'k' });
    const body = init.body as FormData;
    expect(JSON.parse(body.get('payload') as string)).toMatchObject({ type: 'bug', message: 'Button does nothing' });
    vi.unstubAllGlobals();
  });

  it('attaches API calls (not its own submission), breadcrumbs and route details', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    history.replaceState({}, '', '/orders?status=open#top');
    widget = new FeedbackWidget({ endpoint: '/api/feedback' });
    await fetch('/api/orders');
    document.body.append(Object.assign(document.createElement('button'), { id: 'refresh', textContent: 'Refresh' }));
    document.getElementById('refresh')!.click();

    widget.open();
    type('List is empty');
    $<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const body = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as FormData;
    const payload = JSON.parse(body.get('payload') as string);
    expect(payload.networkLogs).toEqual([
      expect.objectContaining({ method: 'GET', url: 'http://localhost:3000/api/orders', status: 201 }),
    ]);
    expect(payload.breadcrumbs).toContainEqual(
      expect.objectContaining({ type: 'click', target: 'button#refresh', text: 'Refresh', path: '/orders?status=open#top' }),
    );
    expect(payload.context).toMatchObject({ path: '/orders', query: { status: 'open' }, hash: '#top' });
    document.getElementById('refresh')!.remove();
    vi.unstubAllGlobals();
  });

  it('shows an error and keeps the message when submission fails', async () => {
    const onError = vi.fn();
    widget = new FeedbackWidget({
      onSubmit: () => Promise.reject(new Error('nope')),
      onError,
    });
    widget.open();
    type('Hello');
    $<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect($<HTMLElement>('.fb-error').hidden).toBe(false);
    expect($<HTMLTextAreaElement>('textarea').value).toBe('Hello');
  });

  it('keeps the draft across update() and applies new labels', () => {
    widget = new FeedbackWidget();
    widget.open();
    type('Draft text');
    widget.update({ labels: { title: 'Report a problem' } });
    expect($('h2').textContent).toBe('Report a problem');
    expect($<HTMLTextAreaElement>('textarea').value).toBe('Draft text');
  });

  it('respects hideLauncher, hide() and show()', () => {
    widget = new FeedbackWidget({ hideLauncher: true });
    expect($<HTMLButtonElement>('.fb-launcher').hidden).toBe(true);
    widget.update({ hideLauncher: false });
    expect($<HTMLButtonElement>('.fb-launcher').hidden).toBe(false);
    widget.hide();
    expect($<HTMLButtonElement>('.fb-launcher').hidden).toBe(true);
    widget.show();
    expect($<HTMLButtonElement>('.fb-launcher').hidden).toBe(false);
  });

  it('captures console output and restores console on destroy', async () => {
    const original = console.warn;
    const onSubmit = vi.fn<(p: FeedbackPayload) => void>();
    widget = new FeedbackWidget({ onSubmit });
    console.warn('careful', { a: 1 });
    widget.open();
    type('x');
    $<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].consoleLogs).toContainEqual(
      expect.objectContaining({ level: 'warn', message: 'careful {"a":1}' }),
    );
    widget.destroy();
    expect(console.warn).toBe(original);
  });

  it('removes itself completely on destroy', () => {
    widget = new FeedbackWidget();
    widget.destroy();
    expect(document.querySelector('[data-feedback-widget]')).toBeNull();
  });
});

describe('init()', () => {
  it('reconfigures the same instance on repeated calls', () => {
    const first = init({ labels: { title: 'First' } });
    const second = init({ labels: { title: 'Second' } });
    expect(second).toBe(first);
    expect(getInstance()).toBe(first);
    expect(document.querySelectorAll('[data-feedback-widget]')).toHaveLength(1);
    expect($('h2').textContent).toBe('Second');
  });

  it('creates a fresh instance after destroy()', () => {
    const first = init();
    destroy();
    const second = init();
    expect(second).not.toBe(first);
    expect(second.isDestroyed).toBe(false);
  });
});
