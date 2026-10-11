// The experimental word-based score on real readings (the full-verse
// transcription check takes), graded through Manual mode's pipeline.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { psukim } from '../src/data/psukim.js'
import { assessManual } from '../src/services/manualAssessment.js'
import { computeWordScore } from '../src/utils/wordScore.js'

const score = (pasukIdx, tradition, heard) =>
  computeWordScore(assessManual(psukim[pasukIdx].text, heard, { tradition }).words)
const wordScores = r => Object.fromEntries(r.words.filter(w => w.score < 100).map(w => [w.word, w.score]))

const LECH_LECHA_4 = "vayelech avram ka'asher diber elav hashem vayelech ito lot ve'avram ben chamesh shanim ve'shivim shana betseto mecharan"

test('a clean reading scores 100 with every word clean', () => {
  const r = score(3, 'sephardic', LECH_LECHA_4)
  assert.equal(r.score, 100)
  assert.deepEqual([r.wordsClean, r.wordsTotal], [16, 16])
})

test('each mistake takes one sound\'s share off its word, and a misread word keeps 80% of that', () => {
  // דִּבֶּר has 5 sounds; one wrong letter leaves 4/5, × 0.8 = 64.
  const r = score(3, 'sephardic', LECH_LECHA_4.replace('diber', 'dibel'))
  assert.deepEqual(wordScores(r), { 'דִּבֶּר': 64 })
  assert.equal(r.score, 98)

  // שְׁמַע has 4 sounds; voicing the sheva leaves 3/4, × 0.8 = 60.
  const shema = score(5, 'ashkenazic', 'shma yisroel hashem elohenu hashem echod')
  assert.deepEqual(wordScores(shema), { 'שְׁמַע': 60 })
})

test('a wrong vowel or extra sound counts against the word like a wrong letter', () => {
  const r = score(1, 'ashkenazic', 'veescha legoy gagol vavarechecha avagadla shomcha veyes brecha')
  assert.deepEqual([r.soundsRight, r.soundsTotal, r.wordsClean], [42, 52, 1])
  // וַאֲבָרֶכְךָ: one wrong vowel and one extra sound, 2 mistakes in 10 sounds → 8/10 × 0.8.
  assert.equal(wordScores(r)['וַאֲבָרֶכְךָ'], 64)
  assert.equal(r.score, 63)
})

test('a skipped word scores 0', () => {
  const r = score(3, 'sephardic', LECH_LECHA_4.replace("ve'shivim ", '').replace('betseto ', ''))
  assert.deepEqual(wordScores(r), { 'וְשִׁבְעִים': 0, 'בְּצֵאתוֹ': 0 })
  assert.equal(r.score, 88)
})

test('a word read out of place is one mistake, not also a slip', () => {
  const r = score(8, 'sephardic', 'az yashir moshe yisrael uvne et hashira hazot')
  assert.deepEqual(wordScores(r), { 'וּבְנֵי': 64 })
})

test('the score never drops below zero', () => {
  const r = score(3, 'sephardic', 'vayelech')
  assert.ok(r.score >= 0 && r.score < 10)
  assert.ok(r.words.every(w => w.score >= 0))
})

test('attempts without per-sound detail (Azure, OpenAI LLM) are not scored', () => {
  const azureWords = [{ word: 'א', errorType: 'Mispronunciation', phonemes: [{ phoneme: 'a', accuracyScore: 50 }] }]
  assert.equal(computeWordScore(azureWords), null)
  assert.equal(computeWordScore([]), null)
})
