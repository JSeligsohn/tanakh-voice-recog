// Grading: a student's reading of a word or verse → pass, or flagged with the
// right note. Cases live in test/cases/grading.js.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreWordAgainstTranscription } from '../src/utils/hebrewScoring.js'
import { assessManual } from '../src/services/manualAssessment.js'
import { gradingCases, verseCases } from './cases/grading.js'

const options = c => (c.todo ? { todo: c.todo } : {})
const notesOf = syllables => syllables.map(s => s.note).filter(Boolean)

for (const c of gradingCases) {
  const tradition = c.trad ?? 'sephardic'
  const outcome = c.pass ? 'passes' : `flagged "${c.flag}"`
  const name = `${c.review ? '[review] ' : ''}${c.word} heard "${c.heard}" (${tradition}) ${outcome}${c.rule ? ` — ${c.rule}` : ''}`
  test(name, options(c), () => {
    const r = scoreWordAgainstTranscription(c.word, c.heard, { tradition })
    const notes = notesOf(r.syllables)
    if (c.pass) {
      assert.deepEqual(notes, [], `expected a clean pass (score ${r.score})`)
      assert.equal(r.errorType, 'None')
    } else {
      assert.ok(notes.some(n => n.includes(c.flag)), `no note mentions "${c.flag}". Notes: ${JSON.stringify(notes)}`)
    }
  })
}

for (const c of verseCases) {
  test(`verse "${c.heard}" — ${c.rule}`, options(c), () => {
    const { words } = assessManual(c.text, c.heard, { tradition: 'sephardic' })
    words.forEach((w, i) => {
      assert.equal(w.errorType, c.expect[i] ?? 'None', `word ${i} ${w.word} (heard "${w.phoneticHeard}")`)
      if (c.notes?.[i]) {
        assert.ok(notesOf(w.phonemes).some(n => n.includes(c.notes[i])), `word ${i} ${w.word} should note "${c.notes[i]}"`)
      }
    })
  })
}
