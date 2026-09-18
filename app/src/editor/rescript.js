/**
 * A ReScript mode for CodeMirror, built on StreamLanguage.
 *
 * This is a tokenizer, not a parser: it recognises the shapes that carry most
 * of the colour in a snippet — comments, strings, keywords, types, JSX tags,
 * attributes — and it can be fooled by syntax that needs real context to
 * resolve. A proper Lezer grammar for ReScript is a much larger undertaking,
 * and the playground's snippets are short.
 *
 * StreamLanguage comes from @codemirror/language, already a dependency.
 */
import { StreamLanguage } from '@codemirror/language'

const KEYWORDS = new Set([
  'let', 'rec', 'and', 'in', 'if', 'else', 'switch', 'when', 'type', 'module',
  'open', 'include', 'external', 'exception', 'try', 'catch', 'assert', 'lazy',
  'mutable', 'of', 'as', 'while', 'for', 'to', 'downto', 'with', 'async', 'await',
])

const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'unit'])

export const rescript = StreamLanguage.define({
  name: 'rescript',

  startState() {
    return { inComment: 0, inJsxTag: false }
  },

  token(stream, state) {
    // Block comments nest in ReScript, so track depth rather than a flag.
    if (state.inComment > 0) {
      while (!stream.eol()) {
        if (stream.match('/*')) state.inComment++
        else if (stream.match('*/')) {
          state.inComment--
          if (state.inComment === 0) return 'comment'
        } else stream.next()
      }
      return 'comment'
    }

    if (stream.eatSpace()) return null

    if (stream.match('//')) {
      stream.skipToEnd()
      return 'comment'
    }

    if (stream.match('/*')) {
      state.inComment = 1
      return 'comment'
    }

    // Decorators: @xote.component, @react.component, @@jsxConfig, @inline
    if (stream.match(/^@@?[A-Za-z][\w.]*/)) return 'meta'

    // Polymorphic variants (#warm) and strings/chars.
    if (stream.match(/^#[A-Za-z][\w]*/)) return 'atom'

    if (stream.match(/^`/)) {
      while (!stream.eol()) {
        if (stream.next() === '`') break
      }
      return 'string'
    }

    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return 'string'
    if (stream.match(/^'(?:[^'\\]|\\.)'/)) return 'string'

    if (stream.match(/^-?\d[\d_]*(\.[\d_]+)?([eE][-+]?\d+)?/)) return 'number'

    // JSX: <div …>, </div>, <View.Int>. Capitalised tags are components.
    if (stream.match(/^<\/?[A-Za-z][\w.]*/)) {
      state.inJsxTag = true
      return 'tagName'
    }

    if (state.inJsxTag) {
      if (stream.match(/^\/?>/)) {
        state.inJsxTag = false
        return 'tagName'
      }
      if (stream.match(/^[A-Za-z][\w-]*(?==)/)) return 'attributeName'
    }

    // Labelled arguments (~label) read as their own thing in ReScript.
    if (stream.match(/^~[A-Za-z][\w]*/)) return 'propertyName'

    const word = stream.match(/^[A-Za-z_][\w']*/)
    if (word) {
      const w = word[0]
      if (KEYWORDS.has(w)) return 'keyword'
      if (LITERALS.has(w)) return 'atom'
      // Capitalised identifiers are modules, constructors or components.
      if (/^[A-Z]/.test(w)) return 'typeName'
      return 'variableName'
    }

    if (stream.match(/^(=>|->|\|>|::|\+\+|&&|\|\||[-+*/%<>=!|&^:?.,;])/)) return 'operator'

    stream.next()
    return null
  },

  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '[', '{', '"', '`'] },
  },
})
