# feedback-management

A drop-in feedback widget for web apps, similar to [Userback](https://userback.io/). Users can send **feedback**, report **bugs** and make **suggestions**, and attach an **annotated screenshot** or a **screen recording**. Reports can go straight to **Slack** and **ClickUp**.

You set it up once and it works across your whole app, or only on the pages you choose. It works with React, Next.js, Vue, Angular, Svelte, or a plain `<script>` tag.

<p align="center">
  <img src="docs/images/hero.png" alt="A floating Feedback button in the corner of a web app" width="820">
</p>

- 💬 Three report types: **Feedback**, **Bug** and **Suggestion** (offer all three, or only the ones you want)
- 📸 Screenshots with no permission prompt, plus an editor to draw, highlight, and **black out sensitive data**
- 🎥 Screen recording that captures the **cursor and clicks**, lets users **draw on the page while recording**, and logs every click, scroll and page change as **timestamped steps**
- 🔌 Server-side integrations for **Slack** (message + files in thread) and **ClickUp** (task + attachments)
- 🧭 Page targeting with `include`/`exclude` globs that follow SPA route changes automatically
- 🧾 Context captured automatically: URL, browser, viewport, timezone, recent console logs and errors, your user and metadata
- 🎨 Accent color, light/dark/auto theme, position, and every text label can be customized
- 🧱 Styles live in a Shadow DOM, so your CSS can't break the widget and the widget can't break your CSS
- 📦 One small dependency (`html-to-image`), typed, ESM + CJS + CDN builds, safe under SSR

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/images/panel.png" alt="Feedback panel with Feedback, Bug and Suggestion types"></td>
    <td width="50%"><img src="docs/images/panel-dark.png" alt="The same panel in dark mode"></td>
  </tr>
  <tr>
    <td align="center"><b>Pick a type and describe it</b></td>
    <td align="center"><b>Dark mode</b> (<code>theme: 'auto'</code> follows the OS)</td>
  </tr>
</table>

**Annotate screenshots:** draw, highlight an area, or black out sensitive data before attaching.

<img src="docs/images/annotate.png" alt="Screenshot editor with a highlight box, a hand-drawn circle and a redacted area" width="820">

**Record the screen:** the video shows a cursor halo and click ripples. Users can switch on the pen and draw on the page while recording (the circle around *Export CSV* below), then switch it off to keep clicking.

<img src="docs/images/recording.png" alt="Recording in progress: toolbar with timer, pen, eraser and stop; a red circle drawn around a button; a highlighted cursor" width="820">

<table>
  <tr>
    <td width="40%"><img src="docs/images/attachments.png" alt="Panel with a screenshot and a recording attached"></td>
    <td width="30%"><img src="docs/images/success.png" alt="Confirmation after sending"></td>
    <td width="30%"><img src="docs/images/mobile.png" alt="The panel on a phone"></td>
  </tr>
  <tr>
    <td align="center"><b>Attachments preview</b></td>
    <td align="center"><b>Sent</b></td>
    <td align="center"><b>Mobile</b></td>
  </tr>
</table>

## Install

```bash
npm install feedback-management
```

## Quick start

Call `init()` **once** when your app starts:

```js
import { init } from 'feedback-management';

init({
  endpoint: '/api/feedback', // POST target (multipart/form-data), or use onSubmit
  user: { id: '42', email: 'jane@acme.com', name: 'Jane' },
  metadata: { appVersion: '2.3.0' },
});
```

A floating **Feedback** button now appears on every page.

### React

```jsx
import { FeedbackProvider, useFeedback } from 'feedback-management/react';

export function App() {
  return (
    <FeedbackProvider endpoint="/api/feedback" user={currentUser} pages={{ exclude: ['/checkout'] }}>
      <Routes />
    </FeedbackProvider>
  );
}

// Open the widget from any component:
function HelpMenu() {
  const feedback = useFeedback();
  return <button onClick={() => feedback.open('bug')}>Report a bug</button>;
}
```

To hide the button while a specific component is mounted, render `<HideFeedback />` inside it.

### Next.js (App Router)

The React entry is already marked `'use client'`, so you can use it directly in your root layout:

```tsx
// app/layout.tsx
import { FeedbackProvider } from 'feedback-management/react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <FeedbackProvider endpoint="/api/feedback">{children}</FeedbackProvider>
      </body>
    </html>
  );
}
```

Function props such as `onSubmit` can't be passed from a Server Component. If you need them, wrap the provider in your own `'use client'` component.

### Vue / Angular / Svelte / anything else

Call `init()` once in your entry file (`main.ts`). Use `open()`, `close()` and `identify()` anywhere:

```ts
import { init, open, identify } from 'feedback-management';

init({ endpoint: '/api/feedback' });
// after login:
identify({ id: user.id, email: user.email });
```

### Plain HTML / CDN

```html
<script src="https://unpkg.com/feedback-management/dist/feedback-widget.global.js"></script>
<script>
  FeedbackWidget.init({ endpoint: '/api/feedback' });
</script>
```

## Choosing pages

```js
init({
  pages: {
    include: ['/app/**', '/settings/*'], // show only here (omit = every page)
    exclude: ['/app/checkout', /\/admin/], // never show here (takes precedence)
  },
});
```

| Rule | Matches |
| --- | --- |
| `'/pricing'` | exactly `/pricing` (a trailing slash is ignored) |
| `'/users/*'` | `/users/42`, but not `/users/42/edit` |
| `'/docs/**'` | `/docs`, `/docs/a`, `/docs/a/b/c` |
| `'https://app.acme.com/**'` | full-URL match (useful when several hosts share one bundle) |
| `/^\/beta/` | a RegExp, tested against the pathname and the full URL |
| `(url) => url.searchParams.has('debug')` | any custom logic |

The widget listens to `pushState`, `replaceState`, `popstate` and `hashchange`, so it updates on client-side navigation in React Router, Next.js, Vue Router and other routers. You don't need to wire anything up.

`open()` called from your own code works on every page. The `pages` rules only control the floating button.

## Recording: drawing and mouse tracking

When a user records their screen:

- **Cursor and clicks are visible in the video.** A yellow halo follows the pointer and every click shows a red ripple, so reviewers can see exactly what was clicked.
- **Users can draw on the page while recording.** The ✏️ button in the recording toolbar turns on a pen, the eraser clears the drawings, and <kbd>Esc</kbd> or the ✏️ button switches back to normal clicking. Drawings are part of the video.
- **Every interaction is logged** with its time offset in the video and sent as `recordingEvents`:

```jsonc
[
  { "type": "navigation", "t": 0,    "url": "https://app.acme.com/" },
  { "type": "pointer",    "t": 140,  "x": 512, "y": 300 },
  { "type": "click",      "t": 318,  "x": 1018, "y": 326, "target": "button#export", "text": "Export CSV" },
  { "type": "navigation", "t": 365,  "url": "https://app.acme.com/reports" },
  { "type": "scroll",     "t": 900,  "x": 0, "y": 400 },
  { "type": "input",      "t": 1200, "target": "input#email" },
  { "type": "annotation", "t": 1814, "points": [[1100, 326], [1095, 340]] }
]
```

The Slack and ClickUp integrations turn this log into readable **steps to reproduce** (`0:01 Clicked "Export CSV" (button#export)`).

Privacy: what users type is never recorded. `input` events contain only the element, never its value, and click labels come only from buttons, links and similar controls. The widget's own clicks are ignored.

Each of these can be turned off: `features: { cursorHighlight: false, recordingDrawing: false, interactionLog: false }`.

## Receiving feedback

### Option 1: `endpoint`

The widget `POST`s `multipart/form-data` with these fields:

| Field | Content |
| --- | --- |
| `payload` | JSON: `type`, `message`, `email`, `user`, `metadata`, `context`, `consoleLogs`, `recordingEvents` |
| `screenshot` | `screenshot.png` (if attached) |
| `video` | `recording.webm` or `recording.mp4` (if attached) |

Any non-2xx response shows an error in the widget, and the user's message is kept so they can try again. To send auth headers, use `headers: { Authorization: 'Bearer …' }` or pass a function.

Express + multer example:

```js
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });

app.post('/api/feedback', upload.fields([{ name: 'screenshot' }, { name: 'video' }]), (req, res) => {
  const payload = JSON.parse(req.body.payload);
  const screenshot = req.files.screenshot?.[0];
  const video = req.files.video?.[0];
  // save to your DB, create a Jira/Linear/GitHub issue, post to Slack…
  res.sendStatus(201);
});
```

Next.js route handler:

```ts
// app/api/feedback/route.ts
export async function POST(request: Request) {
  const form = await request.formData();
  const payload = JSON.parse(form.get('payload') as string);
  const screenshot = form.get('screenshot') as File | null;
  const video = form.get('video') as File | null;
  // …store them
  return new Response(null, { status: 201 });
}
```

[`examples/server/index.mjs`](examples/server/index.mjs) is a complete backend with no dependencies. It saves reports to disk and forwards them to Slack/ClickUp when their environment variables are set.

### Option 2: `onSubmit`

```js
init({
  async onSubmit(payload) {
    // payload.screenshot and payload.video are Blobs
    await myApi.createTicket(payload);
  },
});
```

If `onSubmit` throws, the widget shows an error. If you set both options, `onSubmit` runs first and then the POST is sent.

## Slack and ClickUp integrations

`feedback-management/server` receives the widget's submissions on **your** server and forwards them. It runs server-side because Slack and ClickUp tokens must never be shipped to the browser, and neither API accepts calls from a web page anyway.

```ts
// app/api/feedback/route.ts (Next.js App Router)
import { createFeedbackHandler } from 'feedback-management/server';

export const POST = createFeedbackHandler({
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN!, // xoxb-…
    channel: 'C0123456789',
    channelByType: { bug: 'C0BUGS00000' },   // optional: bugs to their own channel
  },
  clickup: {
    token: process.env.CLICKUP_TOKEN!,       // pk_…
    listId: '901234567',
    listByType: { bug: '901234999' },        // optional: bugs into the engineering backlog
    priority: { bug: 2 },                    // 1 urgent · 2 high · 3 normal · 4 low
    assignees: [12345678],
  },
  onFeedback: async (feedback) => db.feedback.create({ data: feedback.payload }), // optional
});
```

The widget then only needs `init({ endpoint: '/api/feedback' })`.

**Express / Node:**

```js
import { createFeedbackHandler, toNodeHandler } from 'feedback-management/server';

const handler = createFeedbackHandler({ slack: { webhookUrl: process.env.SLACK_WEBHOOK_URL } });
app.post('/api/feedback', toNodeHandler(handler)); // mount before any multipart body parser
```

`createFeedbackHandler` returns a standard `(Request) => Response` function, so it also works in Remix, Hono, Bun, Deno and Cloudflare Workers.

### What gets created

| | Slack | ClickUp |
| --- | --- | --- |
| Title | `🐞 [Bug] First line of the message` | Task name `[Bug] First line of the message` |
| Body | Message, reporter, page link, browser, recorded steps, console errors | Markdown description: message, reporter, environment, recorded steps, console errors & warnings, metadata |
| Files | Screenshot, video and `feedback-details.json` uploaded into the message thread (bot token only) | Screenshot, video and `feedback-details.json` as task attachments |
| Routing | `channelByType` | `listByType`, `priority`, `tags`, `assignees`, `status` |

### Slack setup

- **Quickest:** create an [incoming webhook](https://api.slack.com/messaging/webhooks) and pass `{ webhookUrl }`. This posts the message only, because webhooks can't upload files.
- **With attachments:** create a Slack app with the `chat:write` and `files:write` bot scopes, install it, invite the bot to the channel (`/invite @YourApp`), and pass `{ botToken, channel }`, where `channel` is the channel ID.

### ClickUp setup

1. Generate a personal API token in ClickUp under **Settings → Apps** (it starts with `pk_`).
2. Open the list where tasks should go. The list ID is the number after `/li/` in its URL.
3. Pass `{ token, listId }`.

### Behaviour

- Slack, ClickUp and `onFeedback` run in parallel.
- The handler responds `201` if **at least one** destination succeeded, so users aren't asked to resend a report that was already delivered. It responds `502` if all of them failed.
- Each failure is passed to `onError(error, destination)` (default: `console.error`), and the response body lists the destinations that failed.
- If the widget runs on a different domain from your API, set `allowedOrigins: ['https://app.acme.com']`.

You can also use the pieces on their own: `parseFeedback(request)`, `sendToSlack(feedback, options)`, `createClickUpTask(feedback, options)`, `reportMarkdown(feedback)` and `describeSteps(events)`.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `endpoint` | `string` | — | URL to POST submissions to |
| `headers` | `object \| () => object` | — | Extra request headers |
| `onSubmit` | `(payload) => void \| Promise` | — | Handle submissions yourself |
| `onOpen` / `onClose` / `onError` | functions | — | Lifecycle hooks |
| `pages` | `{ include?, exclude? }` | all pages | Where the button is shown |
| `types` | `('feedback' \| 'bug' \| 'suggestion')[]` | `['feedback', 'bug', 'suggestion']` | Types offered, in order |
| `features.screenshot` | `boolean` | `true` | Allow screenshots |
| `features.video` | `boolean` | `true` | Allow screen recording |
| `features.email` | `boolean` | `true` | Ask for an email when `user.email` is unknown |
| `features.consoleLogs` | `boolean` | `true` | Attach the last 50 console messages and errors |
| `features.cursorHighlight` | `boolean` | `true` | Cursor halo and click ripples in recordings |
| `features.recordingDrawing` | `boolean` | `true` | Pen for drawing on the page while recording |
| `features.interactionLog` | `boolean` | `true` | Send `recordingEvents` (pointer, clicks, scroll, navigation, drawings) |
| `screenshotMode` | `'dom' \| 'display'` | `'dom'` | `dom` renders the page silently. `display` uses the browser's share prompt for pixel-perfect captures of canvas, video and cross-origin iframes |
| `maxRecordingSeconds` | `number` | `120` | Recording time limit |
| `user` | `{ id?, email?, name?, … }` | — | Attached to every report |
| `metadata` | `object \| () => object` | — | Attached to every report (resolved when the report is submitted) |
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Button and panel position |
| `primaryColor` | CSS color | `#4f46e5` | Accent color |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` | `auto` follows the operating system |
| `zIndex` | `number` | `2147483000` | Stacking order |
| `hideLauncher` | `boolean` | `false` | Hide the floating button and open the widget with your own UI |
| `labels` | `Partial<FeedbackLabels>` | English | Override any text, for example to translate it |

## API

```ts
const widget = init(options); // or new FeedbackWidget(options)

widget.open('bug');        // open the panel, optionally preselecting a type
widget.close();
widget.toggle();
widget.hide();             // hide the button (e.g. during onboarding)
widget.show();
widget.identify(user);     // set or clear the current user
widget.setMetadata(meta);
widget.update(options);    // change any option at runtime; keeps the user's draft
widget.destroy();          // remove the widget and restore console/history patches
```

The module-level `open`, `close`, `identify`, `destroy` and `getInstance` functions act on the instance created by `init()`.

## Browser support

- **Feedback form and screenshots:** all modern browsers.
- **Screen recording:** desktop Chrome, Edge, Firefox and Safari 13+, using `getDisplayMedia` and `MediaRecorder`. Where recording isn't supported (for example on most mobile browsers), the *Record screen* button is hidden automatically.
- **DOM screenshots:** cross-origin images without CORS headers render as blank. Use `screenshotMode: 'display'` if you need exact pixels.

## Development

```bash
npm install
npm test           # unit tests (vitest + jsdom)
npm run typecheck
npm run build      # dist/: ESM, CJS, .d.ts, and the CDN build
npm run example    # demo app + backend at http://localhost:3000
                   # forwards to Slack/ClickUp when SLACK_WEBHOOK_URL, SLACK_BOT_TOKEN + SLACK_CHANNEL,
                   # or CLICKUP_TOKEN + CLICKUP_LIST_ID are set
```

## License

MIT
