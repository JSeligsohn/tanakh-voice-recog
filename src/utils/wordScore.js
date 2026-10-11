// Experimental word-based score (dev only, shown beside the current Overall).
//
// Every word is an equal share of the verse. A word is made of its sounds —
// each consonant and each vowel (sheva included) — and is 100 only when all of
// them are read correctly. Each mistake takes one sound's share off the word,
// so a mistake in a short word costs more of it than one in a long word. A word
// with any mistake also drops to 80% of that, so it can't score above 80 — a
// misread word should stand apart from a correct one, not land at 90-something.
//
//   - A wrong consonant or vowel (including a skipped syllable's sounds) is a
//     mistake. Accepted variants (e.g. Ashkenazic kamatz as "a") count as right.
//   - A slip with no wrong sound — an extra sound, a held vowel, a stutter, the
//     word read out of place — is also one mistake.
//   - A skipped word scores 0. A word never goes below 0, so neither does the verse.

// A word with any mistake keeps this share of its sound score.
export const MISTAKE_WORD_FACTOR = 0.8

// words: graded words as the results view gets them ({ errorType, phonemes:
// [{ note, breakdown: { consonant, vowel } }] }). Returns null for attempts
// without per-sound breakdowns (Azure, OpenAI LLM), which this model can't read.
export function computeWordScore(words) {
  if (!words?.length) return null
  const graded = words.filter(w => w.errorType !== 'Omission')
  if (graded.length > 0 && !graded.some(w => w.phonemes?.some(p => p.breakdown))) return null

  const scored = words.map(w => {
    if (w.errorType === 'Omission') return { word: w.word, score: 0, sounds: 0, soundsRight: 0, mistakes: 0, skipped: true }

    let sounds = 0
    let soundsRight = 0
    let mistakes = w.errorType === 'OutOfOrder' ? 1 : 0
    for (const p of w.phonemes) {
      const parts = [p.breakdown?.consonant, p.breakdown?.vowel].filter(Boolean)
      sounds += parts.length
      const wrong = parts.filter(s => !s.correct).length
      soundsRight += parts.length - wrong
      mistakes += wrong
      // A note with no wrong sound is a slip — except an out-of-order word's
      // own note, already counted above.
      if (p.note && wrong === 0 && w.errorType !== 'OutOfOrder') mistakes++
    }
    const soundShare = sounds ? Math.max(0, (sounds - mistakes) / sounds) : (mistakes ? 0 : 1)
    const score = Math.round(100 * soundShare * (mistakes ? MISTAKE_WORD_FACTOR : 1))
    return { word: w.word, score, sounds, soundsRight, mistakes, skipped: false }
  })

  const sum = (key) => scored.reduce((s, w) => s + w[key], 0)
  return {
    score: Math.round(sum('score') / scored.length),
    words: scored,
    wordsClean: scored.filter(w => !w.skipped && w.mistakes === 0).length,
    wordsTotal: scored.length,
    soundsRight: sum('soundsRight'),
    soundsTotal: sum('sounds'),
  }
}
