import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  build: { outDir: 'build', target: 'es2022' },
  server: { port: 3100 },
  // The compiler bundle is multi-megabyte and loaded at runtime by the worker,
  // never bundled. It is served from public/bundle/ (populated by CI) so the
  // worker can fetch it with a plain importScripts.
  optimizeDeps: { exclude: ['xote'] },
})
