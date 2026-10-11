// Experimental mistake-based score (dev only, shown beside the current Overall).
//
// The current Overall averages syllable scores across the verse, so a few
// mistakes barely move it (a 16-word verse with 3 mistakes still scores ~96).
// This model scores like a tutor counting mistakes: start at 100 and subtract
// points per mistake by how serious it is. Verse length doesn't dilute it —
// 3 mistakes cost the same in a short verse as in a long one.
//
// The weights are provisional, to be tuned (ideally with a teacher).

export const MISTAKE_WEIGHTS = {
  skipped: 10,     // a reference word not read at all
  outOfOrder: 4,   // read, but in the wrong place
  consonant: 6,    // wrong letter sound — can change the word
  vowel: 4,        // wrong vowel
  sheva: 2,        // sheva voiced/dropped when it shouldn't be
  minor: 2,        // extra sound inserted, vowel held too long, stutter
}

export const MISTAKE_LABELS = {
  skipped: ['skipped word', 'skipped words'],
  outOfOrder: ['word out of order', 'words out of order'],
  consonant: ['wrong consonant', 'wrong consonants'],
  vowel: ['wrong vowel', 'wrong vowels'],
  sheva: ['sheva mistake', 'sheva mistakes'],
  minor: ['minor slip', 'minor slips'],
}

// words: graded words as the results view gets them ({ errorType, phonemes:
// [{ note, breakdown: { consonant, vowel } }] }). Returns null for attempts
// without per-sound breakdowns (Azure, OpenAI LLM), which this model can't read.
export function computeMistakeScore(words) {
  if (!words?.length) return null
  const graded = words.filter(w => w.errorType !== 'Omission')
  if (graded.length > 0 && !graded.some(w => w.phonemes?.some(p => p.breakdown))) return null

  const counts = { skipped: 0, outOfOrder: 0, consonant: 0, vowel: 0, sheva: 0, minor: 0 }
  let wordsClean = 0

  for (const w of words) {
    if (w.errorType === 'Omission') { counts.skipped++; continue }
    if (w.errorType === 'OutOfOrder') counts.outOfOrder++
    if (w.errorType === 'None' && !w.phonemes.some(p => p.note)) wordsClean++

    for (const p of w.phonemes) {
      const { consonant, vowel } = p.breakdown ?? {}
      let soundWrong = false
      if (consonant && !consonant.correct) { counts.consonant++; soundWrong = true }
      if (vowel && !vowel.correct) {
        if (vowel.name === 'sheva') counts.sheva++
        else counts.vowel++
        soundWrong = true
      }
      // A note with no wrong sound is a slip like an inserted sound or a held
      // vowel — except an out-of-order word's own note, already counted above.
      if (p.note && !soundWrong && w.errorType !== 'OutOfOrder') counts.minor++
    }
  }

  const deductions = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => ({ kind, count: n, points: n * MISTAKE_WEIGHTS[kind] }))
  const penalty = deductions.reduce((sum, d) => sum + d.points, 0)

  return {
    score: Math.max(0, 100 - penalty),
    deductions,
    wordsClean,
    wordsTotal: words.length,
  }
}
