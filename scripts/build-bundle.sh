#!/usr/bin/env bash
#
# Build a ReScript playground compiler bundle with xote baked into its cmij set.
#
# Output (in dist/):
#   compiler.js                     js_of_ocaml build of the ReScript compiler
#   packages/compiler-builtins/     stdlib cmij + the rolled-up ES6 runtime
#   packages/xote/cmij.js           xote artifacts
#   packages/rescript-signals/cmij.js
#
# Requirements: opam/OCaml with js_of_ocaml, dune, node, and corepack (for Yarn).
# The ReScript repo is a Yarn 4 workspace — npm cannot install it, because
# `workspace:^` is a Yarn/pnpm protocol that npm rejects with EUNSUPPORTEDPROTOCOL.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${ROOT}/.work"
DIST="${ROOT}/dist"
RESCRIPT_VERSION="$(tr -d '[:space:]' < "${ROOT}/bundle/rescript.version")"
XOTE_VERSION="$(tr -d '[:space:]' < "${ROOT}/bundle/xote.version")"

echo "==> ReScript compiler: v${RESCRIPT_VERSION}"
echo "==> xote:              ${XOTE_VERSION}"

# dist/ is created only in step 4, once there is something to put in it. A
# half-built dist/ is worse than none: install-bundle.mjs would report it as an
# "incomplete bundle" and bury the build error that actually caused it.
rm -rf "${WORK}" "${DIST}"
mkdir -p "${WORK}"

STAGE="${WORK}/stage"

on_error() {
  local line=$1
  echo >&2
  echo "==> BUILD FAILED at ${0}:${line}" >&2
  echo "    Nothing was written to ${DIST}; the error above is the real one." >&2
  echo "    The compiler checkout is left at ${COMPILER:-${WORK}/rescript} for inspection." >&2
}
trap 'on_error $LINENO' ERR

# ---------------------------------------------------------------------------
# 1. Check out the pinned ReScript compiler
# ---------------------------------------------------------------------------
git clone --depth 1 --branch "v${RESCRIPT_VERSION}" \
  https://github.com/rescript-lang/rescript.git "${WORK}/rescript"

COMPILER="${WORK}/rescript"
PLAYGROUND="${COMPILER}/packages/playground"

# ---------------------------------------------------------------------------
# 2. Register xote as a playground dependency
#
# packages/playground/scripts/generate_cmijs.mjs reads the `dependencies` array
# of packages/playground/rescript.json and, for each entry, packs
# <compiler>/node_modules/<name>/lib/ocaml/*.{cmi,cmj} into a cmij. So adding
# xote is a matter of declaring it in both manifests before building.
# ---------------------------------------------------------------------------
node - "${PLAYGROUND}" "${XOTE_VERSION}" <<'NODE'
const fs = require('node:fs')
const path = require('node:path')
const [playground, xoteVersion] = process.argv.slice(2)

const resConfigPath = path.join(playground, 'rescript.json')
const resConfig = JSON.parse(fs.readFileSync(resConfigPath, 'utf8'))
for (const dep of ['xote', 'rescript-signals']) {
  if (!resConfig.dependencies.includes(dep)) resConfig.dependencies.push(dep)
}
fs.writeFileSync(resConfigPath, JSON.stringify(resConfig, null, 2) + '\n')

const pkgPath = path.join(playground, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
pkg.dependencies.xote = xoteVersion
pkg.dependencies['rescript-signals'] = '*'
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

console.log('playground deps:', resConfig.dependencies.join(', '))
NODE

# ---------------------------------------------------------------------------
# 3. Install (Yarn 4, via corepack) and build
# ---------------------------------------------------------------------------
cd "${COMPILER}"
corepack enable
yarn install --no-immutable   # --no-immutable: we just edited two manifests

# --with-test is load-bearing, not a nicety: rescript.opam declares js_of_ocaml
# (and wasm_of_ocaml-compiler) under `with-test`, so a plain --deps-only leaves
# jsoo uninstalled and `make playground` dies with
#   Program js_of_ocaml not found in the tree or in PATH
# The opam file also pin-depends flow_parser on a git fork, which opam resolves
# from the pin — so install from this directory, not by package name.
opam install . --deps-only --with-test --yes

# `make playground` = playground-compiler (dune --profile browser, jsoo) plus
# playground-cmijs (`yarn workspace playground build`, which runs
# generate_cmijs.mjs and the rollup that emits the ES6 runtime).
make playground

# ---------------------------------------------------------------------------
# 4. Collect
# ---------------------------------------------------------------------------
# Stage first, then move into place, so an interrupted collect cannot leave a
# partial dist/ behind either.
rm -rf "${STAGE}"
mkdir -p "${STAGE}"

for artifact in compiler.js packages; do
  if [ ! -e "${PLAYGROUND}/${artifact}" ]; then
    echo >&2 "==> BUILD INCOMPLETE: make playground did not produce ${PLAYGROUND}/${artifact}"
    exit 1
  fi
done

cp "${PLAYGROUND}/compiler.js" "${STAGE}/compiler.js"
cp -R "${PLAYGROUND}/packages" "${STAGE}/packages"

for required in \
  compiler.js \
  packages/compiler-builtins/cmij.js \
  packages/rescript-signals/cmij.js \
  packages/xote/cmij.js
do
  if [ ! -f "${STAGE}/${required}" ]; then
    echo >&2 "==> BUILD INCOMPLETE: ${required} was not generated."
    echo >&2 "    Check that packages/playground/rescript.json lists the dependency"
    echo >&2 "    and that <compiler>/node_modules/<pkg>/lib/ocaml exists."
    exit 1
  fi
done

mv "${STAGE}" "${DIST}"

echo "==> bundle written to ${DIST}"
find "${DIST}" -name 'cmij.js' | sort
