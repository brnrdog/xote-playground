# Authoring playground snippets

## The PPX is not available

`@xote.component` is a native OCaml binary in the xote repo (`ppx/bin`). The
browser compiler has no PPX hook, so **no playground snippet may use it.**

This is the single biggest difference between playground code and the examples
in `docs-website/`, and it is not a temporary limitation — it follows from the
playground compiler being a `js_of_ocaml` build with no process to shell out to.

Practically, write the reactive parts by hand:

| With the PPX (docs-website)      | In the playground                          |
|----------------------------------|--------------------------------------------|
| `{Signal.get(count)}` as a child | `View.signalText(count, Int.toString)`     |
| `class={"x " ++ Signal.get(s)}`  | `View.signalAttr("class", s, v => "x " ++ v)` |
| bare `{"text"}` child            | `View.text("text")`                         |
| `<View.Int>` via bare child      | `View.signalInt(count)`                     |

## JSX needs a file-level attribute

The playground compiler hardcodes JSX v4 with the **React** transform, and
exposes no way to change it: `jsoo_playground_main.ml` (v12.3.1) offers only
`setModuleSystem`, `setFilename`, `setWarnFlags`, `setOpenModules`,
`setExperimentalFeatures` and `setJsxPreserveMode`. There is no `setConfig` and
no JSX-module knob.

The escape hatch is the file-level attribute, which the compile worker prepends
automatically unless a snippet declares its own:

```rescript
@@jsxConfig({version: 4, module_: "XoteJSX"})
```

So JSX does work in the playground — just not via configuration. A snippet that
wants different JSX settings should write its own `@@jsxConfig` line.

## Every snippet exports `make`

The runner bootstraps with `View.mount(root, make())`. A snippet must therefore
define a top-level `make: unit => View.node`. Anything else compiles but renders
nothing.

## The module surface

Snippets compile with `-open Xote`, so `View`, `Signal`, `Computed`, `Effect`,
`MaybeSignal`, `Html`, `Route`, `Router` and the rest of the public API are in
scope unqualified — the same as `docs-website/rescript.json`'s `compiler-flags`.

`SSR`, `SSRState` and `Hydration` are in the bundle but not useful in the
playground: there is no server. `Router` works, but navigation is scoped to the
sandboxed iframe.

## Keeping snippets in sync with xote

The bundle pins one xote version (`bundle/xote.version`). A snippet that uses an
API added after that version will fail to compile with a confusing "unbound
value" error. When xote releases, bump the pin and let CI rebuild.
