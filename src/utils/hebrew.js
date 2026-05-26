// Matches Hebrew base consonants only (alef–tav + final forms, Yiddish digraphs).
// Deliberately excludes the nikud range U+05B0–U+05C7 to avoid treating vowel
// points as letter starts — the earlier /[א-תװ-״יִ-פֿ]/ regex had a range
// (hiriq U+05B4 – pe U+05E4) that overlapped with nikud, splitting them into
// separate groups instead of attaching them to their consonant.
const HEBREW_LETTER = /[א-תװ-״]/
const HEBREW_COMBINING = /[֑-ׇﬞ]/

// Split a Hebrew word into character groups: each base letter + its attached nikud/dagesh.
// e.g. "וְאֶעֶשְׂךָ" → ["וְ", "אֶ", "עֶ", "שְׂ", "ךָ"]
export function splitHebrewToGroups(word) {
  const groups = []
  let current = ''

  for (const char of word) {
    if (HEBREW_LETTER.test(char)) {
      if (current) groups.push(current)
      current = char
    } else if (HEBREW_COMBINING.test(char)) {
      current += char
    }
    // skip maqef, spaces, punctuation
  }
  if (current) groups.push(current)

  return groups
}

// Map phoneme accuracy scores onto character groups.
// When counts match: 1-to-1. When they don't: proportional spread.
export function mapPhonemesToGroups(groups, phonemes) {
  if (!phonemes || phonemes.length === 0) {
    return groups.map(chars => ({ chars, score: null }))
  }

  if (groups.length === phonemes.length) {
    return groups.map((chars, i) => ({ chars, score: phonemes[i].accuracyScore }))
  }

  // Proportional fallback
  return groups.map((chars, i) => {
    const start = Math.round((i * phonemes.length) / groups.length)
    const end = Math.round(((i + 1) * phonemes.length) / groups.length)
    const slice = phonemes.slice(start, Math.max(end, start + 1))
    const score = slice.reduce((s, p) => s + p.accuracyScore, 0) / slice.length
    return { chars, score }
  })
}

// Strip nikud, cantillation, dagesh, and maqef — used for word matching only.
function stripMarks(str) {
  return str
    .replace(/[֑-ׇﬞ]/g, '')
    .replace(/־/g, '') // maqef ־
}

// Align reference text words against Azure results using LCS (longest common subsequence).
// This correctly handles duplicated Azure words, omissions, and insertions in any order,
// unlike a greedy left-to-right scan which cascades badly when Azure hallucinates a repeat.
export function reconcileWords(referenceText, azureWords) {
  const refTokens = referenceText.split(/\s+/).filter(t => t && stripMarks(t))
  const refNorm = refTokens.map(stripMarks)
  const azNorm = azureWords.map(w => stripMarks(w.word))
  const n = refNorm.length
  const m = azNorm.length

  // Build LCS DP table
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = refNorm[i - 1] === azNorm[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])

  // Traceback: prefer omission over insertion when scores tie (keeps reference ordering stable)
  const aligned = []
  let i = n, j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && refNorm[i - 1] === azNorm[j - 1]) {
      aligned.unshift({ ri: i - 1, ai: j - 1 }); i--; j--
    } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
      aligned.unshift({ ri: i - 1, ai: null }); i-- // omission
    } else {
      aligned.unshift({ ri: null, ai: j - 1 }); j-- // insertion
    }
  }

  return aligned.map(({ ri, ai }) => {
    if (ri !== null && ai !== null) return azureWords[ai]
    if (ri !== null) return { word: refTokens[ri], score: 0, errorType: 'Omission', phonemes: [] }
    return azureWords[ai] // insertion — extra word Azure heard that isn't in the reference
  })
}
