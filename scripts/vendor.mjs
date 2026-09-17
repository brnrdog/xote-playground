/**
 * Populate app/public/vendor/ with the runtime modules the sandboxed preview
 * imports (xote, rescript-signals, rescript's es6 lib).
 *
 * These are the *runtime* halves of the story — distinct from the cmij set in
 * dist/, which is what the compiler type-checks against. Both must come from the
 * same versions or a snippet will compile and then fail to run.
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const out = path.join(import.meta.dirname, '..', 'app', 'public', 'vendor')

// ReScript 12 split the runtime out of the `rescript` package (which now ships
// only the CLI and native binaries) into `@rescript/runtime`. That is the
// package xote's published .res.mjs import from, so that is what must be here.
const COPIES = [
  ['xote', ['src']],
  ['rescript-signals', ['src']],
  ['@rescript/runtime', ['lib/es6']],
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

// The vendored modules import each other by bare specifier too --
// xote's View.res.mjs pulls "@rescript/runtime/lib/es6/...". The runner only
// rewrites the *snippet*, so those would reach the browser untouched and fail
// with "Failed to resolve module specifier". Rewrite them once here, at vendor
// time, rather than on every run.
//
// They are rewritten to *relative* paths, not "/vendor/..." ones: a module
// specifier resolves against the importing module's own URL, so a relative path
// keeps working wherever the site is mounted -- at a domain root, or under a
// subpath like a GitHub project page -- with no rebuild.
const VENDORED = ['xote/', '@rescript/runtime/', 'rescript-signals/']
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(?\s*)(["'])([^"']+)\2/g

let rewritten = 0
const files = await readdir(out, { recursive: true, withFileTypes: true })

for (const file of files) {
  if (!file.isFile() || !/\.m?js$/.test(file.name)) continue
  const full = path.join(file.parentPath ?? file.path, file.name)
  const src = await readFile(full, 'utf8')

  const next = src.replace(SPECIFIER, (match, keyword, quote, specifier) => {
    if (!VENDORED.some(prefix => specifier.startsWith(prefix))) return match
    let rel = path.relative(path.dirname(full), path.join(out, specifier))
    rel = rel.split(path.sep).join('/')
    // A bare "foo.js" would be read as a package name, not a sibling file.
    if (!rel.startsWith('.')) rel = `./${rel}`
    return `${keyword}${quote}${rel}${quote}`
  })

  if (next !== src) {
    await writeFile(full, next)
    rewritten++
  }
}
console.log(`rewrote bare specifiers in ${rewritten} vendored modules`)

// Build the "./stdlib/<Module>.js" -> path manifest the runner needs. Paths are
// relative to the vendor root, which the runner resolves against a base it
// computes from the document -- again so the mount point does not matter.
const manifest = {}

function namespaceOf(pkgRoot, pkgName) {
  let ns
  try {
    ns = JSON.parse(readFileSync(path.join(pkgRoot, 'rescript.json'), 'utf8')).namespace
  } catch {
    return null
  }
  if (ns === true) {
    const base = pkgName.split('/').pop()
    return base.charAt(0).toUpperCase() + base.slice(1)
  }
  return typeof ns === 'string' ? ns : null
}

for (const [pkg, subdirs] of COPIES) {
  const pkgRoot = path.dirname(require.resolve(`${pkg}/package.json`))
  const ns = namespaceOf(pkgRoot, pkg)
  for (const sub of subdirs) {
    const base = path.join(out, pkg, sub)
    for (const f of await readdir(base, { recursive: true, withFileTypes: true })) {
      if (!f.isFile()) continue
      const mod = f.name.replace(/\.res\.mjs$/, '').replace(/\.js$/, '')
      if (mod === f.name) continue
      const rel = path
        .relative(out, path.join(f.parentPath ?? f.path, f.name))
        .split(path.sep)
        .join('/')
      manifest[ns ? `${mod}-${ns}` : mod] = rel
    }
  }
}

await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`wrote manifest with ${Object.keys(manifest).length} modules`)
