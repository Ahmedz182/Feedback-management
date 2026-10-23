export const styles = /* css */ `
:host {
  all: initial;
  --fb-primary: #4f46e5;
  --fb-primary-text: #ffffff;
  --fb-bg: #ffffff;
  --fb-surface: #f4f4f5;
  --fb-text: #18181b;
  --fb-muted: #71717a;
  --fb-border: #e4e4e7;
  --fb-danger: #dc2626;
  --fb-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: var(--fb-text);
}
:host([data-theme="dark"]) {
  --fb-bg: #18181b;
  --fb-surface: #27272a;
  --fb-text: #fafafa;
  --fb-muted: #a1a1aa;
  --fb-border: #3f3f46;
  --fb-danger: #f87171;
}
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) {
    --fb-bg: #18181b;
    --fb-surface: #27272a;
    --fb-text: #fafafa;
    --fb-muted: #a1a1aa;
    --fb-border: #3f3f46;
    --fb-danger: #f87171;
  }
}
*, *::before, *::after { box-sizing: border-box; }
button, input, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
[hidden] { display: none !important; }
.fb-icon { display: inline-flex; width: 18px; height: 18px; flex: none; }
.fb-icon svg { width: 100%; height: 100%; }

.fb-launcher {
  position: fixed;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px;
  border: 0; border-radius: 999px;
  background: var(--fb-primary); color: var(--fb-primary-text);
  font-weight: 600;
  box-shadow: var(--fb-shadow);
  transition: transform .15s ease;
}
.fb-launcher:hover { transform: translateY(-2px); }
.fb-launcher:focus-visible, .fb-btn:focus-visible, .fb-type:focus-visible, .fb-tool:focus-visible {
  outline: 2px solid var(--fb-primary); outline-offset: 2px;
}

.fb-panel {
  position: fixed;
  width: 360px; max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px); overflow: auto;
  background: var(--fb-bg);
  border: 1px solid var(--fb-border); border-radius: 14px;
  box-shadow: var(--fb-shadow);
  animation: fb-pop .16s ease-out;
}
@keyframes fb-pop { from { opacity: 0; transform: translateY(8px) scale(.98); } }

.bottom-right { right: 20px; bottom: 20px; }
.bottom-left { left: 20px; bottom: 20px; }
.top-right { right: 20px; top: 20px; }
.top-left { left: 20px; top: 20px; }
@media (max-width: 480px) {
  .fb-panel { left: 16px; right: 16px; width: auto; }
}

.fb-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 0; }
.fb-header h2 { margin: 0; font-size: 16px; font-weight: 650; }
.fb-close { border: 0; background: none; padding: 4px; border-radius: 6px; color: var(--fb-muted); display: inline-flex; }
.fb-close:hover { background: var(--fb-surface); }

.fb-body { padding: 14px 16px 16px; display: grid; gap: 12px; }
.fb-types { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6px; }
.fb-type {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 10px 6px;
  border: 1px solid var(--fb-border); border-radius: 10px;
  background: var(--fb-bg); color: var(--fb-muted);
  font-size: 13px; font-weight: 550;
}
.fb-type[aria-checked="true"] {
  border-color: var(--fb-primary); color: var(--fb-primary);
  background: color-mix(in srgb, var(--fb-primary) 8%, var(--fb-bg));
}

.fb-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--fb-border); border-radius: 10px;
  background: var(--fb-bg);
  outline: none;
}
.fb-input:focus { border-color: var(--fb-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--fb-primary) 20%, transparent); }
textarea.fb-input { min-height: 110px; resize: vertical; }
.fb-input::placeholder { color: var(--fb-muted); }

.fb-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.fb-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--fb-border); border-radius: 10px;
  background: var(--fb-bg);
  font-size: 13px; font-weight: 550;
}
.fb-btn:hover:not(:disabled) { background: var(--fb-surface); }
.fb-btn:disabled { opacity: .55; cursor: not-allowed; }
.fb-btn-primary { background: var(--fb-primary); border-color: var(--fb-primary); color: var(--fb-primary-text); }
.fb-btn-primary:hover:not(:disabled) { background: var(--fb-primary); filter: brightness(1.08); }
.fb-btn-ghost { background: transparent; }
.fb-submit { width: 100%; padding: 10px 12px; font-size: 14px; }

.fb-previews { display: flex; gap: 8px; flex-wrap: wrap; }
.fb-preview {
  position: relative; width: 96px; height: 64px;
  border: 1px solid var(--fb-border); border-radius: 8px; overflow: hidden;
  background: var(--fb-surface);
}
.fb-preview img, .fb-preview video { width: 100%; height: 100%; object-fit: cover; display: block; }
.fb-preview-remove {
  position: absolute; top: 4px; right: 4px;
  width: 22px; height: 22px; padding: 3px;
  border: 0; border-radius: 999px;
  background: rgba(0,0,0,.65); color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
}
.fb-preview-remove .fb-icon { width: 14px; height: 14px; }

.fb-error { margin: 0; color: var(--fb-danger); font-size: 13px; }
.fb-success { padding: 32px 16px 36px; text-align: center; display: grid; gap: 12px; justify-items: center; }
.fb-success-badge {
  width: 48px; height: 48px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--fb-primary) 14%, var(--fb-bg)); color: var(--fb-primary);
}
.fb-success p { margin: 0; font-weight: 550; }

.fb-recording {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px;
  padding: 8px 8px 8px 16px;
  background: #18181b; color: #fafafa;
  border-radius: 999px; box-shadow: var(--fb-shadow);
  font-variant-numeric: tabular-nums;
}
.fb-dot { width: 10px; height: 10px; border-radius: 999px; background: #ef4444; animation: fb-blink 1s infinite; }
@keyframes fb-blink { 50% { opacity: .3; } }
.fb-recording .fb-btn { background: #ef4444; border-color: #ef4444; color: #fff; border-radius: 999px; }

.fb-annotate {
  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  background: rgba(9, 9, 11, .88);
}
.fb-annotate-toolbar {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--fb-bg); border-bottom: 1px solid var(--fb-border);
}
.fb-tool {
  width: 36px; height: 36px; padding: 8px;
  border: 1px solid transparent; border-radius: 8px;
  background: transparent; color: var(--fb-text);
  display: inline-flex; align-items: center; justify-content: center;
}
.fb-tool:hover { background: var(--fb-surface); }
.fb-tool[aria-pressed="true"] { border-color: var(--fb-primary); color: var(--fb-primary); }
.fb-swatch { width: 22px; height: 22px; border-radius: 999px; border: 2px solid var(--fb-bg); box-shadow: 0 0 0 1px var(--fb-border); padding: 0; }
.fb-swatch[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--fb-text); }
.fb-divider { width: 1px; height: 24px; background: var(--fb-border); margin: 0 4px; }
.fb-spacer { flex: 1; }
.fb-annotate-stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 20px; }
.fb-annotate-canvas {
  max-width: 100%; max-height: 100%;
  border-radius: 6px; box-shadow: 0 8px 30px rgba(0,0,0,.5);
  cursor: crosshair; touch-action: none; background: #fff;
}
`;
