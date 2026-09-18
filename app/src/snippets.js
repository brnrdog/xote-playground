/**
 * Starter snippets.
 *
 * @xote.component works here — the rewriter is linked into the playground
 * compiler itself (scripts/build-bundle.sh step 2b) — so these are written the
 * way real xote code is: plain JSX, signals passed straight into it, no
 * hand-rolled thunks and no Signal.get where the signal itself will do.
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
// element structure is built once, and only the parts that depend on a signal
// re-run. A signal goes straight into JSX — {count} is the whole subscription,
// no Signal.get and no thunk — while class="counter" stays a plain string in
// the output.

@xote.component
let make = () => {
  let count = Signal.make(0)

  <div class="counter">
    <button onClick={_ => Signal.update(count, n => n - 1)}> {"-"} </button>
    <span class="value"> {count} </span>
    <button onClick={_ => Signal.update(count, n => n + 1)}> {"+"} </button>
  </div>
}
`,
  },
  {
    id: 'computed',
    label: 'Derived state',
    blurb: 'Computed values',
    code: `${HEADER}

// Computed.make returns a Signal.t, so it drops into JSX like any other signal.
// It recomputes only when something it read changes, and the leaf holding it is
// the only thing that re-renders.

@xote.component
let make = () => {
  let celsius = Signal.make(20)
  let fahrenheit = Computed.make(() => Signal.get(celsius) * 9 / 5 + 32)

  <div class="counter">
    <button onClick={_ => Signal.update(celsius, c => c - 5)}> {"-"} </button>
    <span class="value"> {celsius} </span>
    <span> {"C = "} </span>
    <span class="value"> {fahrenheit} </span>
    <span> {"F"} </span>
    <button onClick={_ => Signal.update(celsius, c => c + 5)}> {"+"} </button>
  </div>
}
`,
  },
  {
    id: 'effect',
    label: 'Effect',
    blurb: 'Side effects and cleanup',
    code: `${HEADER}

// Effect.run re-runs whenever a signal it read changes — an effect body is
// ordinary code, so it reads with Signal.get. Returning Some(fn) is how you
// undo whatever the last run set up: here, the interval.

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
    <span class="value"> {ticks} </span>
    <button onClick={_ => Signal.update(running, r => !r)}> {"start / stop"} </button>
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
    <button onClick={_ => Signal.update(open_, o => !o)}> {"toggle"} </button>
    <span class="value">
      {if Signal.get(open_) {
        "open"
      } else {
        "closed"
      }}
    </span>
  </div>
}
`,
  },
  {
    id: 'list',
    label: 'List',
    blurb: 'Keyed collections',
    code: `${HEADER}

// View.For renders a collection. \`by\` gives each item a stable key, so the
// reconciler moves only the rows a change displaces: removing one leaves its
// neighbours' DOM nodes untouched, and reversing reuses every <li> rather than
// rebuilding the list. Without \`by\` the whole list re-renders on every change.
//
// \`each\` is a typed prop, so it takes MaybeSignal.reactive(items) rather than
// the bare signal — that wrapper is how a declared prop says which one it is
// being handed. \`render\` returns a node, so the ppx decomposes its body like
// any other JSX and the leaves inside a row stay fine-grained.

type item = {id: int, label: string}

@xote.component
let make = () => {
  let nextId = ref(4)
  let items = Signal.make([
    {id: 1, label: "signals"},
    {id: 2, label: "effects"},
    {id: 3, label: "keyed lists"},
  ])

  let add = _ => {
    let id = nextId.contents
    nextId := id + 1
    Signal.update(items, xs => Array.concat(xs, [{id, label: "item " ++ Int.toString(id)}]))
  }

  let reverse = _ => Signal.update(items, xs => Array.toReversed(xs))
  let remove = id => Signal.update(items, xs => Array.filter(xs, x => x.id != id))

  <div class="list">
    <div class="counter">
      <button onClick={add}> {"add"} </button>
      <button onClick={reverse}> {"reverse"} </button>
      <span class="value"> {Array.length(Signal.get(items))} </span>
    </div>
    <ul class="rows">
      <View.For
        each={MaybeSignal.reactive(items)}
        by={item => Int.toString(item.id)}
        render={item =>
          <li class="row">
            <span> {item.label} </span>
            <button onClick={_ => remove(item.id)}> {"remove"} </button>
          </li>}
      />
    </ul>
  </div>
}
`,
  },
]

export const DEFAULT_SNIPPET = SNIPPETS[0].code
