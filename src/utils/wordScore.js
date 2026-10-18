// Word-based score: the verse score for the rules-engine modes (OpenAI Rules, Manual).
//
// Every word is an equal share of the verse (each part of a maqef phrase is a
// word). A word is made of its sounds — each consonant and each vowel, sheva
// na included, and a sheva nach too when shevas are graded (kept silent is
// right) — and is 100 only when all of them are read correctly. Each mistake takes one sound's share off the word,
// so a mistake in a short word costs more of it than one in a long word. A word
// with any mistake also drops to 80% of that, so it can't score above 80 — a
// misread word should stand apart from a correct one, not land at 90-something.
//
//   - Each wrong or missing sound is a mistake: a skipped syllable is one for
//     each of its sounds. Accepted variants (e.g. Ashkenazic kamatz as "a")
//     count as right.
//   - Each slip — an extra sound, a held vowel, a stutter, the word read out
//     of place — is also one mistake.
//   The mistakes are the ones the grader lists for each syllable (its problems),
//   so the score, the word's label and its notes all count the same things.
//   - A skipped word scores 0. A word never goes below 0, so neither does the verse.

// A word with any mistake keeps this share of its sound score.
export const MISTAKE_WORD_FACTOR = 0.8

// The sounds of a graded syllable: its consonant and vowel, each right or wrong
const soundsOf = p => [p.breakdown?.consonant, p.breakdown?.vowel].filter(Boolean)

// A graded syllable is right when all its sounds are right and nothing was
// noted about it (a slip, like an extra sound or a held vowel, has a note but
// no wrong sound). This is what the word popover marks ✓ or ✗.
export const syllableRight = p => !p.note && soundsOf(p).every(s => s.correct)

// One graded word's score, sounds and mistakes (see the top of this file)
export function wordScoreOf(w) {
  if (w.errorType === 'Omission') return { word: w.word, score: 0, sounds: 0, soundsRight: 0, mistakes: 0, skipped: true }

  let sounds = 0
  let soundsRight = 0
  for (const p of w.phonemes) {
    const parts = soundsOf(p)
    sounds += parts.length
    soundsRight += parts.filter(s => s.correct).length
  }
  const mistakes = mistakesOf(w)
  const soundShare = sounds ? Math.max(0, (sounds - mistakes) / sounds) : (mistakes ? 0 : 1)
  const score = Math.round(100 * soundShare * (mistakes ? MISTAKE_WORD_FACTOR : 1))
  return { word: w.word, score, sounds, soundsRight, mistakes, skipped: false }
}

// A word's mistakes: the ones its syllables list (problems: one mistake per
// wrong or missing sound, and one per slip). Readings saved before mistakes
// were listed count each wrong sound, and a note with no wrong sound as one slip.
function mistakesOf(w) {
  if (w.phonemes.some(p => p.problems)) {
    return w.phonemes.reduce((n, p) => n + (p.problems ?? []).reduce((k, x) => k + x.count, 0), 0)
  }
  let mistakes = w.errorType === 'OutOfOrder' ? 1 : 0
  for (const p of w.phonemes) {
    const wrong = soundsOf(p).filter(s => !s.correct).length
    mistakes += wrong
    // An out-of-order word's own note is already counted above
    if (p.note && wrong === 0 && w.errorType !== 'OutOfOrder') mistakes++
  }
  return mistakes
}

// The kinds of mistake a graded syllable's problems can be, as a word's label
// and each problem's tag name them
const ISSUE_LABELS = {
  'wrong-letter': 'Wrong letter',
  'wrong-vowel': 'Wrong vowel',
  'missing-sound': 'Missing sound',
  'extra-sound': 'Extra sound',
  'held-vowel': 'Vowel held too long',
  'repeated': 'Repeated',
  'out-of-order': 'Out of order',
}

// Several of one kind: "2 missing sounds"
const ISSUE_PLURALS = {
  'wrong-letter': 'wrong letters',
  'wrong-vowel': 'wrong vowels',
  'missing-sound': 'missing sounds',
  'extra-sound': 'extra sounds',
}

// A problem's tag: "Wrong letter", or "2 missing sounds" for a syllable
// skipped with both its sounds
export function problemLabel({ kind, count }) {
  if (count === 1) return ISSUE_LABELS[kind] ?? 'Mistake'
  return `${count} ${ISSUE_PLURALS[kind] ?? 'mistakes'}`
}

// A graded word's label: "Correct", "Skipped", the kind of its one mistake
// ("Wrong vowel"), or how many mistakes it has ("2 missing sounds", "3
// mistakes") — the same mistakes the score counts, and the notes describe.
// Readings saved before mistakes had kinds get a plain count.
export function wordLabel(w) {
  if (w.errorType === 'Omission') return 'Skipped'
  const count = mistakesOf(w)
  if (count === 0) return 'Correct'
  const kinds = [...new Set(w.phonemes.flatMap(p => (p.problems ?? []).map(x => x.kind)))]
  if (kinds.length === 1 && count === 1) return ISSUE_LABELS[kinds[0]] ?? '1 mistake'
  if (kinds.length === 1 && ISSUE_PLURALS[kinds[0]]) return `${count} ${ISSUE_PLURALS[kinds[0]]}`
  return count === 1 ? '1 mistake' : `${count} mistakes`
}

// words: graded words as the results view gets them ({ errorType, phonemes:
// [{ note, breakdown: { consonant, vowel } }] }). Returns null for attempts
// without per-sound breakdowns (Azure, OpenAI LLM), which this model can't read.
export function computeWordScore(words) {
  if (!words?.length) return null
  const graded = words.filter(w => w.errorType !== 'Omission')
  if (graded.length > 0 && !graded.some(w => w.phonemes?.some(p => p.breakdown))) return null

  const scored = words.map(wordScoreOf)

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

// Puts the word-based score onto an assessment's results: each word's score
// becomes its word-based score, and the verse score (scores.pronunciation, which
// the history badge reads) becomes the word-based score, with the counts
// alongside. The old accuracy/completeness figures stay for the raw data.
export function applyWordScore(words, scores) {
  const ws = computeWordScore(words)
  if (!ws) return { words, scores }
  return {
    words: words.map((w, i) => ({ ...w, score: ws.words[i].score })),
    scores: {
      ...scores,
      pronunciation: ws.score,
      wordsCorrect: ws.wordsClean,
      wordsTotal: ws.wordsTotal,
      soundsRight: ws.soundsRight,
      soundsTotal: ws.soundsTotal,
    },
  }
}
