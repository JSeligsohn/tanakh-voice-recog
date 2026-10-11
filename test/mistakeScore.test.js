// The experimental mistake-based score on real readings (the full-verse
// transcription check takes), graded through Manual mode's pipeline.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { psukim } from '../src/data/psukim.js'
import { assessManual } from '../src/services/manualAssessment.js'
import { computeMistakeScore } from '../src/utils/mistakeScore.js'

const score = (pasukIdx, tradition, heard) =>
  computeMistakeScore(assessManual(psukim[pasukIdx].text, heard, { tradition }).words)
const counts = r => Object.fromEntries(r.deductions.map(d => [d.kind, d.count]))

test('a clean reading scores 100 with every word clean', () => {
  const r = score(3, 'sephardic', "vayelech avram ka'asher diber elav hashem vayelech ito lot ve'avram ben chamesh shanim ve'shivim shana betseto mecharan")
  assert.equal(r.score, 100)
  assert.deepEqual([r.wordsClean, r.wordsTotal], [16, 16])
})

test('wrong consonants cost more than a sheva slip', () => {
  const r = score(0, 'sephardic', 'vayomer hasem el avram lech lecha meartsecha umimoladtecha umivet avicha el haarets asher arecha')
  assert.deepEqual(counts(r), { consonant: 3 })
  assert.equal(r.score, 100 - 3 * 6)

  const shema = score(5, 'ashkenazic', 'shma yisroel hashem elohenu hashem echod')
  assert.deepEqual(counts(shema), { sheva: 1 })
  assert.equal(shema.score, 98)
})

test('skipped words cost the most, and verse length does not dilute mistakes', () => {
  const r = score(3, 'sephardic', "vayelech avram ka'asher diber elav hashem vayelech ito lot ve'avram ben chamesh shanim shana mecharan")
  assert.deepEqual(counts(r), { skipped: 2 })
  assert.equal(r.score, 80)
})

test('a word read out of place counts once, not also as a slip', () => {
  const r = score(8, 'sephardic', 'az yashir moshe yisrael uvne et hashira hazot')
  assert.deepEqual(counts(r), { outOfOrder: 1 })
  assert.equal(r.score, 96)
})

test('the score never drops below zero', () => {
  assert.equal(score(3, 'sephardic', 'vayelech').score, 0)
})

test('attempts without per-sound detail (Azure, OpenAI LLM) are not scored', () => {
  const azureWords = [{ word: 'א', errorType: 'Mispronunciation', phonemes: [{ phoneme: 'a', accuracyScore: 50 }] }]
  assert.equal(computeMistakeScore(azureWords), null)
  assert.equal(computeMistakeScore([]), null)
})
