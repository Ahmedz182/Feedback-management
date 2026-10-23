import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackPayload } from '../src/types';

// A controllable fake recorder: the test decides when the recording ends.
let finish: ((blob: Blob) => void) | null = null;
const stop = vi.fn(() => finish?.(new Blob(['video'], { type: 'video/webm' })));
const startRecording = vi.fn(async () => ({
  stop,
  result: new Promise<Blob>((resolve) => (finish = resolve)),
}));
vi.mock('../src/capture/recorder', () => ({ isRecordingSupported: () => true, startRecording }));

const { FeedbackWidget } = await import('../src/widget');

const $ = <T extends Element>(selector: string) =>
  document.querySelector('[data-feedback-widget]')!.shadowRoot!.querySelector<T>(selector)!;

let widget: InstanceType<typeof FeedbackWidget> | null = null;
beforeEach(() => history.replaceState({}, '', '/app'));
afterEach(() => {
  widget?.destroy();
  widget = null;
  finish = null;
  vi.clearAllMocks();
});

async function startRecordingFlow(options = {}) {
  widget = new FeedbackWidget({ pages: { exclude: ['/checkout'] }, ...options });
  widget.open('bug');
  $<HTMLButtonElement>('button.fb-btn:nth-of-type(2)').click(); // "Record screen"
  await vi.waitFor(() => expect($<HTMLElement>('.fb-recording').hidden).toBe(false));
}

describe('recording is global', () => {
  it('keeps recording across route changes, even to pages where the widget is hidden', async () => {
    await startRecordingFlow();
    history.pushState({}, '', '/checkout');
    history.pushState({}, '', '/app/other');
    expect(widget!.isRecording).toBe(true);
    expect($<HTMLElement>('.fb-recording').hidden).toBe(false);
    expect(stop).not.toHaveBeenCalled();
  });

  it('brings the report back with the video when recording ends on an excluded page', async () => {
    await startRecordingFlow();
    history.pushState({}, '', '/checkout');
    $<HTMLButtonElement>('.fb-stop').click();
    await vi.waitFor(() => expect($('.fb-preview video')).not.toBeNull());
    expect(widget!.opened).toBe(true);
    expect($<HTMLElement>('.fb-panel').hidden).toBe(false);
  });

  it('is not cut short by hide()', async () => {
    await startRecordingFlow();
    widget!.hide();
    expect(widget!.isRecording).toBe(true);
    $<HTMLButtonElement>('.fb-stop').click();
    await vi.waitFor(() => expect($('.fb-preview video')).not.toBeNull());
  });

  it('asks before a full page unload while recording, and stops asking afterwards', async () => {
    await startRecordingFlow();
    const during = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(during);
    expect(during.defaultPrevented).toBe(true);

    $<HTMLButtonElement>('.fb-stop').click();
    await widget!.whenIdle();
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('logs tab switches and route changes in the recording timeline', async () => {
    const onSubmit = vi.fn<(p: FeedbackPayload) => void>();
    await startRecordingFlow({ onSubmit });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    history.pushState({}, '', '/app/next');
    $<HTMLButtonElement>('.fb-stop').click();
    await widget!.whenIdle();

    const textarea = $<HTMLTextAreaElement>('textarea');
    textarea.value = 'see video';
    textarea.dispatchEvent(new Event('input'));
    $<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const types = onSubmit.mock.calls[0][0].recordingEvents!.map((e) => (e.type === 'visibility' ? e.state : e.type));
    expect(types).toEqual(['navigation', 'hidden', 'visible', 'navigation']);
  });

  it('suggests window capture by default so switching tabs stays in the video', async () => {
    await startRecordingFlow();
    expect(startRecording).toHaveBeenCalledWith(expect.objectContaining({ surface: 'window' }));
  });
});
