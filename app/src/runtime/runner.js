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
    View.mount(root, make())
  } catch (err) {
    parent.postMessage({ type: "runtime-error", text: String(err?.stack ?? err) }, "*")
  }
`

export function createRunner(container) {
  let frame = null

  function run(js) {
    if (frame) frame.remove()

    frame = document.createElement('iframe')
    // No allow-same-origin: the snippet gets an opaque origin and cannot reach
    // the host page's DOM, storage or cookies.
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.title = 'Preview'

    const snippet = rewriteImports(js, location.origin)
    const bootstrap = rewriteImports(BOOTSTRAP, location.origin)

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
