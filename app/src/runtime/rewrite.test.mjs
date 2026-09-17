/** Minimal assertions for the import rewriter — run with `node rewrite.test.mjs`. */
import assert from 'node:assert/strict'
import { rewriteImports } from './rewrite.js'

// A vendor base is an absolute URL ending in a slash. It is computed at runtime
// from the document, so these tests cover both a site at the root and one
// served from a subpath (a GitHub project page).
const ROOT = 'https://play.xote.dev/vendor/'
const SUBPATH = 'https://brnrdog.github.io/xote-playground/vendor/'

// Bare specifiers for vendored packages resolve against the vendor base.
assert.equal(
  rewriteImports('import * as V from "xote/src/View.res.mjs"', ROOT),
  'import * as V from "https://play.xote.dev/vendor/xote/src/View.res.mjs"',
)
assert.equal(
  rewriteImports('import * as V from "xote/src/View.res.mjs"', SUBPATH),
  'import * as V from "https://brnrdog.github.io/xote-playground/vendor/xote/src/View.res.mjs"',
)
assert.equal(
  rewriteImports('import * as S from "rescript-signals/src/Signal.res.mjs"', ROOT),
  'import * as S from "https://play.xote.dev/vendor/rescript-signals/src/Signal.res.mjs"',
)
// ReScript 12 moved the runtime out of `rescript` and into `@rescript/runtime`.
assert.equal(
  rewriteImports('import * as P from "@rescript/runtime/lib/es6/Primitive_option.js"', ROOT),
  'import * as P from "https://play.xote.dev/vendor/@rescript/runtime/lib/es6/Primitive_option.js"',
)

// The playground compiler emits every cmij module as "./stdlib/<Module>.js",
// namespace-suffixed. Those are relative, so they cannot resolve from the blob:
// URL the snippet runs as — they go through the manifest vendor.mjs writes,
// whose values are relative to the vendor root.
const MANIFEST = {
  'View-Xote': 'xote/src/View.res.mjs',
  'Signal-Signals': 'rescript-signals/src/signals/Signal.res.mjs',
  Stdlib_Option: '@rescript/runtime/lib/es6/Stdlib_Option.js',
}
assert.equal(
  rewriteImports('import * as V from "./stdlib/View-Xote.js"', ROOT, MANIFEST),
  'import * as V from "https://play.xote.dev/vendor/xote/src/View.res.mjs"',
)
assert.equal(
  rewriteImports('import * as V from "./stdlib/View-Xote.js"', SUBPATH, MANIFEST),
  'import * as V from "https://brnrdog.github.io/xote-playground/vendor/xote/src/View.res.mjs"',
)
assert.equal(
  rewriteImports('import * as O from "./stdlib/Stdlib_Option.js"', ROOT, MANIFEST),
  'import * as O from "https://play.xote.dev/vendor/@rescript/runtime/lib/es6/Stdlib_Option.js"',
)
// An unknown stdlib module is left intact so the failure names it.
assert.equal(
  rewriteImports('import * as X from "./stdlib/Nope.js"', ROOT, MANIFEST),
  'import * as X from "./stdlib/Nope.js"',
)

// Relative, absolute and already-qualified specifiers are left alone.
for (const spec of ['./local.js', '/abs.js', 'https://cdn.example/x.js']) {
  const src = `import x from "${spec}"`
  assert.equal(rewriteImports(src, ROOT), src, `should not rewrite ${spec}`)
}

// An unmapped bare specifier is left intact so the failure names it.
assert.equal(
  rewriteImports('import x from "some-other-pkg"', ROOT),
  'import x from "some-other-pkg"',
)

// Dynamic import and single quotes.
assert.equal(
  rewriteImports("const m = await import('xote/src/Signal.res.mjs')", ROOT),
  `const m = await import('https://play.xote.dev/vendor/xote/src/Signal.res.mjs')`,
)

console.log('rewrite: all assertions passed')
