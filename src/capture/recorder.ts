export type RecordingSurface = 'tab' | 'window' | 'screen';

export interface RecordingOptions {
  /** Stop automatically after this many seconds. */
  maxSeconds: number;
  /** What the browser's share picker suggests first. The user can still pick anything. */
  surface: RecordingSurface;
  /** Called whenever the elapsed whole seconds change. */
  onTick?: (seconds: number) => void;
}

export interface Recording {
  /** Stops the recording; `result` then resolves. */
  stop(): void;
  /** Resolves with the video once recording stops (via `stop()`, the time limit, or the browser's "Stop sharing" button). */
  result: Promise<Blob>;
}

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

const DISPLAY_SURFACE: Record<RecordingSurface, string> = {
  tab: 'browser',
  window: 'window',
  screen: 'monitor',
};

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

/**
 * Asks the user to share their screen and records it, with tab/system audio
 * when the browser offers it. Rejects if the user cancels the prompt.
 *
 * Recording keeps going when the user switches tabs or the app changes route:
 * with `window` or `screen` the video follows them to other tabs, and with
 * `tab` Chrome offers "Share this tab instead" to move the capture.
 */
export async function startRecording(options: RecordingOptions): Promise<Recording> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: DISPLAY_SURFACE[options.surface], frameRate: 30, cursor: 'always' },
    audio: true,
    // Restricting the picker to this tab would rule out following the user to other tabs.
    preferCurrentTab: options.surface === 'tab',
    selfBrowserSurface: 'include',
    surfaceSwitching: 'include',
    systemAudio: 'include',
    monitorTypeSurfaces: 'include',
  } as DisplayMediaStreamOptions);

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];

  // Browsers throttle timers in background tabs, so time is measured, not counted.
  const startedAt = Date.now();
  let lastSecond = 0;
  const tick = () => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    if (seconds !== lastSecond) {
      lastSecond = seconds;
      options.onTick?.(seconds);
    }
    if (seconds >= options.maxSeconds) stop();
  };
  const ticker = setInterval(tick, 250);
  const limit = setTimeout(stop, options.maxSeconds * 1000);
  document.addEventListener('visibilitychange', tick);

  function stop() {
    clearInterval(ticker);
    clearTimeout(limit);
    document.removeEventListener('visibilitychange', tick);
    if (recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
  }

  const result = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }));
    recorder.onerror = (event) => {
      stop();
      reject((event as ErrorEvent).error ?? new Error('Recording failed'));
    };
  });

  // The browser's own "Stop sharing" button ends the video track.
  stream.getVideoTracks()[0]?.addEventListener('ended', stop);
  recorder.start(1000);

  return { stop, result };
}
