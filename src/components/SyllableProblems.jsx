import { problemLabel } from '../utils/wordScore'

// Names of vowels and signs as feedback writes them
const SIGN_NAMES = [
  'patach genuvah', 'sheva nach', 'sheva na', 'kamatz katan', 'hataf kamatz', 'hataf segol',
  'patach', 'kamatz', 'segol', 'tzere', 'chirik', 'cholam', 'shuruk', 'kubutz', 'mappiq',
]

// Hebrew (letters with their marks), a quoted sound or example word, or a sign name
const TOKEN = new RegExp(
  `([\\u0591-\\u05F4\\u2060]+)|("[^"]+")|\\b(${SIGN_NAMES.map(n => n.replace(' ', '\\s')).join('|')})\\b`,
  'gi',
)

// A feedback note with the parts a student needs to spot picked out: Hebrew
// letters, the sounds ("kh"), and the names of vowels and signs. A quoted word
// after "as in" / "in" is an English example word ("as in "law""), shown
// apart from the sounds.
export function NoteText({ text }) {
  const parts = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const [token, hebrew, quoted] = m
    if (hebrew) {
      parts.push(<span key={m.index} className="note-he" lang="he" dir="rtl">{token}</span>)
    } else if (quoted) {
      const isExample = /\b(as in|in) $/.test(text.slice(0, m.index))
      parts.push(<span key={m.index} className={isExample ? 'note-example' : 'note-say'}>{token}</span>)
    } else {
      parts.push(<span key={m.index} className="note-sign">{token}</span>)
    }
    last = m.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

// A word's mistakes, letter by letter: each letter group with a problem, and
// under it one row per mistake, tagged with its kind ("Wrong vowel", "2
// missing sounds") so the tags add up to the word's count. Readings saved
// before mistakes were listed show their note as one row.
export default function SyllableProblems({ phonemes, className = '' }) {
  const noted = phonemes.filter(p => p.problems?.length || p.note)
  if (noted.length === 0) return null
  return (
    <ul className={`syllable-problems ${className}`}>
      {noted.map((p, i) => (
        <li key={i} className="syllable-problems-row">
          <span className="syllable-problems-glyph" dir="rtl" lang="he">{p.phoneme}</span>
          <ul className="syllable-problems-list">
            {(p.problems?.length ? p.problems : [{ text: p.note }]).map((x, j) => (
              <li key={j}>
                {x.kind && <span className={`problem-tag problem-tag--${x.kind}`}>{problemLabel(x)}</span>}
                <span className="problem-text"><NoteText text={x.text} /></span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
