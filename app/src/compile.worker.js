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

let compiler = null

function load() {
  if (compiler) return compiler

  importScripts(
    `${BUNDLE}/compiler.js`,
    `${BUNDLE}/stdlib/cmij.js`,
    `${BUNDLE}/xote.cmij.js`,
  )

  compiler = self.rescript_compiler.make()
  compiler.setModuleSystem('esmodule')
  // Mirrors docs-website/rescript.json: -open Xote plus the XoteJSX transform.
  compiler.setOpenModules(['Xote'])
  compiler.setConfig({ module_system: 'esmodule', jsx: { version: 4, module_: 'XoteJSX' } })

  return compiler
}

self.onmessage = (event) => {
  const { id, code } = event.data

  let result
  try {
    result = load().rescript.compile(code)
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      errors: [{ row: 0, column: 0, text: `Compiler crashed: ${err?.message ?? err}` }],
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
