// Phoneme assessment: the recording goes to our phoneme scorer
// (api/phonemes.js), which runs a phoneme model on the server and checks each
// sound of the verse against what was heard. Its findings are graded here into
// the same results as OpenAI (Rules): word scores, syllable notes and the
// sound-by-sound breakdown (gradeWordFromFindings), with the word-based score.

import { gradeWordFromFindings } from '../utils/hebrewScoring.js'
import { splitVerseWords } from '../utils/hebrewRules.js'
import { applyWordScore } from '../utils/wordScore.js'
import { blobToWavBase64 } from '../utils/wav.js'
import { currentTester } from '../utils/tester.js'

const MAX_AUDIO_BASE64 = 4_400_000 // keep in step with the server limit

export async function assessWithPhonemes(audioBlob, referenceText, settings = {}) {
  // 16 kHz, the rate the phoneme model listens at
  const audio = await blobToWavBase64(audioBlob, 16000)
  if (audio.length > MAX_AUDIO_BASE64) {
    throw new Error('This recording is too long to send (over about a minute and a half). Try reading a shorter section.')
  }
  const response = await fetch('/api/phonemes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // A tester's recordings are saved for review (utils/tester.js)
    body: JSON.stringify({ audio, referenceText, settings, tester: currentTester() }),
  })
  let data = null
  try { data = await response.json() } catch { /* non-JSON error page */ }
  if (!response.ok) throw new Error(data?.error ?? `Server error (${response.status}).`)
  if (!Array.isArray(data?.flags)) throw new Error('The phoneme scorer returned no result.')
  return gradeFindings(data, referenceText, settings)
}

// The scorer's reply → the app's results ({ words, scores, rawSegment })
export function gradeFindings({ flags, model = null, heard = '', seconds = null, attemptId = null }, referenceText, settings = {}) {
  // Maqef-joined words are graded one by one (אֶל־אַבְרָם → אֶל־, אַבְרָם), as the scorer does
  const referenceWords = splitVerseWords(referenceText)
  const scored = referenceWords.map((word, wi) => gradeWordFromFindings(word, flags.filter(f => f.wi === wi), settings))

  const nonOmitted = scored.filter(w => w.errorType !== 'Omission')
  const accuracy = nonOmitted.length > 0
    ? Math.round(nonOmitted.reduce((s, w) => s + w.score, 0) / nonOmitted.length)
    : 0
  const completeness = referenceWords.length > 0
    ? Math.round((nonOmitted.length / referenceWords.length) * 100)
    : 0
  const pronunciation = Math.round(accuracy * 0.75 + completeness * 0.25)

  const flaggedSyllables = scored.flatMap(w =>
    w.syllables.filter(s => s.note).map(s => ({ word: w.word, syllable: s.phoneme, note: s.note }))
  )
  const feedback = scored.every(w => w.errorType === 'None')
    ? 'Great reading — clear and accurate throughout.'
    : flaggedSyllables.length > 0
      ? `Found ${flaggedSyllables.length} item${flaggedSyllables.length === 1 ? '' : 's'} to work on.`
      : 'Some words could use work — see word-by-word details.'

  const { words, scores } = applyWordScore(scored.map(w => ({
    word: w.word,
    score: w.score,
    errorType: w.errorType,
    phoneticHeard: w.phoneticHeard,
    phonemes: w.syllables.map(s => ({
      phoneme: s.phoneme,
      note: s.note,
      problems: s.problems,
      breakdown: s.breakdown,
    })),
  })), { pronunciation, accuracy, fluency: accuracy, completeness })

  const rawSegment = {
    provider: 'phonemes',
    model,
    // A tester's saved attempt, for a review link (/?review=<id>)
    ...(attemptId ? { attemptId } : {}),
    feedback,
    settings,
    seconds,
    // What the model heard, unaided (IPA), and every finding, for the debug panel
    phonemesHeard: heard,
    flags,
    expectedPhonetic: scored.map(w => ({ word: w.word, expected: w.expectedPhonetic })),
    flaggedSyllables,
  }

  return { words, scores, rawSegment }
}
