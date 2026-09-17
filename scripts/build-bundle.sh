#!/usr/bin/env bash
#
# Build a ReScript playground compiler bundle with xote baked into its cmij set.
#
# Output (in dist/):
#   compiler.js          js_of_ocaml build of the ReScript compiler
#   stdlib/*.cmij.js     stdlib artifacts the compiler resolves against
#   xote.cmij.js         xote + rescript-signals artifacts
#
# Requirements: opam/OCaml (the version the pinned compiler expects), node, npm.
# CI installs these via .github/workflows/bundle.yml.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${ROOT}/.work"
DIST="${ROOT}/dist"
RESCRIPT_VERSION="$(tr -d '[:space:]' < "${ROOT}/bundle/rescript.version")"
XOTE_VERSION="$(tr -d '[:space:]' < "${ROOT}/bundle/xote.version")"

echo "==> ReScript compiler: v${RESCRIPT_VERSION}"
echo "==> xote:              ${XOTE_VERSION}"

rm -rf "${WORK}" "${DIST}"
mkdir -p "${WORK}" "${DIST}"

# ---------------------------------------------------------------------------
# 1. Check out the pinned ReScript compiler
# ---------------------------------------------------------------------------
git clone --depth 1 --branch "v${RESCRIPT_VERSION}" \
  https://github.com/rescript-lang/rescript.git "${WORK}/rescript"

cd "${WORK}/rescript"
opam install . --deps-only --yes
npm ci

# ---------------------------------------------------------------------------
# 2. Build the playground compiler
#
# TODO(verify): the playground target has moved between compiler versions
# (`make playground` in v10/v11; the v12 tree reorganised the jsoo build).
# Confirm the target name and the emitted path against the checkout above
# before trusting this step, then delete this comment.
# ---------------------------------------------------------------------------
make playground

find . -name 'compiler.js' -not -path './node_modules/*' -print -quit \
  | xargs -I{} cp {} "${DIST}/compiler.js"

# Stdlib cmij archives emitted alongside the compiler.
find . -name '*.cmij.js' -not -path './node_modules/*' -print0 \
  | xargs -0 -I{} cp {} "${DIST}/"

# ---------------------------------------------------------------------------
# 3. Compile xote + rescript-signals and pack their artifacts into a cmij
#
# The playground can only compile against modules whose .cmi/.cmj are present in
# its cmij set. We build xote from source with the pinned compiler so the
# artifacts match the compiler.js ABI exactly — artifacts from a different
# compiler build will not load.
#
# TODO(verify): the packing helper is `jsoo_mkcmij` / `packages/playground` in
# the compiler tree depending on version. Point PACK at the real one.
# ---------------------------------------------------------------------------
cd "${WORK}"
npm install "xote@${XOTE_VERSION}" "rescript@${RESCRIPT_VERSION}" rescript-signals

BSC="${WORK}/node_modules/.bin/bsc"
ARTIFACTS="${WORK}/artifacts"
mkdir -p "${ARTIFACTS}"

# xote ships its sources (package.json "files" includes src/**/*.res{,i}), so we
# compile them here rather than relying on prebuilt artifacts.
for f in "${WORK}"/node_modules/xote/src/*.res; do
  "${BSC}" -bs-package-output es6:"${ARTIFACTS}" \
           -bs-jsx 4 -bs-jsx-module XoteJSX \
           -I "${ARTIFACTS}" \
           -c "$f"
done

PACK="${WORK}/rescript/scripts/jsoo_mkcmij.js"   # TODO(verify) see above
node "${PACK}" --output "${DIST}/xote.cmij.js" "${ARTIFACTS}"

echo "==> bundle written to ${DIST}"
ls -la "${DIST}"
