/**
 * Smoke-test the built bundle: load compiler.js + the cmij set outside a browser
 * and compile a xote snippet. Fails loudly if xote's modules are not resolvable,
 * which is the failure mode the whole custom-bundle exercise exists to prevent.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'

const dist = path.join(import.meta.dirname, '..', 'dist')

const SNIPPET = `
@@jsxConfig({version: 4, module_: "XoteJSX"})

let count = Signal.make(0)

let make = () =>
  View.element(
    "div",
    ~attrs=[View.attr("class", "counter")],
    ~events=[("click", _ => Signal.update(count, n => n + 1))],
    ~children=[View.signalInt(() => Signal.get(count))],
    (),
  )
`

const sandbox = { globalThis: null, window: null, console }
sandbox.globalThis = sandbox
sandbox.window = sandbox
vm.createContext(sandbox)

vm.runInContext(readFileSync(path.join(dist, 'compiler.js'), 'utf8'), sandbox)
for (const cmij of [
  'packages/compiler-builtins/cmij.js',
  'packages/rescript-signals/cmij.js',
  'packages/xote/cmij.js',
]) {
  vm.runInContext(readFileSync(path.join(dist, cmij), 'utf8'), sandbox)
}

const compiler = sandbox.rescript_compiler.make()
compiler.setModuleSystem('esmodule')
compiler.setOpenModules(['Xote'])
console.log('compiler version:', sandbox.rescript_compiler.version)

const result = compiler.rescript.compile(SNIPPET)

if (result.type !== 'success') {
  console.error('Bundle failed to compile the xote snippet:')
  console.error(JSON.stringify(result, null, 2))
  process.exit(1)
}

if (!result.js_code.includes('View')) {
  console.error('Compiled, but emitted code does not reference View — cmij set is wrong.')
  process.exit(1)
}

// Deliberately ONE child: multi-child JSX with a custom jsx module raises
// Not_found inside the playground compiler. That is an upstream bug, present in
// the stock 12.3.1 bundle from cdn.rescript-lang.org too, and nothing to do with
// the ppx -- but it would masquerade as a ppx failure here.
//
// The @xote.component PPX is linked into the compiler (see build-bundle.sh
// step 2b). Verify it actually ran, because the failure mode is silent: an
// unexpanded @xote.component is a no-op attribute that ReScript drops without
// a warning, leaving code that compiles fine and is simply not reactive.
const PPX_SNIPPET = `
@@jsxConfig({version: 4, module_: "XoteJSX"})

@xote.component
let make = () => {
  let count = Signal.make(0)
  <div class={Signal.get(count) > 0 ? "on" : "off"}> {Signal.get(count)} </div>
}
`

const ppx = compiler.rescript.compile(PPX_SNIPPET)

if (ppx.type !== 'success') {
  console.error('Bundle failed to compile an @xote.component snippet:')
  console.error(JSON.stringify(ppx, null, 2))
  console.error()
  console.error('A type error naming `element` usually means the ppx did NOT run:')
  console.error('without it, {label} and {Signal.get(count)} are never wrapped in')
  console.error('View.child, so a string/int lands where a node is expected.')
  process.exit(1)
}

// The signature of a real expansion: reactive leaves become thunks. Without the
// ppx the same source either fails to type-check or emits plain values.
for (const marker of ['View', 'child', '=>']) {
  if (!ppx.js_code.includes(marker)) {
    console.error(`@xote.component compiled, but emitted code lacks ${marker} —`)
    console.error('the attribute was dropped rather than expanded.')
    console.error(ppx.js_code)
    process.exit(1)
  }
}

console.log('Bundle verified: xote snippet compiled, @xote.component expanded.')
