// The Transcription check page's item list must agree with the grading
// engine: each expected (or accepted) transcription of a correct reading
// grades clean, and each deliberate error is flagged. Then a ✗ on that page
// always means the audio model got it wrong, never that the list is wrong.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreWordAgainstTranscription } from '../src/utils/hebrewScoring.js'
import { checkItems } from '../src/data/transcriptionCheck.js'

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
