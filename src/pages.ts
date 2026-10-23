import type { PageRule, PageRules } from './types';

const escapeRegExp = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&');

/**
 * Converts a glob into an anchored RegExp: `*` matches within one path
 * segment, `**` matches across segments, `?` matches one character, and a
 * trailing `/**` also matches the bare prefix (`/docs/**` matches `/docs`).
 */
export function globToRegExp(glob: string): RegExp {
  let source = glob;
  let suffix = '';
  if (source.endsWith('/**')) {
    source = source.slice(0, -3);
    suffix = '(?:/.*)?';
  }
  let re = '';
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '*') {
      if (source[i + 1] === '*') {
        re += '.*';
        i++;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += escapeRegExp(c);
    }
  }
  return new RegExp(`^${re}${suffix}$`);
}

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

export function matchesRule(rule: PageRule, url: URL): boolean {
  if (typeof rule === 'function') return rule(url);
  if (rule instanceof RegExp) {
    rule.lastIndex = 0;
    if (rule.test(url.pathname)) return true;
    rule.lastIndex = 0;
    return rule.test(url.href);
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rule)) return globToRegExp(rule).test(url.href);
  const re = globToRegExp(stripTrailingSlash(rule));
  return re.test(url.pathname) || re.test(stripTrailingSlash(url.pathname));
}

export function isPageAllowed(rules: PageRules | undefined, url: URL): boolean {
  if (!rules) return true;
  if (rules.exclude?.some((rule) => matchesRule(rule, url))) return false;
  if (!rules.include || rules.include.length === 0) return true;
  return rules.include.some((rule) => matchesRule(rule, url));
}
