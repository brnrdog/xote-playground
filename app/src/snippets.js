/**
 * Starter snippets.
 *
 * @xote.component works here: the rewriter is linked into the playground
 * compiler itself (scripts/build-bundle.sh step 2b), so snippets are written
 * the same way as real xote code — plain JSX, signals read inline, no
 * hand-rolled thunks.
 */
export const DEFAULT_SNIPPET = `@@jsxConfig({version: 4, module_: "XoteJSX"})

// @xote.component decomposes this into fine-grained reactive leaves: the
// element structure is built once, and only the parts that read a signal
// re-run. class="counter" stays a plain string in the output, while
// {Signal.get(count)} becomes View.child(() => ...).

@xote.component
let make = () => {
  let count = Signal.make(0)

  <div class="counter">
    <button onClick={_ => Signal.update(count, n => n - 1)}> {View.text("-")} </button>
    <span class="value"> {Signal.get(count)} </span>
    <button onClick={_ => Signal.update(count, n => n + 1)}> {View.text("+")} </button>
  </div>
}
`
