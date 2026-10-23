import type { FeedbackType } from '../types';
import {
  describeBreadcrumb,
  describeRequest,
  describeSteps,
  failedRequests,
  reportAttachments,
  reportTitle,
  TYPE_EMOJI,
  type ParsedFeedback,
} from './report';

export type SlackOptions =
  | {
      /** Incoming webhook URL. Posts a text message only; Slack webhooks can't carry files. */
      webhookUrl: string;
    }
  | {
      /** Bot token (`xoxb-…`) with `chat:write` and `files:write` scopes. Uploads attachments into the message thread. */
      botToken: string;
      /** Channel ID (e.g. `C0123456789`). The bot must be a member. */
      channel: string;
      /** Post to a different channel per feedback type. */
      channelByType?: Partial<Record<FeedbackType, string>>;
    };

export interface SlackResult {
  channel?: string;
  ts?: string;
}

const SLACK_API = 'https://slack.com/api';
const MAX_SECTION = 2900;

/** Escapes text for Slack mrkdwn. */
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (text: string, max = MAX_SECTION) => (text.length > max ? `${text.slice(0, max)}…` : text);

/** Slack Block Kit blocks for a report. */
export function slackBlocks(feedback: ParsedFeedback): unknown[] {
  const { payload } = feedback;
  const { context, user } = payload;
  const reporter = [user?.name, payload.email ?? user?.email].filter(Boolean).join(' · ') || 'Anonymous';
  const blocks: unknown[] = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: clip(`*${TYPE_EMOJI[payload.type]} ${esc(reportTitle(payload))}*\n\n${esc(payload.message)}`) },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `👤 ${esc(reporter)}` },
        { type: 'mrkdwn', text: `🔗 <${context.url}|${esc(context.path || context.url)}>` },
        { type: 'mrkdwn', text: `🖥 ${context.viewport.width}×${context.viewport.height} · ${esc(context.userAgent.slice(0, 120))}` },
      ],
    },
  ];
  const steps = describeSteps(payload.recordingEvents);
  if (steps.length) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: clip(`*Steps recorded during the video*\n${steps.map((s, i) => `${i + 1}. ${esc(s)}`).join('\n')}`) },
    });
  } else if (payload.breadcrumbs?.length) {
    const recent = payload.breadcrumbs.slice(-8).map((crumb) => `• ${esc(describeBreadcrumb(crumb))}`);
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: clip(`*Last actions before the report (UTC)*\n${recent.join('\n')}`) },
    });
  }
  const errors = payload.consoleLogs?.filter((entry) => entry.level === 'error') ?? [];
  if (errors.length) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: clip(`*Console errors (${errors.length})*\n\`\`\`${esc(errors.slice(-5).map((e) => e.message).join('\n'))}\`\`\``) },
    });
  }
  const failed = failedRequests(payload.networkLogs);
  if (failed.length) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: clip(`*Failed API calls (${failed.length})*\n\`\`\`${esc(failed.slice(-8).map(describeRequest).join('\n'))}\`\`\``) },
    });
  }
  return blocks;
}

async function slackApi<T>(method: string, token: string, body: Record<string, unknown>, form = false): Promise<T> {
  const response = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json; charset=utf-8',
    },
    body: form
      ? new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]))
      : JSON.stringify(body),
  });
  const json = (await response.json()) as { ok: boolean; error?: string } & T;
  if (!json.ok) throw new Error(`Slack ${method} failed: ${json.error ?? response.status}`);
  return json;
}

/** Posts a report to Slack. With a bot token, the screenshot, video and details file are uploaded into the thread. */
export async function sendToSlack(feedback: ParsedFeedback, options: SlackOptions): Promise<SlackResult> {
  const text = reportTitle(feedback.payload);
  const blocks = slackBlocks(feedback);

  if ('webhookUrl' in options) {
    const response = await fetch(options.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    });
    if (!response.ok) throw new Error(`Slack webhook failed with status ${response.status}`);
    return {};
  }

  const { botToken } = options;
  const channel = options.channelByType?.[feedback.payload.type] ?? options.channel;
  const message = await slackApi<{ channel: string; ts: string }>('chat.postMessage', botToken, {
    channel,
    text,
    blocks,
    unfurl_links: false,
  });

  const files = reportAttachments(feedback);
  if (files.length) {
    const uploaded: { id: string; title: string }[] = [];
    for (const file of files) {
      const { upload_url, file_id } = await slackApi<{ upload_url: string; file_id: string }>(
        'files.getUploadURLExternal',
        botToken,
        { filename: file.filename, length: file.data.size },
        true,
      );
      const upload = await fetch(upload_url, { method: 'POST', body: file.data });
      if (!upload.ok) throw new Error(`Slack file upload failed with status ${upload.status}`);
      uploaded.push({ id: file_id, title: file.filename });
    }
    await slackApi('files.completeUploadExternal', botToken, {
      files: uploaded,
      channel_id: message.channel,
      thread_ts: message.ts,
    });
  }
  return { channel: message.channel, ts: message.ts };
}
