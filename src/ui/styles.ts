export const styles = /* css */ `
:host {
  all: initial;
  --fb-primary: #4f46e5;
  --fb-primary-text: #ffffff;
  --fb-bg: #ffffff;
  --fb-surface: #f6f6f7;
  --fb-text: #18181b;
  --fb-muted: #71717a;
  --fb-border: #e4e4e7;
  --fb-danger: #dc2626;
  --fb-bug: #e11d48;
  --fb-feedback: var(--fb-primary);
  --fb-suggestion: #d97706;
  --fb-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --fb-font-size: 14px;
  --fb-radius: 10px;
  --fb-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
  --fb-panel-width: 480px;
  font-family: var(--fb-font);
  font-size: var(--fb-font-size);
  line-height: 1.45;
  color: var(--fb-text);
}
:host([data-theme="dark"]) {
  --fb-bg: #18181b;
  --fb-surface: #232326;
  --fb-text: #fafafa;
  --fb-muted: #a1a1aa;
  --fb-border: #34343a;
  --fb-danger: #f87171;
  --fb-bug: #fb7185;
  --fb-suggestion: #fbbf24;
}
@media (prefers-color-scheme: dark) {
  :host([data-theme="auto"]) {
    --fb-bg: #18181b;
    --fb-surface: #232326;
    --fb-text: #fafafa;
    --fb-muted: #a1a1aa;
    --fb-border: #34343a;
    --fb-danger: #f87171;
    --fb-bug: #fb7185;
    --fb-suggestion: #fbbf24;
  }
}
*, *::before, *::after { box-sizing: border-box; }
button, input, textarea, select { font: inherit; color: inherit; }
button { cursor: pointer; }
[hidden] { display: none !important; }
.fb-icon { display: inline-flex; width: 18px; height: 18px; flex: none; }
.fb-icon svg { width: 100%; height: 100%; }
:focus-visible { outline: 2px solid var(--fb-primary); outline-offset: 2px; }

/* ---------- launcher */
.fb-launcher {
  position: fixed;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 16px;
  border: 0; border-radius: 999px;
  background: var(--fb-primary); color: var(--fb-primary-text);
  font-weight: 600;
  box-shadow: var(--fb-shadow);
  transition: transform .15s ease, filter .15s ease;
}
.fb-launcher:hover { filter: brightness(1.08); }
.fb-launcher-pill:hover, .fb-launcher-circle:hover { transform: translateY(-2px); }
.fb-launcher-circle { width: 52px; height: 52px; padding: 0; }
.fb-launcher-circle .fb-icon { width: 22px; height: 22px; }
.fb-launcher-tab {
  writing-mode: vertical-rl;
  padding: 14px 9px;
  border-radius: 0 var(--fb-radius) var(--fb-radius) 0;
  top: 50% !important; bottom: auto !important;
}
.fb-launcher-tab .fb-icon { transform: rotate(90deg); }
.fb-launcher-tab.bottom-right, .fb-launcher-tab.top-right { right: 0 !important; transform: translateY(-50%) rotate(180deg); }
.fb-launcher-tab.bottom-left, .fb-launcher-tab.top-left { left: 0 !important; transform: translateY(-50%); border-radius: 0 var(--fb-radius) var(--fb-radius) 0; }

.bottom-right { right: 20px; bottom: 20px; }
.bottom-left { left: 20px; bottom: 20px; }
.top-right { right: 20px; top: 20px; }
.top-left { left: 20px; top: 20px; }

/* ---------- panel */
.fb-panel {
  --fb-type: var(--fb-feedback);
  position: fixed;
  width: var(--fb-panel-width); max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  display: flex; flex-direction: column;
  background: var(--fb-bg);
  border: 1px solid var(--fb-border); border-radius: calc(var(--fb-radius) * 1.4);
  box-shadow: var(--fb-shadow);
  /* clip (not just hidden) so focus or scrollIntoView can't scroll the panel itself and push the header out of view. */
  overflow: hidden;
  overflow: clip;
  animation: fb-pop .16s ease-out;
}
.fb-panel::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--fb-type); }
.fb-panel[data-type="bug"] { --fb-type: var(--fb-bug); }
.fb-panel[data-type="suggestion"] { --fb-type: var(--fb-suggestion); }
@keyframes fb-pop { from { opacity: 0; transform: translateY(8px) scale(.98); } }
@media (max-width: 520px) {
  .fb-panel { left: 12px; right: 12px; bottom: 12px; top: auto; width: auto; max-width: none; max-height: calc(100vh - 24px); }
}

.fb-header { display: flex; align-items: flex-start; gap: 10px; padding: 16px 18px 12px 22px; }
.fb-header > div { flex: 1; min-width: 0; }
.fb-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--fb-muted); }
.fb-header h2 { margin: 2px 0 0; font-size: 16px; font-weight: 650; }
.fb-close { border: 0; background: none; padding: 4px; border-radius: 6px; color: var(--fb-muted); display: inline-flex; }
.fb-close:hover { background: var(--fb-surface); color: var(--fb-text); }
.fb-kbd {
  font: 600 11px/1 var(--fb-font); padding: 4px 6px; border-radius: 5px;
  border: 1px solid var(--fb-border); background: var(--fb-surface); color: var(--fb-muted);
}
.fb-esc { margin-top: 2px; }

.fb-tabs { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; border-bottom: 1px solid var(--fb-border); }
.fb-tab {
  display: grid; justify-items: center; gap: 1px;
  padding: 9px 8px 8px;
  border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px;
  background: var(--fb-surface); color: var(--fb-muted);
}
.fb-tab[aria-selected="true"] { background: var(--fb-bg); color: var(--fb-type); border-bottom-color: var(--fb-type); }
.fb-tab-title { display: inline-flex; align-items: center; gap: 6px; font-weight: 650; }
.fb-tab-title .fb-icon { width: 16px; height: 16px; }
.fb-tab-hint {
  font-size: 11.5px; line-height: 1.3; color: var(--fb-muted); text-align: center;
  text-wrap: balance;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}
.fb-tab { min-width: 0; }
@media (max-width: 520px) { .fb-tab-hint { display: none; } }
.fb-tabs, .fb-footer { position: relative; z-index: 1; transition: box-shadow .15s ease; }
.fb-tabs.fb-raised { box-shadow: 0 10px 14px -12px rgba(0, 0, 0, .35); }
.fb-footer.fb-raised { box-shadow: 0 -10px 14px -12px rgba(0, 0, 0, .35); }

.fb-form { display: flex; flex-direction: column; min-height: 0; flex: 1; }
.fb-body { overflow-y: auto; padding: 18px 20px 22px 24px; display: grid; gap: 20px; }
.fb-footer {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 18px 12px 22px; border-top: 1px solid var(--fb-border); background: var(--fb-bg);
}

/* ---------- fields */
.fb-field { display: grid; gap: 8px; min-width: 0; }
.fb-field-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.fb-label {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--fb-muted);
}
.fb-hint { font-size: 12px; color: var(--fb-muted); }
.fb-block { display: block; }
.fb-badge {
  margin-left: 8px; padding: 1px 6px; border-radius: 4px;
  font-size: 9.5px; letter-spacing: .06em;
  background: color-mix(in srgb, var(--fb-danger) 12%, transparent); color: var(--fb-danger);
}
.fb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 520px) { .fb-grid { grid-template-columns: 1fr; } }

.fb-input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--fb-border); border-radius: var(--fb-radius);
  background: var(--fb-surface);
  outline: none;
}
.fb-input:focus { border-color: var(--fb-primary); background: var(--fb-bg); box-shadow: 0 0 0 3px color-mix(in srgb, var(--fb-primary) 18%, transparent); }
textarea.fb-input { resize: vertical; min-height: 64px; }
textarea[name="message"] { min-height: 96px; }
.fb-input::placeholder { color: var(--fb-muted); opacity: .85; }
select.fb-input { appearance: auto; }

.fb-card { border: 1px solid var(--fb-border); border-radius: var(--fb-radius); background: var(--fb-surface); }
.fb-checklist { display: grid; gap: 6px; padding: 10px 12px; border: 1px solid var(--fb-border); border-radius: var(--fb-radius); background: var(--fb-surface); }
.fb-check { display: flex; align-items: center; gap: 10px; font-size: 13.5px; cursor: pointer; }
.fb-check .fb-hint { margin-left: auto; }
.fb-check input { width: 15px; height: 15px; margin: 0; accent-color: var(--fb-primary); }

.fb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.fb-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 999px;
  border: 1px solid var(--fb-border); background: var(--fb-bg);
  font-size: 13px;
}
.fb-chip:hover { border-color: var(--fb-muted); }
.fb-chip[aria-checked="true"], .fb-chip[aria-pressed="true"] { background: var(--fb-text); border-color: var(--fb-text); color: var(--fb-bg); }
.fb-chip-hint { font-size: 11.5px; opacity: .7; }
.fb-chip-hint:empty { display: none; }
.fb-segments { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
@media (max-width: 400px) { .fb-segments { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.fb-chip.fb-segment {
  display: grid; align-content: start; justify-items: start; gap: 2px;
  padding: 8px 10px; border-radius: var(--fb-radius); text-align: left; min-width: 0;
}
.fb-segment-top { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
.fb-segment .fb-chip-hint { font-size: 11px; line-height: 1.25; }
.fb-segment .fb-chip-hint:empty { display: block; }
.fb-segment .fb-chip-hint:empty::before { content: "\\00a0"; }
.fb-dot-sm { width: 7px; height: 7px; border-radius: 999px; background: var(--fb-muted); flex: none; }
.fb-sev-critical .fb-dot-sm { background: #e11d48; }
.fb-sev-high .fb-dot-sm { background: #ea580c; }
.fb-sev-medium .fb-dot-sm { background: #eab308; }
.fb-sev-low .fb-dot-sm { background: #16a34a; }
.fb-mood-happy .fb-dot-sm, .fb-ok { background: #16a34a; }
.fb-mood-frustrated .fb-dot-sm { background: #ea580c; }

.fb-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.fb-actions .fb-btn { flex: 1 1 auto; white-space: nowrap; }
@media (max-width: 520px) {
  .fb-header { padding: 14px 14px 10px 18px; }
  .fb-body { padding: 16px 14px 18px 18px; gap: 18px; }
  .fb-footer { padding: 10px 14px 10px 18px; }
}
.fb-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--fb-border); border-radius: var(--fb-radius);
  background: var(--fb-surface);
  font-size: 13px; font-weight: 550;
}
.fb-btn:hover:not(:disabled) { border-color: var(--fb-muted); }
.fb-btn:disabled { opacity: .5; cursor: not-allowed; }
.fb-btn-primary { background: var(--fb-primary); border-color: var(--fb-primary); color: var(--fb-primary-text); padding: 8px 14px; }
.fb-btn-primary:hover:not(:disabled) { border-color: var(--fb-primary); filter: brightness(1.08); }
@media (hover: none) { .fb-kbd { display: none; } }
.fb-btn-primary .fb-kbd { background: transparent; color: inherit; opacity: .65; border-color: currentColor; margin-left: 4px; }
.fb-btn-ghost { background: transparent; border-color: transparent; }
.fb-spacer { flex: 1; }

.fb-drop {
  display: grid; justify-items: center; gap: 2px;
  padding: 18px 12px; text-align: center;
  border: 1.5px dashed var(--fb-border); border-radius: var(--fb-radius);
  cursor: pointer;
}
.fb-drop:hover, .fb-drop-active { border-color: var(--fb-primary); background: color-mix(in srgb, var(--fb-primary) 6%, transparent); }

.fb-previews { display: flex; gap: 8px; flex-wrap: wrap; }
.fb-preview {
  position: relative; width: 96px; height: 64px;
  border: 1px solid var(--fb-border); border-radius: 8px;
  background: var(--fb-surface);
}
.fb-preview img, .fb-preview video { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 7px; }
.fb-preview-btn {
  position: absolute; width: 22px; height: 22px; padding: 4px;
  border: 2px solid var(--fb-bg); border-radius: 999px; color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
}
.fb-preview-btn .fb-icon { width: 12px; height: 12px; }
.fb-preview-remove { top: -8px; right: -8px; background: #b91c1c; }
.fb-preview-edit { bottom: -8px; right: -8px; background: #d97706; }

.fb-toggle-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer; }
.fb-toggle-row > span:first-child { flex: 1; }
.fb-switch-input { position: absolute; opacity: 0; pointer-events: none; }
.fb-switch { width: 36px; height: 20px; border-radius: 999px; background: var(--fb-border); position: relative; transition: background .15s; flex: none; }
.fb-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.3); transition: transform .15s; }
.fb-switch-input:checked + .fb-switch { background: var(--fb-primary); }
.fb-switch-input:checked + .fb-switch::after { transform: translateX(16px); }
.fb-switch-input:focus-visible + .fb-switch { outline: 2px solid var(--fb-primary); outline-offset: 2px; }

.fb-summary > summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 11px 14px; cursor: pointer; list-style: none; }
.fb-summary > summary .fb-label { flex: none; }
.fb-summary > summary .fb-hint { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fb-summary > summary::-webkit-details-marker { display: none; }
.fb-summary > summary::after { content: "▾"; color: var(--fb-muted); }
.fb-summary[open] > summary::after { content: "▴"; }
.fb-summary .fb-checklist { border: 0; border-top: 1px solid var(--fb-border); border-radius: 0 0 var(--fb-radius) var(--fb-radius); }

.fb-error { margin: 0; color: var(--fb-danger); font-size: 13px; }
.fb-success { padding: 36px 16px 40px; text-align: center; display: grid; gap: 12px; justify-items: center; }
.fb-success-badge {
  width: 48px; height: 48px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--fb-type) 14%, var(--fb-bg)); color: var(--fb-type);
}
.fb-success p { margin: 0; font-weight: 550; }

/* ---------- recording, overlay and annotation */
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
.fb-timer { min-width: 36px; }
.fb-recording .fb-tool { color: #fafafa; width: 34px; height: 34px; padding: 7px; border-radius: 999px; }
.fb-recording .fb-tool:hover { background: #3f3f46; }
.fb-recording .fb-tool[aria-pressed="true"] { background: #ef4444; border-color: #ef4444; color: #fff; }
.fb-recording .fb-stop { background: #ef4444; border-color: #ef4444; color: #fff; border-radius: 999px; }
.fb-recording .fb-stop:hover:not(:disabled) { background: #dc2626; }

.fb-overlay { position: fixed; inset: 0; pointer-events: none; }
.fb-draw-layer { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; }
.fb-draw-layer.fb-draw-active { pointer-events: auto; cursor: crosshair; touch-action: none; }
.fb-cursor {
  position: fixed; left: 0; top: 0;
  width: 36px; height: 36px; margin: -18px 0 0 -18px;
  border-radius: 999px;
  background: rgba(250, 204, 21, .35); border: 2px solid rgba(234, 179, 8, .8);
  pointer-events: none; will-change: transform;
}
.fb-ripple {
  position: fixed; width: 40px; height: 40px; margin: -20px 0 0 -20px;
  border-radius: 999px; border: 3px solid #ef4444;
  pointer-events: none;
  animation: fb-ripple .6s ease-out forwards;
}
@keyframes fb-ripple { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }

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
