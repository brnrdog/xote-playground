/**
 * Starter snippets. All PPX-free — see docs/authoring-snippets.md for why
 * @xote.component cannot appear here.
 */
export const DEFAULT_SNIPPET = `// A counter. Note the explicit thunks: the playground compiler cannot run
// the @xote.component PPX, so reactive reads are written out by hand.

let count = Signal.make(0)

let make = () =>
  View.element(
    "div",
    ~attrs=[View.attr("class", "counter")],
    [
      View.element(
        "button",
        ~attrs=[
          View.attr("type", "button"),
          View.Attr.onClick(_ => Signal.update(count, n => n - 1)),
        ],
        [View.text("-")],
      ),
      View.element(
        "span",
        ~attrs=[View.attr("class", "value")],
        [View.signalText(count, Int.toString)],
      ),
      View.element(
        "button",
        ~attrs=[
          View.attr("type", "button"),
          View.Attr.onClick(_ => Signal.update(count, n => n + 1)),
        ],
        [View.text("+")],
      ),
    ],
  )
`
