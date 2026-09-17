# xote-playground

In-browser ReScript playground for [xote](https://github.com/brnrdog/xote).

Two things live here:

1. **`bundle/`** — the build that produces a custom ReScript playground compiler
   (`compiler.js` + a `cmij` set) with `xote` and `rescript-signals` baked in, so
   playground code can `open Xote` and use `View` / `Signal` / `XoteJSX`.
2. **`app/`** — the playground UI: a CodeMirror editor, a compile worker, and a
   sandboxed iframe that runs the emitted JavaScript.

It is deliberately a separate repository from `brnrdog/xote`: the bundle build
needs an OCaml toolchain and a checkout of the ReScript compiler, which has no
business in the library's CI.

## Why a custom bundle

ReScript's browser compiler is a `js_of_ocaml` build of the compiler
(`compiler.js`) plus `cmij` archives holding the `.cmi`/`.cmj` artifacts of every
module the playground can compile against. It is **not published to npm** — the
`rescript` package ships only native binaries and CLI wrappers (verified against
`rescript@12.3.1`: 22 files, no playground artifact). The official playground
loads its bundle from `cdn.rescript-lang.org`, and that bundle knows the stdlib
plus `@rescript/react` — not xote.

So compiling xote code in the browser means building our own bundle, the same way
rescript-lang.org builds theirs, with xote's artifacts added to the cmij set.

## Known constraints

These are load-bearing; read them before changing the design.

- **`@xote.component` cannot run in the browser.** The PPX is a native OCaml
  executable (`ppx/bin` in the xote repo). The playground compiler has no PPX
  hook, so **playground snippets must be PPX-free**: explicit `() => ...` thunks,
  `View.signalText`, `<View.Int>` and friends. Most examples in `docs-website/`
  are PPX-style and will not paste in unchanged. See `docs/authoring-snippets.md`.
- **The bundle pins one xote version.** Every xote release that changes the public
  API needs a bundle rebuild. That is what `.github/workflows/bundle.yml` is for.
- **Emitted code imports bare specifiers** (`rescript/lib/es6/...`,
  `xote/src/View.res.mjs`). The runner rewrites these to real URLs before
  execution — see `app/src/runtime/rewrite.js`.
- **Untrusted code runs in a sandboxed iframe**, never in the host page, so a
  runaway effect or an infinite loop can be killed by replacing the frame.

## Running it locally

The playground does not work from a fresh clone alone: the compiler bundle is a
build artifact, not source, and it is gitignored. Without it the editor loads and
every compile fails with "No compiler bundle installed."

Building the bundle needs a fuller toolchain than a JS project usually implies:

| Tool | Why |
|---|---|
| opam + OCaml >= 5.0 | the compiler; CI uses 5.3.0, as upstream does |
| dune | build driver |
| node + corepack | the compiler repo is a Yarn 4 workspace |
| **cargo (Rust >= 1.91)** | ReScript 12's `rescript` CLI *is* rewatch, a Rust binary, and the stdlib build depends on it |
| python3 + a C++ compiler | bootstraps ninja |

`scripts/build-bundle.sh` checks all of these up front and names what is
missing, rather than failing minutes into the build.

```sh
npm install                 # runtime deps (xote, rescript-signals, rescript)
./scripts/build-bundle.sh   # produces dist/
npm run setup               # installs app deps, vendors runtime modules, installs the bundle
npm run dev
```

If you do not have an OCaml toolchain, download the `xote-playground-bundle`
artifact from a CI run and point the installer at it instead of building:

```sh
npm run bundle:install -- path/to/unpacked-artifact
```

Two separate things have to line up, and it is worth keeping them straight:

| | What it is | Where it goes | Produced by |
|---|---|---|---|
| **cmij set** | `.cmi`/`.cmj` artifacts the compiler *type-checks against* | `app/public/bundle/` | `build-bundle.sh` |
| **vendor** | the `.mjs` the preview iframe *imports at runtime* | `app/public/vendor/` | `scripts/vendor.mjs` |

Both must come from the same xote version, or a snippet will compile cleanly and
then fail at runtime.

## Layout

```
bundle/
  rescript.version        pinned ReScript compiler tag
  xote.version            pinned xote version baked into the cmij set
scripts/
  build-bundle.sh         builds compiler.js + cmij (needs OCaml + opam)
  install-bundle.mjs      copies a built bundle into app/public/bundle/
  vendor.mjs              copies runtime .mjs into app/public/vendor/
  verify-bundle.mjs       smoke-test: compile a xote snippet headlessly
app/
  src/                    editor, compile worker, iframe runner
docs/
  authoring-snippets.md   what is and isn't allowed in playground code
```

## Status

`scripts/build-bundle.sh` is written against the real v12.3.1 compiler tree
(`packages/playground/`, `make playground`, `scripts/generate_cmijs.mjs`), not
guessed. It has still **not been run end to end** — that first run is the real
test.

Notes from reading that tree, in case the build surprises you:

- The ReScript repo is a **Yarn 4 workspace**. `npm ci` fails on it with
  `EUNSUPPORTEDPROTOCOL … Unsupported URL Type "workspace:"`, because
  `workspace:^` is a Yarn/pnpm protocol. Use `corepack enable && yarn install`.
- cmij layout is `packages/<name>/cmij.js` with the stdlib under
  `packages/compiler-builtins/`, not a flat `stdlib/cmij.js`.
- Dependencies are declared in `packages/playground/rescript.json` and packed
  from `<compiler>/node_modules/<name>/lib/ocaml`, which is why step 2 of the
  build script edits that manifest.
- The playground API has **no `setConfig`** and no JSX-module setting — see
  `docs/authoring-snippets.md`.
- `js_of_ocaml` is declared **`with-test`** in `rescript.opam`, so the deps
  install needs `--with-test` or `make playground` fails with
  `Program js_of_ocaml not found in the tree or in PATH`.
- Needs **OCaml >= 5.0**; upstream CI builds the playground on 5.3.0, which is
  what `.github/workflows/bundle.yml` uses.
- `rescript.opam` `pin-depends` a `flow_parser` git fork, so deps must be
  installed from the checkout directory (`opam install .`), not by package name.
- `make playground` succeeds at `playground-compiler` (jsoo) and *then* needs
  cargo for `playground-cmijs`: that target depends on the stdlib build, which
  depends on `$(RESCRIPT_EXE)` — rewatch. So a cargo-less machine produces a
  perfectly good `compiler.js` and no cmijs at all.
