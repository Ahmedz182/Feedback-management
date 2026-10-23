import type { FeedbackAppearance, FeedbackColors } from '../types';

const COLOR_TOKENS: Record<keyof FeedbackColors, string> = {
  primary: '--fb-primary',
  primaryText: '--fb-primary-text',
  background: '--fb-bg',
  surface: '--fb-surface',
  text: '--fb-text',
  muted: '--fb-muted',
  border: '--fb-border',
  danger: '--fb-danger',
  bug: '--fb-bug',
  feedback: '--fb-feedback',
  suggestion: '--fb-suggestion',
};

const LAYOUT_TOKENS = {
  fontSize: '--fb-font-size',
  radius: '--fb-radius',
  shadow: '--fb-shadow',
  panelWidth: '--fb-panel-width',
} as const;

/** Keeps a developer-supplied value from closing the declaration or rule it is placed in. */
const safe = (value: string) => value.replace(/[;{}<>]/g, '');

function declarations(tokens: Record<string, string | undefined>): string {
  return Object.entries(tokens)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '')
    .map(([name, value]) => `${name}:${safe(value)};`)
    .join('');
}

function colorTokens(colors: FeedbackColors | undefined): Record<string, string | undefined> {
  const tokens: Record<string, string | undefined> = {};
  if (!colors) return tokens;
  for (const [key, token] of Object.entries(COLOR_TOKENS)) tokens[token] = colors[key as keyof FeedbackColors];
  return tokens;
}

/** Resolves `font: 'inherit'` to the page's own body font, since the shadow root resets inheritance. */
function resolveFont(font: string | undefined): string | undefined {
  if (font !== 'inherit') return font;
  return typeof document !== 'undefined' ? getComputedStyle(document.body).fontFamily : undefined;
}

/**
 * CSS that applies `appearance` on top of the default theme: light tokens on
 * `:host`, and `appearance.dark` for dark mode (explicit or via the OS).
 */
export function themeCss(appearance: FeedbackAppearance = {}, primaryColor?: string): string {
  const light: Record<string, string | undefined> = {
    ...colorTokens({ primary: primaryColor, ...appearance }),
    '--fb-font': resolveFont(appearance.font),
  };
  for (const [key, token] of Object.entries(LAYOUT_TOKENS)) {
    light[token] = appearance[key as keyof typeof LAYOUT_TOKENS];
  }
  const dark = declarations(colorTokens(appearance.dark));
  let css = `:host{${declarations(light)}}`;
  if (dark) {
    css += `:host([data-theme="dark"]){${dark}}`;
    css += `@media (prefers-color-scheme: dark){:host([data-theme="auto"]){${dark}}}`;
  }
  return css;
}
