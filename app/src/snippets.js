/**
 * Starter snippets.
 *
 * @xote.component works here — the rewriter is linked into the playground
 * compiler itself (scripts/build-bundle.sh step 2b) — so these are written the
 * way real xote code is: plain JSX, signals read inline, no hand-rolled thunks.
 *
 * Every snippet is compiled by `npm run test:snippets` against the real bundle.
 * They are documentation, and documentation that does not compile is worse than
 * none: the previous default snippet was wrong for months before anyone ran it.
 */

const HEADER = '@@jsxConfig({version: 4, module_: "XoteJSX"})'

export const SNIPPETS = [
  {
    id: 'counter',
    label: 'Counter',
    blurb: 'Signals and events',
    code: `${HEADER}

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
`,
  },
  {
    id: 'computed',
    label: 'Derived state',
    blurb: 'Computed values',
    code: `${HEADER}

// Computed.make returns a Signal.t, so it is read with Signal.get like any
// other signal. It recomputes only when something it read changes, and reading
// it inside JSX subscribes just that leaf.

@xote.component
let make = () => {
  let celsius = Signal.make(20)
  let fahrenheit = Computed.make(() => Signal.get(celsius) * 9 / 5 + 32)

  <div class="counter">
    <button onClick={_ => Signal.update(celsius, c => c - 5)}> {View.text("-")} </button>
    <span class="value"> {Signal.get(celsius)} </span>
    <span> {View.text("C = ")} </span>
    <span class="value"> {Signal.get(fahrenheit)} </span>
    <span> {View.text("F")} </span>
    <button onClick={_ => Signal.update(celsius, c => c + 5)}> {View.text("+")} </button>
  </div>
}
`,
  },
  {
    id: 'effect',
    label: 'Effect',
    blurb: 'Side effects and cleanup',
    code: `${HEADER}

// Effect.run re-runs whenever a signal it read changes. Returning Some(fn) is
// how you undo whatever the last run set up — here, the interval.

@xote.component
let make = () => {
  let ticks = Signal.make(0)
  let running = Signal.make(true)

  Effect.run(() => {
    if Signal.get(running) {
      let id = setInterval(() => Signal.update(ticks, n => n + 1), 1000)
      Some(() => clearInterval(id))
    } else {
      None
    }
  })

  <div class="counter">
    <span class="value"> {Signal.get(ticks)} </span>
    <button onClick={_ => Signal.update(running, r => !r)}>
      {View.text("start / stop")}
    </button>
  </div>
}
`,
  },
  {
    id: 'conditional',
    label: 'Conditional',
    blurb: 'Switching on state',
    code: `${HEADER}

// Control flow that produces *nodes* is the one place a structural swap is
// unavoidable, so the ppx wraps it in View.tracked. Attributes and text leaves
// around it stay fine-grained.

@xote.component
let make = () => {
  let open_ = Signal.make(false)

  <div class="counter">
    <button onClick={_ => Signal.update(open_, o => !o)}>
      {View.text("toggle")}
    </button>
    <span class="value">
      {if Signal.get(open_) {
        View.text("open")
      } else {
        View.text("closed")
      }}
    </span>
  </div>
}
`,
  },
]

export const DEFAULT_SNIPPET = SNIPPETS[0].code
