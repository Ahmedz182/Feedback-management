# feedback-management

A drop-in feedback widget for web apps, similar to [Userback](https://userback.io/). Users can report **bugs**, share **feedback** and send **suggestions**, and attach an **annotated screenshot** or a **screen recording**.

You set it up once and it works across your whole app, or only on the pages you choose. It works with React, Next.js, Vue, Angular, Svelte, or a plain `<script>` tag.

- 🐞 Three report types: bug, feedback, and idea (you can choose which to offer)
- 📸 Screenshots with no permission prompt, plus an editor to draw, highlight, and **black out sensitive data**
- 🎥 Screen recording with tab audio, a live timer, and an automatic stop at your time limit
- 🧭 Page targeting with `include`/`exclude` globs that follow SPA route changes automatically
- 🧾 Context captured automatically: URL, browser, viewport, timezone, recent console logs and errors, your user and metadata
- 🎨 Accent color, light/dark/auto theme, position, and every text label can be customized
- 🧱 Styles live in a Shadow DOM, so your CSS can't break the widget and the widget can't break your CSS
- 📦 One small dependency (`html-to-image`), typed, ESM + CJS + CDN builds, safe under SSR

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

## Receiving feedback

### Option 1: `endpoint`

The widget `POST`s `multipart/form-data` with these fields:

| Field | Content |
| --- | --- |
| `payload` | JSON: `type`, `message`, `email`, `user`, `metadata`, `context`, `consoleLogs` |
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

[`examples/server/index.mjs`](examples/server/index.mjs) is a complete backend with no dependencies.

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

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `endpoint` | `string` | — | URL to POST submissions to |
| `headers` | `object \| () => object` | — | Extra request headers |
| `onSubmit` | `(payload) => void \| Promise` | — | Handle submissions yourself |
| `onOpen` / `onClose` / `onError` | functions | — | Lifecycle hooks |
| `pages` | `{ include?, exclude? }` | all pages | Where the button is shown |
| `types` | `('bug' \| 'feedback' \| 'suggestion')[]` | all three | Types offered, in order |
| `features.screenshot` | `boolean` | `true` | Allow screenshots |
| `features.video` | `boolean` | `true` | Allow screen recording |
| `features.email` | `boolean` | `true` | Ask for an email when `user.email` is unknown |
| `features.consoleLogs` | `boolean` | `true` | Attach the last 50 console messages and errors |
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
```

## License

MIT
