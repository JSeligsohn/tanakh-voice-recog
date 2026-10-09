// The Transcription check page's item list must agree with the grading
// engine: each expected (or accepted) transcription of a correct reading
// grades clean, and each deliberate error is flagged. Then a ✗ on that page
// always means the audio model got it wrong, never that the list is wrong.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreWordAgainstTranscription } from '../src/utils/hebrewScoring.js'
import { tokenizeWord, getExpectedPhonetic } from '../src/utils/hebrewRules.js'
import { assessManual } from '../src/services/manualAssessment.js'
import { psukim } from '../src/data/psukim.js'
import { checkItems, verseItems } from '../src/data/transcriptionCheck.js'

test('item ids are unique', () => {
  const ids = checkItems.map(i => i.id)
  assert.equal(new Set(ids).size, ids.length)
})

for (const item of checkItems) {
  for (const heard of [item.expect, ...(item.accept ?? [])]) {
    test(`${item.id}: "${heard}" ${item.intent === 'correct' ? 'passes' : 'is flagged'} (${item.trad})`, () => {
      const r = scoreWordAgainstTranscription(item.word, heard, { tradition: item.trad })
      const notes = r.syllables.map(s => s.note).filter(Boolean)
      if (item.intent === 'correct') assert.deepEqual(notes, [])
      else assert.ok(notes.length > 0, 'deliberate error was not flagged')
    })
  }
}

// Verse items: a faithful transcription of the intended reading (expected
// pronunciation for clean words, the plant's `heard` for planted ones) must
// flag exactly the planted words — so on the page, a missed mistake or false
// flag always points at the model.
test('verse item ids are unique and distinct from word items', () => {
  const ids = [...checkItems, ...verseItems].map(i => i.id)
  assert.equal(new Set(ids).size, ids.length)
})

for (const item of verseItems) {
  test(`${item.id}: intended reading flags exactly the planted words (${item.trad})`, () => {
    const { text } = psukim[item.pasukIdx]
    const words = text.split(/\s+/).filter(Boolean)
    const plantAt = Object.fromEntries(item.plants.map(p => [p.index, p.heard]))
    const transcription = words
      .map((w, i) => plantAt[i] ?? getExpectedPhonetic(tokenizeWord(w), { tradition: item.trad }).fullPhonetic)
      .join(' ')
    const { words: graded } = assessManual(text, transcription, { tradition: item.trad })
    const flagged = graded.map((w, i) => (w.errorType !== 'None' ? i : null)).filter(i => i !== null)
    assert.deepEqual(flagged, item.plants.map(p => p.index).sort((a, b) => a - b))
  })
}
