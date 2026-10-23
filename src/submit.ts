import type { FeedbackPayload } from './types';

function videoExtension(blob: Blob): string {
  return blob.type.includes('mp4') ? 'mp4' : 'webm';
}

/** Serializes a payload as multipart/form-data: `payload` (JSON), `screenshot` and `video` files. */
export function toFormData(payload: FeedbackPayload): FormData {
  const { screenshot, video, ...rest } = payload;
  const form = new FormData();
  form.append('payload', JSON.stringify(rest));
  if (screenshot) form.append('screenshot', screenshot, 'screenshot.png');
  if (video) form.append('video', video, `recording.${videoExtension(video)}`);
  return form;
}

export async function postFeedback(
  endpoint: string,
  payload: FeedbackPayload,
  headers: Record<string, string> = {},
): Promise<void> {
  const response = await fetch(endpoint, { method: 'POST', body: toFormData(payload), headers });
  if (!response.ok) {
    throw new Error(`Feedback submission failed with status ${response.status}`);
  }
}
