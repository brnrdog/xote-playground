import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

import { createRunner } from './runtime/runner.js'
import { DEFAULT_SNIPPET } from './snippets.js'

const statusEl = document.getElementById('status')
const errorsEl = document.getElementById('errors')
const runner = createRunner(document.querySelector('.pg-output'))
document.getElementById('preview').remove() // the runner owns the frame

const worker = new Worker(new URL('./compile.worker.js', import.meta.url))

let pending = 0
let debounce = null

function setStatus(text, tone = '') {
  statusEl.textContent = text
  statusEl.dataset.tone = tone
}

function showErrors(errors) {
  errorsEl.hidden = false
  errorsEl.textContent = errors
    .map((e) => `${e.row}:${e.column}  ${e.text}`)
    .join('\n\n')
}

function compile(code) {
  const id = ++pending
  setStatus('compiling…')
  worker.postMessage({ id, code })
}

worker.onmessage = ({ data }) => {
  // Ignore results from a compile the user has already typed past.
  if (data.id !== pending) return

  if (data.ok) {
    errorsEl.hidden = true
    setStatus('ok', 'ok')
    runner.run(data.js)
  } else {
    setStatus(`${data.errors.length} error${data.errors.length === 1 ? '' : 's'}`, 'error')
    showErrors(data.errors)
  }
}

window.addEventListener('message', (event) => {
  if (event.data?.type === 'runtime-error') {
    setStatus('runtime error', 'error')
    showErrors([{ row: 0, column: 0, text: event.data.text }])
  }
})

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
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return
        clearTimeout(debounce)
        debounce = setTimeout(() => compile(update.state.doc.toString()), 300)
      }),
    ],
  }),
})

document.getElementById('share').addEventListener('click', async () => {
  const hash = compressToEncodedURIComponent(view.state.doc.toString())
  window.history.replaceState(null, '', `#${hash}`)
  await navigator.clipboard.writeText(location.href)
  setStatus('link copied', 'ok')
})

compile(view.state.doc.toString())
