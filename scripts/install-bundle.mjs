/**
 * Install a compiler bundle into app/public/bundle/ so the dev server and the
 * preview build can serve it.
 *
 * The bundle is a build artifact, not source: it is gitignored, produced by
 * scripts/build-bundle.sh (or by CI), and has to be placed under app/public/
 * before the playground can compile anything.
 *
 *   node scripts/install-bundle.mjs            # from ./dist (a local build)
 *   node scripts/install-bundle.mjs <dir>      # from an unpacked CI artifact
 */
import { access, cp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const from = path.resolve(process.argv[2] ?? path.join(root, 'dist'))
const to = path.join(root, 'app', 'public', 'bundle')

const REQUIRED = [
  'compiler.js',
  'packages/compiler-builtins/cmij.js',
  'packages/rescript-signals/cmij.js',
  'packages/xote/cmij.js',
]

try {
  await access(from)
} catch {
  console.error(`No bundle at ${from}.`)
  console.error('Build one with ./scripts/build-bundle.sh, or download the')
  console.error('xote-playground-bundle artifact from a CI run and pass its path.')
  process.exit(1)
}

// An empty dist/ means the build aborted, not that the bundle is malformed.
// Saying "incomplete bundle" there sends people looking in the wrong place.
const { readdir } = await import('node:fs/promises')
if ((await readdir(from)).length === 0) {
  console.error(`${from} is empty — the build did not finish.`)
  console.error('Re-run ./scripts/build-bundle.sh and read the first error it prints;')
  console.error('the failure is upstream of this script.')
  process.exit(1)
}

const missing = []
for (const file of REQUIRED) {
  try {
    await access(path.join(from, file))
  } catch {
    missing.push(file)
  }
}

if (missing.length) {
  console.error(`Incomplete bundle at ${from} — missing:`)
  for (const file of missing) console.error(`  ${file}`)
  process.exit(1)
}

await rm(to, { recursive: true, force: true })
await mkdir(path.dirname(to), { recursive: true })
await cp(from, to, { recursive: true })

console.log(`Installed bundle: ${from} -> ${to}`)
