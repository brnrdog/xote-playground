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

## Writing reactivity by hand

Still supported, and necessary inside a plain (un-annotated) function:

| With `@xote.component`           | By hand                                     |
|----------------------------------|---------------------------------------------|
| `{Signal.get(count)}` as a child | `View.signalInt(() => Signal.get(count))`   |
| bare `{"text"}` child            | `View.text("text")`                          |
| `class={... Signal.get(s) ...}`  | `View.Attr.compute("class", () => ...)`      |
| `onClick={handler}`              | `~events=[("click", handler)]`               |
| `<View.For each by render />`    | `View.eachWithKey(signal, keyFn, render)`   |

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
