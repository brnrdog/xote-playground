/**
 * Populate app/public/vendor/ with the runtime modules the sandboxed preview
 * imports (xote, rescript-signals, rescript's es6 lib).
 *
 * These are the *runtime* halves of the story — distinct from the cmij set in
 * dist/, which is what the compiler type-checks against. Both must come from the
 * same versions or a snippet will compile and then fail to run.
 */
import { cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const out = path.join(import.meta.dirname, '..', 'app', 'public', 'vendor')

const COPIES = [
  ['xote', ['src']],
  ['rescript-signals', ['src']],
  ['rescript', ['lib/es6']],
]

await rm(out, { recursive: true, force: true })

for (const [pkg, subdirs] of COPIES) {
  const root = path.dirname(require.resolve(`${pkg}/package.json`))
  for (const sub of subdirs) {
    const from = path.join(root, sub)
    const to = path.join(out, pkg, sub)
    await mkdir(path.dirname(to), { recursive: true })
    await cp(from, to, { recursive: true })
    console.log(`vendored ${pkg}/${sub}`)
  }
}
