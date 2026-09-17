import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

import { createRunner } from './runtime/runner.js'
import { createSplit } from './ui/split.js'
import { createDrawer } from './ui/drawer.js'
import { rescript } from './editor/rescript.js'
import { xoteEditorTheme } from './editor/theme.js'
import { SNIPPETS, DEFAULT_SNIPPET } from './snippets.js'

const THEME_KEY = 'xote-theme'

/* ---------------------------------------------------------------- theme --- */

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {}
  themeButton.textContent = theme === 'light' ? '☾' : '☀'
  // The preview is a separate document and cannot inherit the attribute, so it
  // has to be re-rendered under the new theme. That re-executes the snippet,
  // which logs again — so clear first, or every toggle doubles the output.
  if (lastJs) {
    drawer.clear()
    runner.run(lastJs, { theme })
  }
}

/* --------------------------------------------------------------- layout --- */

const outputEl = document.getElementById('output')

const previewHost = document.createElement('div')
previewHost.className = 'pg-output relative flex min-h-0 flex-1 flex-col bg-bg'

const drawerHandle = document.createElement('div')
drawerHandle.className =
  'h-[3px] shrink-0 cursor-row-resize bg-line-soft transition-colors hover:bg-faint'
drawerHandle.setAttribute('role', 'separator')
drawerHandle.setAttribute('aria-orientation', 'horizontal')
drawerHandle.setAttribute('aria-label', 'Resize console')
drawerHandle.tabIndex = 0

const drawerHost = document.createElement('div')

outputEl.append(previewHost, drawerHandle, drawerHost)

const drawer = createDrawer(drawerHost)
const runner = createRunner(previewHost)

const themeButton = document.getElementById('theme')
const statusEl = document.getElementById('status')
const shareButton = document.getElementById('share')
const examplesEl = document.getElementById('examples')

createSplit({
  container: document.getElementById('split'),
  handle: document.getElementById('split-handle'),
  pane: document.getElementById('editor'),
  storageKey: 'xote-split',
})

createSplit({
  container: outputEl,
  handle: drawerHandle,
  pane: previewHost,
  storageKey: 'xote-drawer',
  defaultPercent: 70,
})

/* --------------------------------------------------------------- status --- */

const TONE = {
  ok: 'text-ok',
  error: 'text-error',
  busy: 'text-muted',
}

function setStatus(text, tone = 'busy') {
  statusEl.textContent = text
  statusEl.className = `ml-auto font-mono text-[12px] ${TONE[tone] ?? TONE.busy}`
}

/* -------------------------------------------------------------- compile --- */

const worker = new Worker(new URL('./compile.worker.js', import.meta.url))

let pending = 0
let debounce = null
let lastJs = null

function compile(code) {
  const id = ++pending
  setStatus('compiling…')
  worker.postMessage({ id, code })
}

worker.onmessage = ({ data }) => {
  // Ignore results from a compile the user has already typed past.
  if (data.id !== pending) return

  drawer.clear()

  if (data.ok) {
    setStatus('ok', 'ok')
    lastJs = data.js
    runner.run(data.js, { theme: currentTheme() })
  } else {
    const n = data.errors.length
    setStatus(`${n} error${n === 1 ? '' : 's'}`, 'error')
    for (const e of data.errors) drawer.append('compile', `${e.row}:${e.column}  ${e.text}`)
  }
}

window.addEventListener('message', event => {
  const data = event.data
  if (data?.type === 'runtime-error') {
    setStatus('runtime error', 'error')
    drawer.append('error', data.text)
  } else if (data?.type === 'console') {
    drawer.append(data.level, data.text)
  }
})

/* --------------------------------------------------------------- editor --- */

function initialCode() {
  const hash = location.hash.slice(1)
  if (!hash) return DEFAULT_SNIPPET
  try {
    return decompressFromEncodedURIComponent(hash) || DEFAULT_SNIPPET
  } catch {
    return DEFAULT_SNIPPET
  }
}

const view = new EditorView({
  parent: document.getElementById('editor'),
  state: EditorState.create({
    doc: initialCode(),
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      rescript,
      xoteEditorTheme,
      EditorView.lineWrapping,
      // indentWithTab last: it must win over the default Tab binding.
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      EditorView.updateListener.of(update => {
        if (!update.docChanged) return
        clearTimeout(debounce)
        debounce = setTimeout(() => compile(update.state.doc.toString()), 300)
      }),
    ],
  }),
})

function load(code) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } })
  compile(code)
}

/* -------------------------------------------------------------- examples --- */

for (const snippet of SNIPPETS) {
  const option = document.createElement('option')
  option.value = snippet.id
  option.textContent = `${snippet.label} — ${snippet.blurb}`
  examplesEl.append(option)
}

examplesEl.addEventListener('change', () => {
  const snippet = SNIPPETS.find(s => s.id === examplesEl.value)
  if (!snippet) return
  // Loading an example invalidates a shared link that described other code.
  window.history.replaceState(null, '', location.pathname + location.search)
  load(snippet.code)
})

/* ---------------------------------------------------------------- share --- */

shareButton.addEventListener('click', async () => {
  const hash = compressToEncodedURIComponent(view.state.doc.toString())
  window.history.replaceState(null, '', `#${hash}`)
  try {
    await navigator.clipboard.writeText(location.href)
    // Feedback goes on the button, not the status slot: the next compile would
    // overwrite the status a moment later and the confirmation would vanish.
    shareButton.textContent = 'Copied'
    setTimeout(() => (shareButton.textContent = 'Copy link'), 1500)
  } catch {
    shareButton.textContent = 'Press ⌘C'
    setTimeout(() => (shareButton.textContent = 'Copy link'), 1500)
  }
})

themeButton.addEventListener('click', () => {
  applyTheme(currentTheme() === 'light' ? 'dark' : 'light')
})

themeButton.textContent = currentTheme() === 'light' ? '☾' : '☀'

compile(view.state.doc.toString())
