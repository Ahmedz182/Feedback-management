import type { FeedbackType } from '../types';
import { reportAttachments, reportMarkdown, reportTitle, type ParsedFeedback } from './report';

export interface ClickUpOptions {
  /** Personal API token (`pk_…`) or OAuth access token. */
  token: string;
  /** List the tasks are created in. */
  listId: string;
  /** Use a different list per feedback type, e.g. bugs into the engineering backlog. */
  listByType?: Partial<Record<FeedbackType, string>>;
  /** ClickUp priority per type: 1 urgent, 2 high, 3 normal, 4 low. */
  priority?: Partial<Record<FeedbackType, 1 | 2 | 3 | 4>>;
  /** Tags added to every task, in addition to the feedback type. Default `['feedback-widget']`. */
  tags?: string[];
  /** ClickUp user IDs to assign. */
  assignees?: number[];
  /** Initial status name; the list's default status when omitted. */
  status?: string;
}

export interface ClickUpResult {
  id: string;
  url: string;
}

const CLICKUP_API = 'https://api.clickup.com/api/v2';

/** Creates a ClickUp task for a report and uploads the screenshot, video and details file as attachments. */
export async function createClickUpTask(feedback: ParsedFeedback, options: ClickUpOptions): Promise<ClickUpResult> {
  const { type } = feedback.payload;
  const listId = options.listByType?.[type] ?? options.listId;
  const body: Record<string, unknown> = {
    name: reportTitle(feedback.payload, 120),
    markdown_content: reportMarkdown(feedback),
    tags: [type, ...(options.tags ?? ['feedback-widget'])],
  };
  const priority = options.priority?.[type];
  if (priority) body.priority = priority;
  if (options.assignees?.length) body.assignees = options.assignees;
  if (options.status) body.status = options.status;

  const response = await fetch(`${CLICKUP_API}/list/${encodeURIComponent(listId)}/task`, {
    method: 'POST',
    headers: { Authorization: options.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`ClickUp task creation failed with status ${response.status}: ${await response.text()}`);
  }
  const task = (await response.json()) as ClickUpResult;

  for (const file of reportAttachments(feedback)) {
    const form = new FormData();
    form.append('attachment', file.data, file.filename);
    const upload = await fetch(`${CLICKUP_API}/task/${encodeURIComponent(task.id)}/attachment`, {
      method: 'POST',
      headers: { Authorization: options.token },
      body: form,
    });
    if (!upload.ok) throw new Error(`ClickUp attachment upload failed with status ${upload.status}`);
  }
  return { id: task.id, url: task.url };
}
