// Sequence alignment helpers shared between manual and OpenAI-rules assessment.
// Aligns a list of student phonetic tokens against the reference words, allowing
// omissions, insertions, and 1-3 student tokens combining for a single ref word.

import { tokenizeWord, getExpectedPhonetic } from './hebrewRules.js'

function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function similarity(expected, heard) {
  if (!expected || !heard) return 0
  const dist = levenshtein(expected.toLowerCase(), heard.toLowerCase())
  return 1 - dist / Math.max(expected.length, heard.length)
}

// Collapse consecutive duplicate tokens (student stuttering the same syllable
// or word). Returns { tokens, stutterMap } where stutterMap[i] is the number of
// extra times the kept token was repeated by the student (0 = no stutter).
function dedupeStutters(rawTokens) {
  const tokens = []
  const stutterMap = []
  for (const t of rawTokens) {
    if (tokens.length > 0 && tokens[tokens.length - 1] === t) {
      stutterMap[stutterMap.length - 1]++
    } else {
      tokens.push(t)
      stutterMap.push(0)
    }
  }
  return { tokens, stutterMap }
}

// Find the best mapping of student tokens onto reference words, allowing
// omissions (skipped reference words), insertions (extra spoken words), and
// 1-3 student tokens combining for one reference word (for maqef-joined words
// and other cases where the speaker's tokenization doesn't match Hebrew's).
// Returns { heardByRef, stutters, outOfOrder } where stutters[refIdx] is true if
// any of the matched tokens for that ref were repeated by the student, and
// outOfOrder[refIdx] is true if the word was recovered from a different position
// (see recoverSwappedWords).
export function alignByDP(referenceWords, rawStudentTokens, settings = {}) {
  const { tokens: studentTokens, stutterMap } = dedupeStutters(rawStudentTokens)
  const expected = referenceWords.map(w => {
    const atoms = tokenizeWord(w)
    return getExpectedPhonetic(atoms, settings).fullPhonetic
  })

  const N = referenceWords.length
  const M = studentTokens.length

  const NEG = -Infinity
  const dp = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(NEG))
  const back = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(null))
  dp[0][0] = 0

  const SKIP_REF = -0.3
  const SKIP_STUDENT = -0.4
  // Don't allow a match below this similarity — better to skip those tokens
  // as insertions/noise than to force a bogus assignment onto a later ref.
  const MIN_SIM = 0.3

  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= M; j++) {
      if (i === 0 && j === 0) continue
      let best = NEG, bestMove = null

      if (i > 0 && dp[i - 1][j] > NEG) {
        const score = dp[i - 1][j] + SKIP_REF
        if (score > best) { best = score; bestMove = { type: 'skip-ref' } }
      }
      if (j > 0 && dp[i][j - 1] > NEG) {
        const score = dp[i][j - 1] + SKIP_STUDENT
        if (score > best) { best = score; bestMove = { type: 'skip-student' } }
      }
      if (i > 0 && j > 0 && dp[i - 1][j - 1] > NEG) {
        const sim = similarity(expected[i - 1], studentTokens[j - 1])
        if (sim >= MIN_SIM) {
          const score = dp[i - 1][j - 1] + (2 * sim - 1)
          if (score > best) { best = score; bestMove = { type: 'match', span: 1 } }
        }
      }
      if (i > 0 && j > 1 && dp[i - 1][j - 2] > NEG) {
        const combined = studentTokens[j - 2] + studentTokens[j - 1]
        const sim = similarity(expected[i - 1], combined)
        if (sim >= MIN_SIM) {
          const score = dp[i - 1][j - 2] + (2 * sim - 1)
          if (score > best) { best = score; bestMove = { type: 'match', span: 2 } }
        }
      }
      if (i > 0 && j > 2 && dp[i - 1][j - 3] > NEG) {
        const combined = studentTokens[j - 3] + studentTokens[j - 2] + studentTokens[j - 1]
        const sim = similarity(expected[i - 1], combined)
        if (sim >= MIN_SIM) {
          const score = dp[i - 1][j - 3] + (2 * sim - 1)
          if (score > best) { best = score; bestMove = { type: 'match', span: 3 } }
        }
      }
      // Span 4 — useful for stuttered/repeated speech where dedupe still leaves
      // many tokens for one intended word
      if (i > 0 && j > 3 && dp[i - 1][j - 4] > NEG) {
        const combined =
          studentTokens[j - 4] + studentTokens[j - 3] + studentTokens[j - 2] + studentTokens[j - 1]
        const sim = similarity(expected[i - 1], combined)
        if (sim >= MIN_SIM) {
          const score = dp[i - 1][j - 4] + (2 * sim - 1)
          if (score > best) { best = score; bestMove = { type: 'match', span: 4 } }
        }
      }

      if (best > NEG) {
        dp[i][j] = best
        back[i][j] = bestMove
      }
    }
  }

  const heardByRef = new Array(N).fill('')
  const spanByRef = new Array(N).fill(null) // [first, last+1) student token indices
  const stutters = new Array(N).fill(false)
  const skippedTokens = [] // { j, refPos } — student tokens the DP left unassigned
  let i = N, j = M
  while (i > 0 || j > 0) {
    const mv = back[i][j]
    if (!mv) break
    if (mv.type === 'match') {
      const span = mv.span
      heardByRef[i - 1] = studentTokens.slice(j - span, j).join('')
      spanByRef[i - 1] = [j - span, j]
      // Any of the matched tokens were stuttered?
      for (let k = j - span; k < j; k++) {
        if (stutterMap[k] > 0) { stutters[i - 1] = true; break }
      }
      i--; j -= span
    } else if (mv.type === 'skip-ref') {
      i--
    } else {
      skippedTokens.push({ j: j - 1, refPos: i })
      j--
    }
  }
  moveStrayPrefixes(expected, studentTokens, heardByRef, spanByRef)
  const outOfOrder = recoverSwappedWords(expected, studentTokens, heardByRef, skippedTokens)
  return { heardByRef, stutters, outOfOrder }
}

// A spoken syllable that sounds like a Hebrew prefix letter (ה ו ב כ ל מ ש)
// with its vowel — "ka", "ve", "ha", "mi"…
const PREFIX_SYLLABLE = /^(h[ae]|v[aei]|u|b[aei]|k[aei]|l[aei]|m[aei]|sh[ae])$/

// The DP scores similarity relative to word length, so an extra token between
// two words tends to land on the end of the longer one: "el ha arets ka asher"
// (כַּאֲשֶׁר read for אֲשֶׁר) groups "ka" with הָאָרֶץ. Prefix letters only ever
// attach to the start of a word, so when a word's last token is a prefix
// syllable that doesn't belong to it, move it to the start of the next word.
// Mutates heardByRef and spanByRef.
function moveStrayPrefixes(expected, studentTokens, heardByRef, spanByRef) {
  for (let r = 0; r < expected.length - 1; r++) {
    const span = spanByRef[r]
    const next = spanByRef[r + 1]
    if (!span || !next || span[1] - span[0] < 2 || next[0] !== span[1]) continue
    const last = studentTokens[span[1] - 1]
    if (!PREFIX_SYLLABLE.test(last)) continue
    const without = studentTokens.slice(span[0], span[1] - 1).join('')
    if (similarity(expected[r], without) <= similarity(expected[r], heardByRef[r])) continue
    heardByRef[r] = without
    heardByRef[r + 1] = last + heardByRef[r + 1]
    spanByRef[r] = [span[0], span[1] - 1]
    spanByRef[r + 1] = [span[1] - 1, next[1]]
  }
}

// The DP is strictly forward, so a word read in the wrong position ("avram el"
// for אֶל אַבְרָם) comes out as one omitted reference word plus one unassigned
// student token. Pair those back up when the token clearly is that word and
// was said nearby. Mutates heardByRef; returns outOfOrder flags.
const SWAP_MIN_SIM = 0.7
const SWAP_MAX_DISTANCE = 3
function recoverSwappedWords(expected, studentTokens, heardByRef, skippedTokens) {
  const outOfOrder = new Array(expected.length).fill(false)
  const pairs = []
  for (let r = 0; r < expected.length; r++) {
    if (heardByRef[r]) continue
    for (const t of skippedTokens) {
      if (Math.abs(t.refPos - r) > SWAP_MAX_DISTANCE) continue
      const sim = similarity(expected[r], studentTokens[t.j])
      if (sim >= SWAP_MIN_SIM) pairs.push({ r, j: t.j, sim })
    }
  }
  pairs.sort((a, b) => b.sim - a.sim)
  const usedTokens = new Set()
  for (const { r, j } of pairs) {
    if (heardByRef[r] || usedTokens.has(j)) continue
    heardByRef[r] = studentTokens[j]
    outOfOrder[r] = true
    usedTokens.add(j)
  }
  return outOfOrder
}

// Attach word-level alignment notes (stutters, out-of-order words) to scored
// words from scoreWords. The note goes on the first syllable for visibility.
const STUTTER_NOTE = 'Stuttered/repeated this word — said multiple times before moving on.'
const OUT_OF_ORDER_NOTE = 'Read out of order — this word was said in a different position in the verse.'
const OUT_OF_ORDER_MAX_SCORE = 70
export function applyAlignmentNotes(scored, { stutters = [], outOfOrder = [] }) {
  return scored.map((w, i) => {
    if (w.errorType === 'Omission') return w
    const notes = [stutters[i] && STUTTER_NOTE, outOfOrder[i] && OUT_OF_ORDER_NOTE].filter(Boolean)
    if (notes.length === 0) return w
    const extra = notes.join(' ')
    const syllables = w.syllables.length > 0
      ? [{ ...w.syllables[0], note: w.syllables[0].note ? `${w.syllables[0].note} ${extra}` : extra }, ...w.syllables.slice(1)]
      : w.syllables
    if (!outOfOrder[i]) return { ...w, syllables }
    return { ...w, syllables, score: Math.min(w.score, OUT_OF_ORDER_MAX_SCORE), errorType: 'OutOfOrder' }
  })
}

// Split a free-form phonetic string into tokens for the alignment.
export function tokenizePhonetic(input) {
  return (input ?? '')
    .toLowerCase()
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
}
