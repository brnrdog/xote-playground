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
    View.mount(make(), root)
  } catch (err) {
    parent.postMessage({ type: "runtime-error", text: String(err?.stack ?? err) }, "*")
  }
`

// The manifest is fetched once and cached: it changes only when `npm run
// vendor` re-runs, never during a session.
let manifestPromise = null
function loadManifest() {
  manifestPromise ??= fetch('/vendor/manifest.json')
    .then(res => (res.ok ? res.json() : {}))
    .catch(() => ({}))
  return manifestPromise
}

export function createRunner(container) {
  let frame = null

  async function run(js) {
    const manifest = await loadManifest()
    if (frame) frame.remove()

    frame = document.createElement('iframe')
    // No allow-same-origin: the snippet gets an opaque origin and cannot reach
    // the host page's DOM, storage or cookies.
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.title = 'Preview'

    const snippet = rewriteImports(js, location.origin, undefined, manifest)
    const bootstrap = rewriteImports(BOOTSTRAP, location.origin, undefined, manifest)

    frame.srcdoc = `<!doctype html>
<html>
  <head><link rel="stylesheet" href="${location.origin}/preview.css" /></head>
  <body>
    <div id="root"></div>
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
