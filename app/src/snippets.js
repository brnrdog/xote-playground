/**
 * Starter snippets. All PPX-free — see docs/authoring-snippets.md for why
 * @xote.component cannot appear here.
 */
export const DEFAULT_SNIPPET = `// A counter. Note the explicit thunks: the playground compiler cannot run
// the @xote.component PPX, so reactive reads are written out by hand.

let count = Signal.make(0)

let button = (label, onClick) =>
  View.element(
    "button",
    ~attrs=[View.attr("type", "button"), View.attr("class", "btn")],
    ~events=[("click", onClick)],
    ~children=[View.text(label)],
    (),
  )

let make = () =>
  View.element(
    "div",
    ~attrs=[View.attr("class", "counter")],
    ~children=[
      button("-", _ => Signal.update(count, n => n - 1)),
      View.element(
        "span",
        ~attrs=[View.attr("class", "value")],
        // signalInt takes a thunk; every signal read inside it subscribes
        // this text node and nothing else.
        ~children=[View.signalInt(() => Signal.get(count))],
        (),
      ),
      button("+", _ => Signal.update(count, n => n + 1)),
    ],
    (),
  )
`
