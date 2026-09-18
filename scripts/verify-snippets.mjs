/**
 * Compile every bundled snippet against the real playground bundle.
 *
 * The snippets are the playground's documentation, and the previous default one
 * was subtly wrong for a long time because nothing ever ran it. This closes that
 * gap: a snippet that does not compile fails the build.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import { SNIPPETS } from '../app/src/snippets.js'

const dist = path.join(import.meta.dirname, '..', 'dist')

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

const strip = s => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '')
let failed = 0

for (const snippet of SNIPPETS) {
  const result = compiler.rescript.compile(snippet.code)

  if (result.type !== 'success') {
    failed++
    console.error(`\n✗ ${snippet.id} (${snippet.label}) — ${result.type}`)
    if (result.type === 'unexpected_error') {
      console.error(`  ${strip(result.msg)}`)
    } else {
      for (const e of result.errors ?? []) console.error(`  ${strip(e.shortMsg ?? e.fullMsg)}`)
    }
    continue
  }

  // A snippet that compiles but does not export `make` cannot be mounted, and
  // the runner would fail silently inside the sandboxed iframe.
  if (!/\bmake\b/.test(result.js_code)) {
    failed++
    console.error(`\n✗ ${snippet.id} — compiled, but emits no \`make\` for the runner to mount`)
    continue
  }

  console.log(`✓ ${snippet.id.padEnd(12)} ${snippet.label}`)
}

if (failed) {
  console.error(`\n${failed} of ${SNIPPETS.length} snippets failed to compile.`)
  process.exit(1)
}

console.log(`\nAll ${SNIPPETS.length} snippets compile.`)
