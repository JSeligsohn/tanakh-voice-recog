const HEBREW_LETTER = /[א-תװ-״יִ-פֿ]/
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

// Ensure every word in the reference text appears in the result.
// Azure may silently drop leading words that were cut off before recording fully started,
// or skip words when enableMiscue doesn't catch an early omission.
// Any missing reference word is inserted as an Omission so the full verse always displays.
export function reconcileWords(referenceText, azureWords) {
  const refTokens = referenceText.split(/\s+/).filter(Boolean)
  const result = []
  let ai = 0

  for (const token of refTokens) {
    const norm = stripMarks(token)
    if (!norm) continue
    const next = azureWords[ai]
    if (next && stripMarks(next.word) === norm) {
      result.push(next)
      ai++
    } else {
      // Insert missing word using the nikud form from the reference text
      result.push({ word: token, score: 0, errorType: 'Omission', phonemes: [] })
    }
  }

  // Append any extra Azure words beyond the reference (Insertions)
  while (ai < azureWords.length) {
    result.push(azureWords[ai++])
  }

  return result
}
