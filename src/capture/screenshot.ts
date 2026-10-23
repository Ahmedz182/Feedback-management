import { toCanvas } from 'html-to-image';

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode screenshot'))), 'image/png'),
  );
}

function pageBackground(): string {
  for (const el of [document.body, document.documentElement]) {
    const color = getComputedStyle(el).backgroundColor;
    if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color;
  }
  return '#ffffff';
}

/**
 * Renders the visible part of the page to a PNG without any permission prompt.
 * `exclude` (the widget's own host element) is left out of the image.
 */
export async function captureDom(exclude?: Element): Promise<Blob> {
  const canvas = await toCanvas(document.documentElement, {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    backgroundColor: pageBackground(),
    imagePlaceholder: TRANSPARENT_PIXEL,
    filter: (node) => node !== exclude,
    style: {
      transform: `translate(${-window.scrollX}px, ${-window.scrollY}px)`,
      transformOrigin: 'top left',
    },
  });
  return canvasToBlob(canvas);
}

export function isDisplayCaptureSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;
}

/**
 * Takes a pixel-perfect screenshot through the browser's screen-capture prompt
 * (the user picks the tab/window/screen). Throws if the user cancels.
 */
export async function captureDisplay(): Promise<Blob> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser' },
    audio: false,
    preferCurrentTab: true,
  } as DisplayMediaStreamOptions);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    // Give the browser time to remove its "choose what to share" UI from the frame.
    await new Promise((resolve) => setTimeout(resolve, 400));
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    return await canvasToBlob(canvas);
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}
