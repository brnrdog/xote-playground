/**
 * Starter snippets.
 *
 * @xote.component works here: the rewriter is linked into the playground
 * compiler itself (scripts/build-bundle.sh step 2b), so snippets are written
 * the same way as real xote code rather than with hand-rolled thunks.
 *
 * One upstream limitation shapes the JSX below — see docs/authoring-snippets.md:
 * sibling JSX children raise Not_found in the playground compiler, so a list of
 * children goes through an explicit XoteJSX.array(...) as a single child.
 */
export const DEFAULT_SNIPPET = `@@jsxConfig({version: 4, module_: "XoteJSX"})

// @xote.component decomposes this into fine-grained reactive leaves: the
// element structure is built once, and only the parts that read a signal
// re-run. Note class="counter" stays a plain string in the output, while
// {Signal.get(count)} becomes View.child(() => ...).

@xote.component
let make = () => {
  let count = Signal.make(0)

  <div class="counter">
    {XoteJSX.array([
      <button onClick={_ => Signal.update(count, n => n - 1)}> {View.text("-")} </button>,
      <span class="value"> {Signal.get(count)} </span>,
      <button onClick={_ => Signal.update(count, n => n + 1)}> {View.text("+")} </button>,
    ])}
  </div>
}
`
