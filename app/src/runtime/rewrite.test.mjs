/** Minimal assertions for the import rewriter — run with `node rewrite.test.mjs`. */
import assert from 'node:assert/strict'
import { rewriteImports } from './rewrite.js'

const ORIGIN = 'https://play.xote.dev'

// Bare xote and rescript specifiers are mapped.
assert.equal(
  rewriteImports('import * as V from "xote/src/View.res.mjs"', ORIGIN),
  'import * as V from "https://play.xote.dev/vendor/xote/src/View.res.mjs"',
)
assert.equal(
  rewriteImports('import * as C from "rescript/lib/es6/caml_option.js"', ORIGIN),
  'import * as C from "https://play.xote.dev/vendor/rescript/lib/es6/caml_option.js"',
)
assert.equal(
  rewriteImports('import * as S from "rescript-signals/src/Signal.res.mjs"', ORIGIN),
  'import * as S from "https://play.xote.dev/vendor/rescript-signals/src/Signal.res.mjs"',
)

// ReScript 12 moved the runtime out of `rescript` and into `@rescript/runtime`;
// that is what xote's published .res.mjs actually import.
assert.equal(
  rewriteImports('import * as P from "@rescript/runtime/lib/es6/Primitive_option.js"', ORIGIN),
  'import * as P from "https://play.xote.dev/vendor/@rescript/runtime/lib/es6/Primitive_option.js"',
)

// The playground compiler emits every cmij module as "./stdlib/<Module>.js",
// namespace-suffixed. Those are relative, so they cannot resolve from the
// blob: URL the snippet runs as -- they must be mapped through the manifest
// that vendor.mjs writes.
const MANIFEST = {
  'View-Xote': '/vendor/xote/src/View.res.mjs',
  'Signal-Signals': '/vendor/rescript-signals/src/signals/Signal.res.mjs',
  Stdlib_Option: '/vendor/@rescript/runtime/lib/es6/Stdlib_Option.js',
}
assert.equal(
  rewriteImports('import * as V from "./stdlib/View-Xote.js"', ORIGIN, undefined, MANIFEST),
  'import * as V from "https://play.xote.dev/vendor/xote/src/View.res.mjs"',
)
assert.equal(
  rewriteImports('import * as S from "./stdlib/Signal-Signals.js"', ORIGIN, undefined, MANIFEST),
  'import * as S from "https://play.xote.dev/vendor/rescript-signals/src/signals/Signal.res.mjs"',
)
assert.equal(
  rewriteImports('import * as O from "./stdlib/Stdlib_Option.js"', ORIGIN, undefined, MANIFEST),
  'import * as O from "https://play.xote.dev/vendor/@rescript/runtime/lib/es6/Stdlib_Option.js"',
)
// An unknown stdlib module is left intact so the failure names it.
assert.equal(
  rewriteImports('import * as X from "./stdlib/Nope.js"', ORIGIN, undefined, MANIFEST),
  'import * as X from "./stdlib/Nope.js"',
)

// Relative, absolute and already-qualified specifiers are left alone.
for (const spec of ['./local.js', '/abs.js', 'https://cdn.example/x.js']) {
  const src = `import x from "${spec}"`
  assert.equal(rewriteImports(src, ORIGIN), src, `should not rewrite ${spec}`)
}

// An unmapped bare specifier is left intact so the failure names it.
assert.equal(
  rewriteImports('import x from "some-other-pkg"', ORIGIN),
  'import x from "some-other-pkg"',
)

// Dynamic import and single quotes.
assert.equal(
  rewriteImports("const m = await import('xote/src/Signal.res.mjs')", ORIGIN),
  `const m = await import('https://play.xote.dev/vendor/xote/src/Signal.res.mjs')`,
)

console.log('rewrite: all assertions passed')
