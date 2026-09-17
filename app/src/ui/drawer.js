/**
 * The output drawer: console output from the snippet, plus compile and runtime
 * errors, in one scrollback below the preview.
 *
 * Errors and logs share a panel deliberately. They answer the same question —
 * "why is the preview not doing what I expect?" — and splitting them means the
 * answer is always in the tab you are not looking at.
 */
const LEVEL_CLASS = {
  log: 'text-muted',
  info: 'text-muted',
  debug: 'text-faint',
  warn: 'text-warn',
  error: 'text-error',
  compile: 'text-error',
}

const LEVEL_MARK = {
  log: '›',
  info: '›',
  debug: '›',
  warn: '!',
  error: '✕',
  compile: '✕',
}

export function createDrawer(host) {
  // flex-1 so the drawer fills whatever the split leaves it; without it the
  // panel shrinks to its content and the rest of the pane sits empty.
  host.className = 'flex min-h-0 flex-1 flex-col border-t border-line-soft bg-surface'

  const bar = document.createElement('div')
  bar.className =
    'flex shrink-0 cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-[11px] tracking-wide text-faint uppercase'

  const title = document.createElement('span')
  title.className = 'font-mono'
  title.textContent = 'Console'

  const count = document.createElement('span')
  count.className = 'font-mono text-[11px] text-faint'

  const chevron = document.createElement('span')
  chevron.className = 'ml-auto font-mono text-[11px] text-faint'

  bar.append(title, count, chevron)

  const body = document.createElement('div')
  body.className = 'min-h-0 flex-1 overflow-auto px-3 pb-2 font-mono text-[12px] leading-relaxed'

  const empty = document.createElement('p')
  empty.className = 'm-0 py-1 text-faint italic'
  empty.textContent = 'No output.'
  body.append(empty)

  host.append(bar, body)

  let collapsed = false
  let entries = 0

  function render() {
    chevron.textContent = collapsed ? '▴' : '▾'
    bar.setAttribute('aria-expanded', String(!collapsed))
    body.hidden = collapsed
    count.textContent = entries ? `${entries}` : ''
    empty.hidden = entries > 0
  }

  function toggle() {
    collapsed = !collapsed
    // Collapsing should give the space back to the preview, not leave a gap.
    host.style.flex = collapsed ? '0 0 auto' : ''
    render()
  }

  bar.addEventListener('click', toggle)
  bar.setAttribute('role', 'button')
  bar.setAttribute('tabindex', '0')
  bar.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  })

  function append(level, text) {
    const line = document.createElement('div')
    line.className = `flex gap-2 py-0.5 ${LEVEL_CLASS[level] ?? 'text-muted'}`

    const mark = document.createElement('span')
    mark.className = 'shrink-0 select-none opacity-60'
    mark.textContent = LEVEL_MARK[level] ?? '›'

    const content = document.createElement('span')
    content.className = 'whitespace-pre-wrap break-words'
    content.textContent = text

    line.append(mark, content)
    body.append(line)
    entries++

    // Only follow the tail when the reader is already at it; yanking the view
    // away mid-scroll is worse than missing a line.
    const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 40
    if (atBottom) body.scrollTop = body.scrollHeight

    render()
  }

  function clear() {
    for (const child of [...body.children]) if (child !== empty) child.remove()
    entries = 0
    render()
  }

  render()

  return { append, clear, get entries() { return entries } }
}
