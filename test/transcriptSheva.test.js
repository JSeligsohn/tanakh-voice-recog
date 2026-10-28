// Shevas when grading from a gpt-audio transcription vs from what was really
// said. The transcription often writes a quick sheva na after a long vowel or
// under a doubled letter as nothing ("uvnei" for "u-ve-nei"), so that alone
// isn't a mistake there; typed readings (and the phoneme scorer) are strict.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeTranscription } from '../src/services/openaiRulesAssessment.js'
import { assessManual } from '../src/services/manualAssessment.js'

const settings = { tradition: 'sephardic', shevaMode: 'enforce' }
const mistakesIn = ({ words }) => words.filter(w => w.errorType !== 'None').map(w => w.word)

for (const [text, heard] of [['וּבְנֵי', 'uvnei'], ['שׁוֹמְרִים', 'shomrim'], ['הַמְּלָכִים', 'hamlachim']]) {
  test(`a transcription's "${heard}" passes: the sheva na may have been said`, () => {
    assert.deepEqual(mistakesIn(gradeTranscription(heard, text, settings)), [])
  })
  test(`a typed "${heard}" is a dropped sheva na`, () => {
    assert.deepEqual(mistakesIn(assessManual(text, heard, settings)), [text])
  })
}

test('a sheva na at the start of a word stays strict for transcriptions', () => {
  assert.deepEqual(mistakesIn(gradeTranscription('shma', 'שְׁמַע', settings)), ['שְׁמַע'])
})
