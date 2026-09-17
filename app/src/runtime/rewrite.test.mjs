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
