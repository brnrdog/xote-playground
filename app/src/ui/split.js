/**
 * Drag-to-resize for a two-pane flex container.
 *
 * Works on either axis: the container decides, via flex-direction, and the
 * handle follows. Sizing is expressed as a percentage on the first pane's
 * flex-basis, so the panes keep filling the container at any window size —
 * pixel widths drift as soon as the window is resized.
 *
 * Pointer capture rather than document-level listeners: it keeps the drag alive
 * over the iframe, which would otherwise swallow pointermove as soon as the
 * cursor crossed into the preview.
 */
const MIN_PERCENT = 15
const MAX_PERCENT = 85
const KEYBOARD_STEP = 2

export function createSplit({ container, handle, pane, storageKey, onResize, defaultPercent = 50 }) {
  const vertical = () => getComputedStyle(container).flexDirection.startsWith('column')

  let percent = load()

  function load() {
    try {
      const stored = Number(localStorage.getItem(storageKey))
      if (Number.isFinite(stored) && stored >= MIN_PERCENT && stored <= MAX_PERCENT) return stored
    } catch {}
    return defaultPercent
  }

  function save() {
    try {
      localStorage.setItem(storageKey, String(Math.round(percent)))
    } catch {}
  }

  function apply() {
    pane.style.flex = `0 0 ${percent}%`
    handle.setAttribute('aria-valuenow', String(Math.round(percent)))
    onResize?.()
  }

  function setPercent(next) {
    percent = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, next))
    apply()
  }

  handle.addEventListener('pointerdown', event => {
    event.preventDefault()
    handle.setPointerCapture(event.pointerId)
    // Without this the drag selects text in the editor as it passes over.
    document.body.style.userSelect = 'none'
  })

  handle.addEventListener('pointermove', event => {
    if (!handle.hasPointerCapture(event.pointerId)) return
    const box = container.getBoundingClientRect()
    const next = vertical()
      ? ((event.clientY - box.top) / box.height) * 100
      : ((event.clientX - box.left) / box.width) * 100
    setPercent(next)
  })

  for (const type of ['pointerup', 'pointercancel']) {
    handle.addEventListener(type, event => {
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
      document.body.style.userSelect = ''
      save()
    })
  }

  // A separator that can only be dragged is unusable without a mouse.
  handle.addEventListener('keydown', event => {
    const back = vertical() ? 'ArrowUp' : 'ArrowLeft'
    const forward = vertical() ? 'ArrowDown' : 'ArrowRight'
    if (event.key === back) setPercent(percent - KEYBOARD_STEP)
    else if (event.key === forward) setPercent(percent + KEYBOARD_STEP)
    else if (event.key === 'Home') setPercent(MIN_PERCENT)
    else if (event.key === 'End') setPercent(MAX_PERCENT)
    else if (event.key === 'Enter') setPercent(defaultPercent)
    else return
    event.preventDefault()
    save()
  })

  handle.setAttribute('aria-valuemin', String(MIN_PERCENT))
  handle.setAttribute('aria-valuemax', String(MAX_PERCENT))
  apply()

  return { setPercent, get percent() { return percent } }
}
