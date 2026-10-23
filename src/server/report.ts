import type { Breadcrumb, FeedbackPayload, FeedbackType, NetworkEntry, RecordingEvent } from '../types';

/** A submission as received by the server: the JSON payload plus uploaded files. */
export interface ParsedFeedback {
  payload: Omit<FeedbackPayload, 'screenshot' | 'video'>;
  screenshot?: File;
  video?: File;
}

export interface ReportAttachment {
  filename: string;
  data: Blob;
}

export const TYPE_LABELS: Record<FeedbackType, string> = {
  feedback: 'Feedback',
  bug: 'Bug',
  suggestion: 'Suggestion',
};

export const TYPE_EMOJI: Record<FeedbackType, string> = {
  feedback: '💬',
  bug: '🐞',
  suggestion: '💡',
};

/** Reads the multipart body sent by the widget's `endpoint` option. Throws on a malformed request. */
export async function parseFeedback(request: Request): Promise<ParsedFeedback> {
  const form = await request.formData();
  const raw = form.get('payload');
  if (typeof raw !== 'string') throw new Error('Missing "payload" field');
  const payload = JSON.parse(raw) as ParsedFeedback['payload'];
  if (!payload || !(payload.type in TYPE_LABELS) || typeof payload.message !== 'string') {
    throw new Error('Invalid feedback payload');
  }
  const file = (name: string) => {
    const value = form.get(name);
    return value instanceof File && value.size > 0 ? value : undefined;
  };
  return { payload, screenshot: file('screenshot'), video: file('video') };
}

/** One-line title: `[Bug] First line of the message`. */
export function reportTitle(payload: ParsedFeedback['payload'], maxLength = 80): string {
  const firstLine = payload.message.split('\n')[0].trim();
  const text = firstLine.length > maxLength ? `${firstLine.slice(0, maxLength)}…` : firstLine;
  return `[${TYPE_LABELS[payload.type]}] ${text}`;
}

export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Turns the recording's event log into readable steps. Pointer movement is
 * left out and consecutive scrolls collapse into one step.
 */
export function describeSteps(events: RecordingEvent[] | undefined): string[] {
  if (!events) return [];
  const steps: string[] = [];
  let previous: RecordingEvent['type'] | null = null;
  for (const event of events) {
    if (event.type === 'pointer') continue;
    if (event.type === 'scroll' && previous === 'scroll') {
      steps[steps.length - 1] = steps[steps.length - 1].replace(/to y=\d+/, `to y=${event.y}`);
      continue;
    }
    previous = event.type;
    const at = formatTime(event.t);
    switch (event.type) {
      case 'click':
        steps.push(`${at} Clicked ${event.text ? `"${event.text}" ` : ''}(${event.target}) on ${event.path}`);
        break;
      case 'navigation':
        steps.push(`${at} ${steps.length === 0 ? 'Started on' : 'Navigated to'} ${event.url}`);
        break;
      case 'input':
        steps.push(`${at} Changed ${event.target}`);
        break;
      case 'scroll':
        steps.push(`${at} Scrolled to y=${event.y}`);
        break;
      case 'annotation':
        steps.push(`${at} Drew on the page`);
        break;
    }
  }
  return steps;
}

/** `10:42:07 Clicked "Export CSV" (button#export) on /dashboard · Dashboard` (times in UTC). */
export function describeBreadcrumb(crumb: Breadcrumb): string {
  const time = crumb.timestamp.slice(11, 19);
  const page = crumb.title ? `${crumb.path} · ${crumb.title}` : crumb.path;
  if (crumb.type === 'navigation') return `${time} Opened ${page}`;
  return `${time} Clicked ${crumb.text ? `"${crumb.text}" ` : ''}(${crumb.target}) on ${page}`;
}

/** API calls that failed: HTTP 4xx/5xx or no response at all. */
export function failedRequests(entries: NetworkEntry[] | undefined): NetworkEntry[] {
  return entries?.filter((entry) => !entry.ok) ?? [];
}

/** `POST https://api.acme.com/export → 500 (231 ms)` */
export function describeRequest(entry: NetworkEntry): string {
  const outcome = entry.status ? String(entry.status) : (entry.error ?? 'failed');
  return `${entry.method} ${entry.url} → ${outcome} (${entry.duration} ms)`;
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function reporterLine(payload: ParsedFeedback['payload']): string {
  const { user, email } = payload;
  const parts = [user?.name, email ?? user?.email, user?.id ? `id ${user.id}` : undefined].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Anonymous';
}

/** A Markdown description, used for ClickUp tasks (and handy for any tracker). */
export function reportMarkdown(feedback: ParsedFeedback): string {
  const { payload } = feedback;
  const { context } = payload;
  const lines = [
    payload.message,
    '',
    '## Reporter',
    reporterLine(payload),
    '',
    '## Environment',
    `- **Page:** ${context.title ? `${context.title} · ` : ''}${context.url}`,
    `- **Route:** ${context.path}${context.hash ?? ''}${
      context.query && Object.keys(context.query).length ? ` · query ${JSON.stringify(context.query)}` : ''
    }`,
    `- **Browser:** ${context.userAgent}`,
    `- **Viewport:** ${context.viewport.width}×${context.viewport.height} (screen ${context.screen.width}×${context.screen.height} @${context.screen.pixelRatio}x)`,
    `- **Language / timezone:** ${context.language} / ${context.timezone || 'unknown'}`,
    `- **Reported at:** ${context.timestamp}`,
  ];

  const steps = describeSteps(payload.recordingEvents);
  if (steps.length) {
    lines.push('', '## Steps recorded during the video', ...steps.map((step, i) => `${i + 1}. ${step}`));
  }

  if (payload.breadcrumbs?.length) {
    lines.push(
      '',
      '## User actions before the report (UTC)',
      ...payload.breadcrumbs.slice(-20).map((crumb) => `- ${describeBreadcrumb(crumb)}`),
    );
  }

  const problems = payload.consoleLogs?.filter((entry) => entry.level === 'error' || entry.level === 'warn') ?? [];
  if (problems.length) {
    lines.push(
      '',
      '## Console errors & warnings',
      '```',
      ...problems.slice(-15).map((entry) => `[${entry.level}] ${entry.message}`),
      '```',
    );
  }

  const failed = failedRequests(payload.networkLogs);
  if (failed.length) {
    lines.push('', '## Failed API calls', ...failed.slice(-15).map((entry) => `- \`${describeRequest(entry)}\``));
    const withBody = failed.filter((entry) => entry.responseBody).slice(-3);
    for (const entry of withBody) {
      lines.push('', `Response of \`${entry.method} ${entry.url}\`:`, '```', entry.responseBody!, '```');
    }
  }

  const consoleCount = payload.consoleLogs?.length ?? 0;
  const networkCount = payload.networkLogs?.length ?? 0;
  if (consoleCount || networkCount) {
    lines.push(
      '',
      `_Captured ${plural(consoleCount, 'console message')} and ${plural(networkCount, 'API call')} (${failed.length} failed); the full logs are in feedback-details.json._`,
    );
  }

  if (payload.metadata && Object.keys(payload.metadata).length) {
    lines.push('', '## Metadata', '```json', JSON.stringify(payload.metadata, null, 2), '```');
  }

  const attached = [feedback.screenshot && 'screenshot', feedback.video && 'screen recording'].filter(Boolean);
  if (attached.length) lines.push('', `_Attached: ${attached.join(', ')}._`);
  return lines.join('\n');
}

/** Files to upload: screenshot, video, and a JSON file with the full console log, API calls and recording events. */
export function reportAttachments(feedback: ParsedFeedback): ReportAttachment[] {
  const files: ReportAttachment[] = [];
  if (feedback.screenshot) files.push({ filename: feedback.screenshot.name || 'screenshot.png', data: feedback.screenshot });
  if (feedback.video) files.push({ filename: feedback.video.name || 'recording.webm', data: feedback.video });
  const { consoleLogs, networkLogs, breadcrumbs, recordingEvents, context } = feedback.payload;
  if (consoleLogs?.length || networkLogs?.length || breadcrumbs?.length || recordingEvents?.length) {
    const details = { context, breadcrumbs, consoleLogs, networkLogs, recordingEvents };
    files.push({
      filename: 'feedback-details.json',
      data: new Blob([JSON.stringify(details, null, 2)], {
        type: 'application/json',
      }),
    });
  }
  return files;
}
