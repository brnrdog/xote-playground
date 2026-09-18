# Authoring playground snippets

## `@xote.component` works here

The rewriter is compiled into the playground compiler itself, so snippets are
written the way real xote code is written — no hand-rolled thunks.

This is not how a ReScript ppx normally runs. Normally the *build system* runs a
ppx binary between parse and compile, handing it a marshalled parsetree; the
playground compiler has no such seam, since its whole API is
`compile(source) -> js`. So xote's rewriter is linked into the compiler and
called on the parsed structure, immediately before ReScript's own
`Ppx_entry.rewrite_implementation` (which is what lowers JSX — order matters,
and it matches what a native `ppx <ast-in> <ast-out>` invocation sees).

See `scripts/build-bundle.sh` step 2b. The consequence is that the bundle must
be built from source: a stock bundle from `cdn.rescript-lang.org` has no ppx.

## Every snippet needs the jsx config header

```rescript
@@jsxConfig({version: 4, module_: "XoteJSX"})
```

The playground API has no JSX-module setting, so it has to come from the source.
`Xote` is opened for you (`setOpenModules(["Xote"])`), so `View`, `Signal` and
`XoteJSX` are all in scope without an explicit `open`.

## `make` is the entry point

The runner mounts `make({})`. `@xote.component` derives props, so an annotated
component compiles to a function taking a props object while a plain one takes
unit; the empty object satisfies the first and is ignored by the second. A
component that declares props (`~label: string`) will see them as `undefined`,
so starter snippets should not require any.

## Pass the signal, not the read

Under `@xote.component`, a signal can be handed straight to JSX wherever a value
is expected — as a child, or as an attribute on an intrinsic element:

```rescript
<div class={theme}> {count} </div>
```

That is the short form of `class={Signal.get(theme)}` and `{Signal.get(count)}`,
and it produces the same single reactive leaf: the short form gives `View.child`
(or the attribute) the signal itself, the long one a thunk around the read.
Prefer it — the snippets are what people copy.

`Signal.get` is still the right call in three places, and the snippets use it
there:

- the value is *derived* rather than passed through —
  `{Array.length(Signal.get(items))}`
- control flow picks between nodes — `if Signal.get(open_) {...}`, where that
  read is what the `View.tracked` block subscribes to
- ordinary code outside JSX, such as an `Effect.run` body

Typed props are the other exception: `View.For`, `View.Show` and friends declare
`MaybeSignal.t`, so they take `MaybeSignal.reactive(items)` — the wrapper is how
a declared prop says which of the two it is being handed.

## Writing reactivity by hand

Still supported, and necessary inside a plain (un-annotated) function:

| With `@xote.component`          | By hand                                   |
|---------------------------------|-------------------------------------------|
| `{count}` — a signal child      | `View.signalInt(() => Signal.get(count))` |
| bare `{"text"}` child           | `View.text("text")`                       |
| `class={theme}` — a signal attr | `View.Attr.compute("class", () => ...)`   |
| `onClick={handler}`             | `~events=[("click", handler)]`            |
| `<View.For each by render />`   | `View.eachWithKey(signal, keyFn, render)` |

### `View.element` is fully labelled and ends in `unit`

```rescript
View.element(
  "div",
  ~attrs=[View.attr("class", "counter")],
  ~events=[("click", handler)],
  ~children=[View.text("hi")],
  (),
)
```
