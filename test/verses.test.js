// Every verse in the app, read exactly as the engine expects, must grade
// clean in both traditions. Catches alignment regressions across real text;
// it can't tell whether the expected pronunciation itself is right — that's
// what rules.test.js is for.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { psukim } from '../src/data/psukim.js'
import { tokenizeWord, getExpectedPhonetic } from '../src/utils/hebrewRules.js'
import { assessManual } from '../src/services/manualAssessment.js'

for (const tradition of ['sephardic', 'ashkenazic']) {
  for (const p of psukim) {
    test(`${p.book} (${tradition}) self-grades clean`, () => {
      const expected = p.text.split(/\s+/).filter(Boolean)
        .map(w => getExpectedPhonetic(tokenizeWord(w), { tradition }).fullPhonetic)
      const { words } = assessManual(p.text, expected.join(' '), { tradition })
      const bad = words
        .filter(w => w.errorType !== 'None')
        .map(w => `${w.word} (${w.errorType}): ${w.phonemes.map(x => x.note).filter(Boolean).join(' ')}`)
      assert.deepEqual(bad, [])
    })
  }
}
