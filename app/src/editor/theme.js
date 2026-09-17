/**
 * CodeMirror theme + syntax highlighting, wired to the xote.dev tokens.
 *
 * Every colour is a var() lookup rather than a literal, so the editor follows
 * the `data-theme` flip along with the rest of the page — CodeMirror itself
 * never has to be told the theme changed.
 */
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

const editorTheme = EditorView.theme({
  '&': {
    color: 'var(--text)',
    backgroundColor: 'var(--bg)',
    height: '100%',
  },
  '.cm-content': {
    caretColor: 'var(--syntax-warm)',
    padding: '16px 0',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--syntax-warm)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--syntax-warm) 22%, transparent)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg)',
    color: 'var(--text-faint)',
    border: 'none',
    borderRight: '1px solid var(--border-soft)',
    paddingRight: '4px',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 16px' },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--text) 4%, transparent)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
  },
  '.cm-scroller': { overflow: 'auto' },
})

const highlight = HighlightStyle.define([
  { tag: t.comment, color: 'var(--text-faint)', fontStyle: 'italic' },
  { tag: t.keyword, color: 'var(--syntax-warm)' },
  { tag: t.string, color: 'var(--syntax-green)' },
  { tag: t.number, color: 'var(--syntax-green)' },
  { tag: t.atom, color: 'var(--syntax-purple)' },
  { tag: t.typeName, color: 'var(--syntax-blue)' },
  { tag: t.tagName, color: 'var(--syntax-purple)' },
  { tag: t.attributeName, color: 'var(--syntax-warm-soft)' },
  { tag: t.propertyName, color: 'var(--syntax-warm-soft)' },
  // Decorators like @xote.component: the deep warm marks them as compile-time.
  { tag: t.meta, color: 'var(--syntax-warm-deep)' },
  { tag: t.operator, color: 'var(--text-muted)' },
  { tag: t.variableName, color: 'var(--text)' },
  { tag: t.invalid, color: 'var(--error)' },
])

export const xoteEditorTheme = [editorTheme, syntaxHighlighting(highlight)]
