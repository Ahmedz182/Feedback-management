import { createClickUpTask, type ClickUpOptions, type ClickUpResult } from './clickup';
import { parseFeedback, type ParsedFeedback } from './report';
import { sendToSlack, type SlackOptions, type SlackResult } from './slack';

export { createClickUpTask, sendToSlack, parseFeedback };
export { reportFacts, describeBreadcrumb, describeRequest, describeSteps, failedRequests, reportAttachments, reportMarkdown, reportTitle } from './report';
export { slackBlocks } from './slack';
export type { ClickUpOptions, ClickUpResult, ParsedFeedback, SlackOptions, SlackResult };
export type * from '../types';

export interface FeedbackHandlerOptions {
  slack?: SlackOptions;
  clickup?: ClickUpOptions;
  /** Your own handling: save to a database, forward elsewhere… Runs alongside the integrations. */
  onFeedback?: (feedback: ParsedFeedback) => unknown | Promise<unknown>;
  /** Called with each integration that fails. Default: `console.error`. */
  onError?: (error: unknown, destination: string) => void;
  /** Origins allowed to submit when the widget runs on another domain, or `'*'`. Default: same origin only. */
  allowedOrigins?: string[] | '*';
}

export interface FeedbackHandlerResult {
  slack?: SlackResult;
  clickup?: ClickUpResult;
  errors: string[];
}

function corsHeaders(request: Request, allowed: FeedbackHandlerOptions['allowedOrigins']): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!allowed || !origin) return {};
  if (allowed !== '*' && !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': allowed === '*' ? '*' : origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    Vary: 'Origin',
  };
}

/**
 * A fetch-style handler (`Request` → `Response`) that receives the widget's
 * submissions and forwards them to Slack, ClickUp and/or your own callback.
 * Use it directly as a Next.js route handler, or with `toNodeHandler()` for Express.
 *
 * Responds 201 if at least one destination succeeded, so the user is never
 * asked to resend a report that was already delivered somewhere.
 */
export function createFeedbackHandler(options: FeedbackHandlerOptions) {
  const onError = options.onError ?? ((error, destination) => console.error(`[feedback] ${destination} failed:`, error));

  return async function handleFeedback(request: Request): Promise<Response> {
    const cors = corsHeaders(request, options.allowedOrigins);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

    let feedback: ParsedFeedback;
    try {
      feedback = await parseFeedback(request);
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 400, headers: cors });
    }

    const tasks: [string, Promise<unknown>][] = [];
    if (options.slack) tasks.push(['slack', sendToSlack(feedback, options.slack)]);
    if (options.clickup) tasks.push(['clickup', createClickUpTask(feedback, options.clickup)]);
    if (options.onFeedback) tasks.push(['onFeedback', Promise.resolve().then(() => options.onFeedback!(feedback))]);

    const settled = await Promise.allSettled(tasks.map(([, task]) => task));
    const result: FeedbackHandlerResult = { errors: [] };
    settled.forEach((outcome, i) => {
      const destination = tasks[i][0];
      if (outcome.status === 'rejected') {
        onError(outcome.reason, destination);
        result.errors.push(destination);
      } else if (destination === 'slack') {
        result.slack = outcome.value as SlackResult;
      } else if (destination === 'clickup') {
        result.clickup = outcome.value as ClickUpResult;
      }
    });

    const delivered = tasks.length === 0 || result.errors.length < tasks.length;
    return Response.json(result, { status: delivered ? 201 : 502, headers: cors });
  };
}

/** The parts of Node's `IncomingMessage` the adapter needs (Express `req` works too). */
interface NodeRequest extends AsyncIterable<unknown> {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

/** The parts of Node's `ServerResponse` the adapter needs (Express `res` works too). */
interface NodeResponse {
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(body?: Uint8Array): unknown;
}

/**
 * Adapts a fetch-style handler to Node's `(req, res)` signature for Express,
 * Fastify (raw), Koa or `http.createServer`. Mount it before any middleware
 * that consumes multipart bodies.
 */
export function toNodeHandler(handler: (request: Request) => Promise<Response>) {
  return async (req: NodeRequest, res: NodeResponse): Promise<void> => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
      else if (value !== undefined) headers.set(key, value);
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(`http://${headers.get('host') ?? 'localhost'}${req.url ?? '/'}`, {
      method: req.method,
      headers,
      body: hasBody ? (req as unknown as BodyInit) : undefined,
      duplex: 'half',
    } as RequestInit);
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(new Uint8Array(await response.arrayBuffer()));
  };
}
