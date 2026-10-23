type Child = Node | string | null | undefined | false;
type AttrValue = string | number | boolean | null | undefined | EventListener;

/** Minimal element factory: `on*` attributes become event listeners, `true` becomes an empty attribute. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

/** Wraps a trusted, static SVG string from `icons.ts` in a span. */
export function icon(svg: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'fb-icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = svg;
  return span;
}

export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
