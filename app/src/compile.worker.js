/**
 * Compile worker. Owns the ReScript playground bundle so a slow compile never
 * blocks typing, and so a compiler crash takes down the worker rather than the
 * page.
 *
 * Protocol:
 *   in  { id, code }
 *   out { id, ok: true, js } | { id, ok: false, errors: [{ row, column, text }] }
 */

const BUNDLE = '/bundle'

const JSX_CONFIG = '@@jsxConfig({version: 4, module_: "XoteJSX"})'

/**
 * The playground compiler has no knob for the JSX module, so the only way to get
 * xote's generic transform instead of React's is the file-level attribute. We
 * prepend it unless the snippet set its own, and keep it on one line so reported
 * error rows still line up with what the user typed.
 */
function prependJsxConfig(code) {
  return code.includes('@@jsxConfig') ? code : `${JSX_CONFIG} ${code}`
}

let compiler = null

/**
 * `importScripts` reports a 404 and a syntax error identically ("failed to
 * load"), which is useless when the usual cause is simply that no bundle has
 * been installed yet. Probe first so the message names the real problem.
 */
function assertBundlePresent() {
  const res = new XMLHttpRequest()
  res.open('GET', `${BUNDLE}/compiler.js`, false)

  try {
    res.send(null)
  } catch (err) {
    throw new Error(`Could not reach ${BUNDLE}/compiler.js: ${err?.message ?? err}`)
  }

  if (res.status === 404) {
    throw new Error(
      'No compiler bundle installed.\n\n' +
        'The playground needs a ReScript compiler bundle built with xote baked in.\n' +
        'Build one with ./scripts/build-bundle.sh, then:\n' +
        '  node scripts/install-bundle.mjs\n\n' +
        'See README.md ("Why a custom bundle").',
    )
  }

  if (res.status >= 400) {
    throw new Error(`${BUNDLE}/compiler.js returned HTTP ${res.status}.`)
  }
}

function load() {
  if (compiler) return compiler

  assertBundlePresent()

  // compiler-builtins carries the stdlib; each dependency gets its own cmij.
  // Order matters: the compiler must be loaded before any cmij registers itself.
  importScripts(
    `${BUNDLE}/compiler.js`,
    `${BUNDLE}/packages/compiler-builtins/cmij.js`,
    `${BUNDLE}/packages/rescript-signals/cmij.js`,
    `${BUNDLE}/packages/xote/cmij.js`,
  )

  compiler = self.rescript_compiler.make()
  compiler.setModuleSystem('esmodule')
  // Mirrors xote's `-open Xote` compiler flag.
  compiler.setOpenModules(['Xote'])
  // NOTE: there is no setConfig, and the JSX *module* cannot be set through the
  // playground API at all — jsoo_playground_main.ml exposes only
  // setModuleSystem / setFilename / setWarnFlags / setOpenModules /
  // setExperimentalFeatures / setJsxPreserveMode, and hardcodes JSX v4 with the
  // React transform. Snippets that use JSX must opt into the generic transform
  // in-file with `@@jsxConfig({version: 4, module_: "XoteJSX"})`; prependJsxConfig
  // below does that for them.

  return compiler
}

self.onmessage = (event) => {
  const { id, code } = event.data

  let result
  try {
    result = load().rescript.compile(prependJsxConfig(code))
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      errors: [{ row: 0, column: 0, text: err?.message ?? String(err) }],
    })
    return
  }

  if (result.type === 'success') {
    self.postMessage({ id, ok: true, js: result.js_code })
    return
  }

  // The playground reports `errors` for syntax/type errors and a bare `msg` for
  // everything else (unexpected_error, etc.).
  const errors = result.errors ?? [{ row: 0, column: 0, text: result.msg ?? 'Unknown error' }]
  self.postMessage({ id, ok: false, errors })
}
