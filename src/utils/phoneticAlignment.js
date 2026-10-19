// Sequence alignment helpers shared between manual and OpenAI-rules assessment.
// Aligns a list of student phonetic tokens against the reference words, allowing
// omissions, insertions, and 1-3 student tokens combining for a single ref word.

import { tokenizeWord, getExpectedPhonetic, joinsNext } from './hebrewRules.js'
import { splitHeardAcrossWords } from './hebrewScoring.js'

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

// A token said again right after itself ("hashem hashem") is usually a
// stutter, but not always: "lekh lekh" for לֶךְ־לְךָ is two words, the second
// missing its vowel. So repeats stay in the token list and the DP decides —
// dropping a repeat is free, matching it to the next word is scored as usual.
const repeatsOf = tokens => tokens.map((t, j) => j > 0 && tokens[j - 1] === t)

// The tokens [a, b) as one heard string, repeats inside the run left out
const joinTokens = (tokens, repeats, a, b) =>
  tokens.slice(a, b).filter((_, k) => k === 0 || !repeats[a + k]).join('')

// Find the best mapping of student tokens onto reference words, allowing
// omissions (skipped reference words), insertions (extra spoken words), and
// 1-4 student tokens combining for one reference word (where the speaker's
// tokenization doesn't match Hebrew's). Maqef-joined words (אֶל־, אַבְרָם —
// see splitVerseWords) are often heard as one token ("elavram"), so a run of
// them can also match together, then the heard sounds are split between them.
// Returns { heardByRef, stutters, outOfOrder } where stutters[refIdx] is true if
// any of the matched tokens for that ref were repeated by the student, and
// outOfOrder[refIdx] is true if the word was recovered from a different position
// (see recoverSwappedWords).
export function alignByDP(referenceWords, studentTokens, settings = {}) {
  const repeats = repeatsOf(studentTokens)
  const join = (a, b) => joinTokens(studentTokens, repeats, a, b)
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
  const MAX_JOINED = 4 // longest run of maqef-joined words matched together
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
        const score = dp[i][j - 1] + (repeats[j - 1] ? 0 : SKIP_STUDENT)
        if (score > best) { best = score; bestMove = { type: 'skip-student' } }
      }
      // 1-4 student tokens for one word — more than one where the speaker's
      // tokenization doesn't match Hebrew's, or a word was stuttered
      for (let span = 1; span <= 4 && span <= j; span++) {
        if (i === 0 || dp[i - 1][j - span] === NEG) continue
        const sim = similarity(expected[i - 1], join(j - span, j))
        if (sim < MIN_SIM) continue
        const score = dp[i - 1][j - span] + (2 * sim - 1)
        if (score > best) { best = score; bestMove = { type: 'match', span } }
      }

      // A run of maqef-joined words heard together: scored as that many
      // separate matches would be, so separate tokens still win a tie
      for (let r = 2; r <= MAX_JOINED && i >= r && joinsNext(referenceWords[i - r]); r++) {
        const exp = expected.slice(i - r, i).join('')
        for (let span = 1; span <= 4 && span <= j; span++) {
          if (dp[i - r][j - span] === NEG) continue
          const sim = similarity(exp, join(j - span, j))
          if (sim < MIN_SIM) continue
          const score = dp[i - r][j - span] + r * (2 * sim - 1)
          if (score > best) { best = score; bestMove = { type: 'match', span, words: r } }
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
  const refOfToken = new Array(M).fill(-1)
  const markSpan = (a, b, r) => {
    for (let k = a; k < b; k++) {
      refOfToken[k] = r
      if (k > a && repeats[k]) stutters[r] = true
    }
  }
  let i = N, j = M
  while (i > 0 || j > 0) {
    const mv = back[i][j]
    if (!mv) break
    if (mv.type === 'match' && mv.words) {
      const first = i - mv.words
      // No spanByRef: stray-prefix moves need one word per span of tokens
      splitHeardAcrossWords(referenceWords.slice(first, i), join(j - mv.span, j), settings)
        .forEach((part, k) => { heardByRef[first + k] = part })
      markSpan(j - mv.span, j, first)
      i = first; j -= mv.span
    } else if (mv.type === 'match') {
      const span = mv.span
      heardByRef[i - 1] = join(j - span, j)
      spanByRef[i - 1] = [j - span, j]
      markSpan(j - span, j, i - 1)
      i--; j -= span
    } else if (mv.type === 'skip-ref') {
      i--
    } else {
      if (!repeats[j - 1]) skippedTokens.push({ j: j - 1, refPos: i })
      j--
    }
  }
  // A dropped repeat is a stutter on the word its first saying went to
  for (let k = 0; k < M; k++) {
    if (repeats[k] && refOfToken[k] === -1 && refOfToken[k - 1] >= 0) {
      refOfToken[k] = refOfToken[k - 1]
      stutters[refOfToken[k]] = true
    }
  }
  moveStrayPrefixes(expected, studentTokens, repeats, heardByRef, spanByRef)
  const unassigned = attachStrayPrefixes(expected, studentTokens, heardByRef, spanByRef, skippedTokens)
  const outOfOrder = recoverSwappedWords(expected, studentTokens, heardByRef, unassigned)
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
function moveStrayPrefixes(expected, studentTokens, repeats, heardByRef, spanByRef) {
  for (let r = 0; r < expected.length - 1; r++) {
    const span = spanByRef[r]
    const next = spanByRef[r + 1]
    if (!span || !next || span[1] - span[0] < 2 || next[0] !== span[1]) continue
    const last = studentTokens[span[1] - 1]
    if (!PREFIX_SYLLABLE.test(last)) continue
    const without = joinTokens(studentTokens, repeats, span[0], span[1] - 1)
    if (similarity(expected[r], without) <= similarity(expected[r], heardByRef[r])) continue
    heardByRef[r] = without
    heardByRef[r + 1] = last + heardByRef[r + 1]
    spanByRef[r] = [span[0], span[1] - 1]
    spanByRef[r + 1] = [span[1] - 1, next[1]]
  }
}

// A prefix syllable said on its own right before a word ("ka asher" —
// כַּאֲשֶׁר read for אֲשֶׁר) is often left out by the DP as an extra token, which
// would hide the mistake. It belongs to that word, unless the word itself
// starts with it (a false start, "ha hashem"). Mutates heardByRef and
// spanByRef; returns the tokens still unassigned.
function attachStrayPrefixes(expected, studentTokens, heardByRef, spanByRef, skippedTokens) {
  return skippedTokens.filter(({ j, refPos }) => {
    const span = spanByRef[refPos]
    const token = studentTokens[j]
    if (!span || span[0] !== j + 1 || !PREFIX_SYLLABLE.test(token) || expected[refPos].startsWith(token)) return true
    heardByRef[refPos] = token + heardByRef[refPos]
    spanByRef[refPos] = [j, span[1]]
    return false
  })
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
    const added = [
      stutters[i] && { kind: 'repeated', count: 1, text: STUTTER_NOTE },
      outOfOrder[i] && { kind: 'out-of-order', count: 1, text: OUT_OF_ORDER_NOTE },
    ].filter(Boolean)
    const first = w.syllables[0]
    const syllables = first
      ? [{ ...first, note: first.note ? `${first.note} ${extra}` : extra, problems: [...(first.problems ?? []), ...added] }, ...w.syllables.slice(1)]
      : w.syllables
    if (!outOfOrder[i]) {
      // A repeat is a mistake too (it costs the word score), so an otherwise
      // clean word is marked repeated, not correct
      return { ...w, syllables, errorType: w.errorType === 'None' ? 'Repeated' : w.errorType }
    }
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
