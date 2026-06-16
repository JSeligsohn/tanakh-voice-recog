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
// Returns { heardByRef, stutters } where stutters[refIdx] is true if any of the
// matched tokens for that ref were repeated by the student.
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
  const stutters = new Array(N).fill(false)
  let i = N, j = M
  while (i > 0 || j > 0) {
    const mv = back[i][j]
    if (!mv) break
    if (mv.type === 'match') {
      const span = mv.span
      heardByRef[i - 1] = studentTokens.slice(j - span, j).join('')
      // Any of the matched tokens were stuttered?
      for (let k = j - span; k < j; k++) {
        if (stutterMap[k] > 0) { stutters[i - 1] = true; break }
      }
      i--; j -= span
    } else if (mv.type === 'skip-ref') {
      i--
    } else {
      j--
    }
  }
  return { heardByRef, stutters }
}

// Split a free-form phonetic string into tokens for the alignment.
export function tokenizePhonetic(input) {
  return (input ?? '')
    .toLowerCase()
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
}
