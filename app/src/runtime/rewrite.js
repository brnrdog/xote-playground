/**
 * The playground emits ESM with bare specifiers:
 *
 *   import * as Signal from "xote/src/Signal.res.mjs"
 *   import * as P from "@rescript/runtime/lib/es6/Primitive_option.js"
 *
 * A blob/srcdoc module cannot resolve those, so we rewrite them to URLs the
 * sandbox can fetch. We rewrite rather than emit an import map because the
 * sandboxed iframe has an opaque origin, where import maps are awkward, and
 * because rewriting keeps the failure mode visible (an unmapped specifier
 * throws with the original name in the message).
 */

/** Bare specifier prefix -> URL prefix. */
// Order matters: '@rescript/runtime/' must be tried before any shorter prefix
// that could also match it.
const DEFAULT_MAP = {
  'xote/': '/vendor/xote/',
  '@rescript/runtime/': '/vendor/@rescript/runtime/',
  'rescript/': '/vendor/rescript/',
  'rescript-signals/': '/vendor/rescript-signals/',
}

// The `\(?` arm covers dynamic `import("…")` as well as static imports.
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(?\s*)(["'])([^"']+)\2/g

export function rewriteImports(js, origin, map = DEFAULT_MAP) {
  return js.replace(SPECIFIER, (match, keyword, quote, specifier) => {
    if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.includes('://')) {
      return match
    }

    for (const [prefix, target] of Object.entries(map)) {
      if (specifier.startsWith(prefix)) {
        const url = `${origin}${target}${specifier.slice(prefix.length)}`
        return `${keyword}${quote}${url}${quote}`
      }
    }

    return match
  })
}
