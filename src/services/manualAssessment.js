// Manual assessment: skips audio/transcription entirely and runs the rules engine
// directly on typed phonetic input. Useful for iterating on rule tuning without
// burning API credits.

import { scoreWords } from '../utils/hebrewScoring.js'
import { alignByDP, tokenizePhonetic } from '../utils/phoneticAlignment.js'

export function assessManual(referenceText, typedPhonetic, settings = {}) {
  const referenceWords = referenceText.split(/\s+/).filter(Boolean)
  const studentTokens = tokenizePhonetic(typedPhonetic)
  const { heardByRef, stutters } = alignByDP(referenceWords, studentTokens, settings)

  const scored = scoreWords(referenceWords, heardByRef, settings).map((w, i) => {
    if (!stutters[i] || w.errorType === 'Omission') return w
    const stutterNote = 'Stuttered/repeated this word — said multiple times before moving on.'
    // Tag on the first syllable for visibility
    const syllables = w.syllables.length > 0
      ? [{ ...w.syllables[0], note: w.syllables[0].note ? `${w.syllables[0].note} ${stutterNote}` : stutterNote }, ...w.syllables.slice(1)]
      : w.syllables
    return { ...w, syllables, errorType: w.errorType === 'None' ? 'None' : w.errorType }
  })

  const nonOmitted = scored.filter(w => w.errorType !== 'Omission')
  const accuracy = nonOmitted.length > 0
    ? Math.round(nonOmitted.reduce((s, w) => s + w.score, 0) / nonOmitted.length)
    : 0
  const completeness = referenceWords.length > 0
    ? Math.round((nonOmitted.length / referenceWords.length) * 100)
    : 0
  const pronunciation = Math.round(accuracy * 0.75 + completeness * 0.25)

  const scores = { pronunciation, accuracy, fluency: accuracy, completeness }

  const flaggedSyllables = scored.flatMap(w =>
    w.syllables.filter(s => s.note).map(s => ({ word: w.word, syllable: s.phoneme, note: s.note }))
  )
  const feedback = scored.every(w => w.errorType === 'None')
    ? 'All words match the expected phonetics for this tradition.'
    : `Found ${flaggedSyllables.length} item${flaggedSyllables.length === 1 ? '' : 's'} to work on.`

  const words = scored.map(w => ({
    word: w.word,
    score: w.score,
    errorType: w.errorType,
    phoneticHeard: w.phoneticHeard,
    phonemes: w.syllables.map(s => ({
      phoneme: s.phoneme,
      accuracyScore: s.accuracyScore,
      note: s.note,
    })),
  }))

  const rawSegment = {
    provider: 'manual',
    transcription: typedPhonetic,
    feedback,
    settings,
    perWordHeard: heardByRef,
    expectedPhonetic: scored.map(w => ({
      word: w.word,
      expected: w.expectedPhonetic,
      heard: w.phoneticHeard,
    })),
    flaggedSyllables,
  }

  return { words, scores, rawSegment }
}
