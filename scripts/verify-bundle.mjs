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
let count = Signal.make(0)

let make = () =>
  View.element(
    "button",
    ~attrs=[View.attr("type", "button")],
    [View.signalText(count, n => Int.toString(n))],
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

console.log('Bundle verified: xote snippet compiled.')
