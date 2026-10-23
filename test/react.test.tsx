import { act, render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider, HideFeedback, useFeedback } from '../src/react';

const shadow = () => document.querySelector('[data-feedback-widget]')?.shadowRoot ?? null;

afterEach(cleanup);

describe('React bindings', () => {
  it('mounts once and exposes controls through useFeedback()', () => {
    let api: ReturnType<typeof useFeedback> | null = null;
    function Probe() {
      api = useFeedback();
      return null;
    }
    render(
      <FeedbackProvider onSubmit={() => {}}>
        <Probe />
      </FeedbackProvider>,
    );
    expect(document.querySelectorAll('[data-feedback-widget]')).toHaveLength(1);
    act(() => api!.open('bug'));
    expect(api!.widget?.opened).toBe(true);
  });

  it('applies prop changes without remounting and calls the latest callbacks', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<FeedbackProvider onSubmit={first} labels={{ title: 'A' }} />);
    const host = document.querySelector('[data-feedback-widget]');
    rerender(<FeedbackProvider onSubmit={second} labels={{ title: 'B' }} />);
    expect(document.querySelector('[data-feedback-widget]')).toBe(host);
    expect(shadow()!.querySelector('h2')!.textContent).toBe('B');

    const root = shadow()!;
    const textarea = root.querySelector('textarea')!;
    textarea.value = 'hi';
    textarea.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(second).toHaveBeenCalledOnce());
    expect(first).not.toHaveBeenCalled();
  });

  it('hides the launcher while <HideFeedback /> is mounted', () => {
    const { rerender } = render(
      <FeedbackProvider>
        <HideFeedback />
      </FeedbackProvider>,
    );
    const launcher = () => shadow()!.querySelector<HTMLButtonElement>('.fb-launcher')!;
    expect(launcher().hidden).toBe(true);
    rerender(<FeedbackProvider />);
    expect(launcher().hidden).toBe(false);
  });

  it('cleans up on unmount', () => {
    const { unmount } = render(<FeedbackProvider />);
    unmount();
    expect(document.querySelector('[data-feedback-widget]')).toBeNull();
  });
});
