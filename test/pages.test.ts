import { describe, expect, it } from 'vitest';
import { isPageAllowed, matchesRule } from '../src/pages';

const url = (path: string) => new URL(path, 'https://app.example.com');

describe('matchesRule', () => {
  it('matches exact paths, ignoring a trailing slash', () => {
    expect(matchesRule('/pricing', url('/pricing'))).toBe(true);
    expect(matchesRule('/pricing', url('/pricing/'))).toBe(true);
    expect(matchesRule('/pricing', url('/pricing/team'))).toBe(false);
  });

  it('treats * as a single segment and ** as any depth', () => {
    expect(matchesRule('/users/*', url('/users/42'))).toBe(true);
    expect(matchesRule('/users/*', url('/users/42/edit'))).toBe(false);
    expect(matchesRule('/users/**', url('/users/42/edit'))).toBe(true);
    expect(matchesRule('/users/*/edit', url('/users/42/edit'))).toBe(true);
  });

  it('lets a trailing /** match the bare prefix', () => {
    expect(matchesRule('/docs/**', url('/docs'))).toBe(true);
    expect(matchesRule('/docs/**', url('/docsearch'))).toBe(false);
  });

  it('matches full-URL globs against the href', () => {
    expect(matchesRule('https://app.example.com/**', url('/a/b'))).toBe(true);
    expect(matchesRule('https://other.example.com/**', url('/a'))).toBe(false);
  });

  it('supports RegExp and function rules', () => {
    expect(matchesRule(/^\/admin/, url('/admin/settings'))).toBe(true);
    expect(matchesRule(/[?&]beta=1/, url('/home?beta=1'))).toBe(true);
    expect(matchesRule((u) => u.searchParams.has('debug'), url('/x?debug'))).toBe(true);
  });

  it('is not tripped up by global RegExp state', () => {
    const rule = /\/a/g;
    expect(matchesRule(rule, url('/a'))).toBe(true);
    expect(matchesRule(rule, url('/a'))).toBe(true);
  });
});

describe('isPageAllowed', () => {
  it('allows every page without rules', () => {
    expect(isPageAllowed(undefined, url('/anything'))).toBe(true);
    expect(isPageAllowed({ include: [] }, url('/anything'))).toBe(true);
  });

  it('restricts to include rules', () => {
    const rules = { include: ['/app/**'] };
    expect(isPageAllowed(rules, url('/app/projects'))).toBe(true);
    expect(isPageAllowed(rules, url('/login'))).toBe(false);
  });

  it('gives exclude precedence over include', () => {
    const rules = { include: ['/app/**'], exclude: ['/app/checkout'] };
    expect(isPageAllowed(rules, url('/app/projects'))).toBe(true);
    expect(isPageAllowed(rules, url('/app/checkout'))).toBe(false);
  });
});
