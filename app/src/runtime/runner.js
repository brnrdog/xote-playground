/**
 * Runs compiled snippet JS inside a sandboxed iframe.
 *
 * Every run replaces the iframe element outright. That is the point: it is the
 * only reliable way to stop a snippet that installed timers, listeners or an
 * effect loop, and it guarantees each run starts from a clean DOM and a clean
 * signal graph.
 */
import { rewriteImports } from './rewrite.js'

const BOOTSTRAP = `
  import * as View from "xote/src/View.res.mjs"
  import { make } from "./snippet.js"

  const root = document.getElementById("root")
  try {
    // View.mount is (node, element) — node first. See src/View.resi.
    //
    // make({}) rather than make(): @xote.component derives props, so an
    // annotated component compiles to a function taking a props object, while
    // a plain one takes unit. An empty object satisfies the first and is
    // ignored by the second, so one call site serves both.
    // (No backticks in here: this whole string is a template literal.)
    View.mount(make({}), root)
  } catch (err) {
    parent.postMessage({ type: "runtime-error", text: String(err?.stack ?? err) }, "*")
  }
`

// Where this app is mounted, resolved at runtime rather than baked in. Vite's
// base only settles where *its* assets live; the preview iframe also has to
// reach /vendor and /preview.css, and the same build is expected to work at a
// domain root and under a GitHub project page subpath. document.baseURI is the
// one value that knows which.
const APP_BASE = new URL('./', document.baseURI)
const VENDOR_BASE = new URL('vendor/', APP_BASE)
const PREVIEW_CSS = new URL('preview.css', APP_BASE).href

/**
 * Forwards the snippet's console into the host, and is injected ahead of the
 * snippet so it captures logs from module evaluation too.
 *
 * Serialisation is defensive on purpose: this runs inside the user's snippet,
 * and an exception thrown by the override itself would break the preview rather
 * than report anything. Objects go through a circular-safe replacer, functions
 * become their source, and anything that still refuses to serialise degrades to
 * String(). No backticks in here -- it is embedded in a template literal.
 */
const CONSOLE_SHIM = `
  (function () {
    var MAX = 200
    var sent = 0
    function render(value, depth) {
      if (typeof value === "string") return value
      if (typeof value === "function") return value.toString().slice(0, 200)
      if (value instanceof Error) return String(value.stack || value)
      if (value === null || typeof value !== "object") return String(value)
      if (depth > 2) return Array.isArray(value) ? "[...]" : "{...}"
      try {
        var seen = new WeakSet()
        return JSON.stringify(value, function (k, v) {
          if (v !== null && typeof v === "object") {
            if (seen.has(v)) return "[circular]"
            seen.add(v)
          }
          return typeof v === "function" ? "[function]" : v
        })
      } catch (e) {
        return String(value)
      }
    }
    ;["log", "info", "warn", "error", "debug"].forEach(function (level) {
      var original = console[level] ? console[level].bind(console) : function () {}
      console[level] = function () {
        var args = Array.prototype.slice.call(arguments)
        try { original.apply(null, args) } catch (e) {}
        if (sent >= MAX) return
        sent++
        var text = sent === MAX
          ? "… further output suppressed (" + MAX + " lines)"
          : args.map(function (a) { return render(a, 0) }).join(" ")
        try {
          parent.postMessage({ type: "console", level: level, text: text }, "*")
        } catch (e) {}
      }
    })
  })()
`

// The manifest is fetched once and cached: it changes only when `npm run
// vendor` re-runs, never during a session.
let manifestPromise = null
function loadManifest() {
  manifestPromise ??= fetch(new URL('manifest.json', VENDOR_BASE))
    .then(res => (res.ok ? res.json() : {}))
    .catch(() => ({}))
  return manifestPromise
}

export function createRunner(container) {
  let frame = null

  async function run(js, { theme = 'dark' } = {}) {
    const manifest = await loadManifest()
    if (frame) frame.remove()

    frame = document.createElement('iframe')
    // No allow-same-origin: the snippet gets an opaque origin and cannot reach
    // the host page's DOM, storage or cookies.
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.title = 'Preview'

    const snippet = rewriteImports(js, VENDOR_BASE.href, manifest)
    const bootstrap = rewriteImports(BOOTSTRAP, VENDOR_BASE.href, manifest)

    frame.srcdoc = `<!doctype html>
<html data-theme="${theme}">
  <head><link rel="stylesheet" href="${PREVIEW_CSS}" /></head>
  <body>
    <div id="root"></div>
    <script>${CONSOLE_SHIM}<\/script>
    <script type="module">
      const snippetUrl = URL.createObjectURL(
        new Blob([${JSON.stringify(snippet)}], { type: "text/javascript" })
      )
      const bootstrap = ${JSON.stringify(bootstrap)}.replace("./snippet.js", snippetUrl)
      const bootstrapUrl = URL.createObjectURL(
        new Blob([bootstrap], { type: "text/javascript" })
      )
      import(bootstrapUrl).catch((err) => {
        parent.postMessage({ type: "runtime-error", text: String(err?.stack ?? err) }, "*")
      })
    <\/script>
  </body>
</html>`

    container.appendChild(frame)
  }

  return { run }
}
