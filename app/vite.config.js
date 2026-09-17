import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  build: { outDir: 'build', target: 'es2022' },
  // The preview iframe is sandboxed WITHOUT allow-same-origin, so it has an
  // opaque origin and every fetch it makes to this server is cross-origin.
  // Module imports are no exception: without CORS the vendored runtime fails to
  // load and the snippet dies with a misleading
  //   Failed to fetch dynamically imported module: blob:null/...
  // Widening CORS here is safe precisely because the sandbox is what isolates
  // the snippet; these are public static assets either way.
  server: { port: 3100, headers: { 'Access-Control-Allow-Origin': '*' } },
  preview: { headers: { 'Access-Control-Allow-Origin': '*' } },
  // The compiler bundle is multi-megabyte and loaded at runtime by the worker,
  // never bundled. It is served from public/bundle/ (populated by CI) so the
  // worker can fetch it with a plain importScripts.
  optimizeDeps: { exclude: ['xote'] },
})
