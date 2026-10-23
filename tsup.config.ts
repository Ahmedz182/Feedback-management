import { defineConfig } from 'tsup';

export default defineConfig([
  {
    // Shared chunk keeps a single copy of the widget when both entries are imported.
    entry: { index: 'src/index.ts', react: 'src/react.tsx' },
    format: ['esm', 'cjs'],
    splitting: true,
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    external: ['react'],
    // Next.js App Router: the widget only runs in the browser, so every module is a client module.
    banner: { js: "'use client';" },
  },
  {
    // <script> tag build for CDNs: exposes `window.FeedbackWidget`.
    entry: { 'feedback-widget': 'src/index.ts' },
    format: ['iife'],
    globalName: 'FeedbackWidget',
    minify: true,
    sourcemap: true,
    target: 'es2019',
  },
]);
