/**
 * The playground emits ESM with specifiers the browser cannot resolve:
 *
 *   import * as V from "xote/src/View.res.mjs"                    (bare)
 *   import * as P from "@rescript/runtime/lib/es6/Primitive_option.js"
 *   import * as V from "./stdlib/View-Xote.js"                    (compiler-internal)
 *
 * A blob/srcdoc module cannot resolve any of them, so we rewrite them to real
 * URLs before execution. We rewrite rather than emit an import map because the
 * sandboxed iframe has an opaque origin, where import maps are awkward, and
 * because rewriting keeps the failure mode visible (an unmapped specifier
 * throws with the original name in the message).
 *
 * Everything resolves against `vendorBase`, an absolute URL ending in a slash.
 * The caller computes it from the document at runtime, so the same build works
 * at a site root and under a subpath (a GitHub project page) with no rebuild.
 */

/** Bare specifier prefixes that correspond to a vendored package. */
const VENDORED = ['xote/', '@rescript/runtime/', 'rescript-signals/']

/**
 * The playground compiler emits every module in the cmij set as
 * "./stdlib/<Module>.js" — namespaced ones as "<Module>-<Namespace>.js". That
 * path is a fiction: it names the compiler's own virtual filesystem, not
 * anything servable, and being relative it cannot resolve from a blob: URL at
 * all ("base scheme isn't hierarchical").
 *
 * `manifest` maps that bare module name to a path relative to the vendor root.
 * vendor.mjs builds it by walking what it actually copied, rather than
 * reconstructing paths from package layout, because layout varies
 * (rescript-signals nests under src/signals/, xote is flat under src/).
 */
const STDLIB = './stdlib/'

// The `\(?` arm covers dynamic `import("…")` as well as static imports.
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(?\s*)(["'])([^"']+)\2/g

export function rewriteImports(js, vendorBase, manifest = {}) {
  return js.replace(SPECIFIER, (match, keyword, quote, specifier) => {
    const resolve = rel => `${keyword}${quote}${new URL(rel, vendorBase).href}${quote}`

    if (specifier.startsWith(STDLIB)) {
      const mod = specifier.slice(STDLIB.length).replace(/\.js$/, '')
      // Leave an unknown module intact: the failure then names it, which is the
      // only clue that the cmij set and the vendored runtime disagree.
      return manifest[mod] ? resolve(manifest[mod]) : match
    }

    if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.includes('://')) {
      return match
    }

    return VENDORED.some(p => specifier.startsWith(p)) ? resolve(specifier) : match
  })
}
