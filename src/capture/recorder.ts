export interface RecordingOptions {
  /** Stop automatically after this many seconds. */
  maxSeconds: number;
  /** Called every second with elapsed seconds. */
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
 */
export async function startRecording(options: RecordingOptions): Promise<Recording> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser', frameRate: 30, cursor: 'always' },
    audio: true,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
  } as DisplayMediaStreamOptions);

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  let seconds = 0;

  const ticker = setInterval(() => {
    seconds += 1;
    options.onTick?.(seconds);
    if (seconds >= options.maxSeconds) stop();
  }, 1000);

  function stop() {
    clearInterval(ticker);
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
