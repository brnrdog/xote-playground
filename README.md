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

- **`@xote.component` works, but only because the compiler is patched.** A
  ReScript ppx is a binary the build system runs between parse and compile; the
  playground compiler has no such seam (`compile(source) -> js` is the entire
  API). So the rewriter is *linked into* the compiler and called on the parsed
  structure, just before ReScript's own `Ppx_entry` lowers JSX. That is possible
  only because xote's ppx is plain stdlib-only OCaml over a verbatim copy of
  ReScript's frozen ppx parsetree (`compiler/ml/parsetree0.ml`). See
  `scripts/build-bundle.sh` step 2b. **A stock bundle from
  `cdn.rescript-lang.org` has no ppx** — it must be built from source.
- **Sibling JSX children raise `Not_found`.** With a custom `jsx.module`, two or
  more JSX children break the playground compiler. This is upstream — the stock
  12.3.1 bundle fails identically, with or without the ppx — and the workaround
  is one child holding an explicit `XoteJSX.array([...])`. See
  `docs/authoring-snippets.md`.
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
| **opam >= 2.1** | the OCaml package manager. Older opam (2.0.x) silently picks prerelease packages and the dep build fails with `Library "seq" not found` — see below. **No switch setup needed** — if your active switch cannot resolve the build deps, the build creates its own local switch (see below) |
| dune | installed by opam from `rescript.opam`; not a prerequisite |
| node | the compiler repo is a Yarn 4 workspace, but vendors its own Yarn — corepack is *not* required |
| **cargo (Rust >= 1.91)** | ReScript 12's `rescript` CLI *is* rewatch, a Rust binary, and the stdlib build depends on it |
| python3 + a **working** C++ compiler | bootstraps ninja — ReScript vendors a *forked* ninja (its lexer accepts `o` as a synonym for `build`), so a system ninja cannot substitute |

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

`scripts/build-bundle.sh` has been run end to end on macOS (Intel, opam 2.6.0,
OCaml 5.3.0) and produces a bundle that compiles and expands `@xote.component`;
`npm run bundle:verify` asserts exactly that.

Notes from reading that tree, in case the build surprises you:

- The ReScript repo is a **Yarn 4 workspace**. `npm ci` fails on it with
  `EUNSUPPORTEDPROTOCOL … Unsupported URL Type "workspace:"`, because
  `workspace:^` is a Yarn/pnpm protocol. Use the Yarn the checkout vendors.
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
- **opam 2.0.x cannot build this.** opam 2.1 introduced the `avoid-version`
  flag, which opam-repository uses to keep prereleases out of solutions. opam
  2.0 ignores the flag and so *prefers* them — it selects
  `ocamlfind.1.9.9~preview`, which does not install the `seq` findlib stub, and
  every dune package depending on `seq` (`gen`, `yojson`, …) then fails with
  `Error: Library "seq" not found`. The failures look unrelated to opam and land
  minutes into the build, so `build-bundle.sh` checks the opam version in
  preflight instead.
- Installing the deps into the active opam switch can fail with
  `ocaml-compiler -> compiler-cloning < enabled / base of this switch`. The
  OCaml version is **not** a reliable predictor of this: it happens on a *new*
  switch whose base is locked (seen on 5.5.0), not just an old one. So the build
  does not guess from the version — it asks the solver with
  `opam install . --deps-only --with-test --dry-run`, which mutates nothing, and
  falls back only when that probe fails. The fallback is a **local switch**
  (`_opam/` inside the throwaway checkout) pinned to `bundle/ocaml.version`,
  rather than passing `--unlock-base` and rebuilding your global switch's
  compiler. Creating it compiles OCaml from source, so that build is slow; set
  `XOTE_PLAYGROUND_LOCAL_SWITCH=1` to force it even when the active switch
  would do.
- **macOS: a stale Command Line Tools install breaks every C++ build.** An old
  `/Library/Developer/CommandLineTools/usr/include/c++/v1` (recognisable by
  `__sso_allocator`, removed from libc++ years ago) *shadows* the current headers
  in the SDK, and clang searches it first. Ninja's bootstrap then dies on
  `fatal error: 'cstdio' file not found`, and binaryen on `'mutex' file not
  found`. `build-bundle.sh` detects this and points at the SDK headers instead;
  the real fix is `sudo rm -rf /Library/Developer/CommandLineTools &&
  sudo xcode-select --install`.
- **`--with-test` is deliberately not used.** rescript.opam declares js_of_ocaml
  under `with-test`, but so is `wasm_of_ocaml-compiler`, which drags in a large
  binaryen C++ build for an artifact the playground never loads. jsoo is
  installed by name instead, and step 2b drops the jsoo stanza's `wasm` target.
- The checkout vendors Yarn 4 at `.yarn/releases/` (via `.yarnrc.yml`
  `yarnPath`) and it runs under plain `node`. The build shims that onto `PATH`
  instead of using corepack, which is not present on every Node install and is
  being unbundled from Node; a global Yarn Classic would be the wrong major
  version for this workspace.
- `make playground` succeeds at `playground-compiler` (jsoo) and *then* needs
  cargo for `playground-cmijs`: that target depends on the stdlib build, which
  depends on `$(RESCRIPT_EXE)` — rewatch. So a cargo-less machine produces a
  perfectly good `compiler.js` and no cmijs at all.
