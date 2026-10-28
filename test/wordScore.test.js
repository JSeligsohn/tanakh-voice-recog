// The word-based score on real readings (the full-verse
// transcription check takes), graded through Manual mode's pipeline.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { psukim } from '../src/data/psukim.js'
import { assessManual } from '../src/services/manualAssessment.js'
import { computeWordScore, wordLabel, wordScoreOf } from '../src/utils/wordScore.js'

const score = (pasukIdx, tradition, heard) =>
  computeWordScore(assessManual(psukim[pasukIdx].text, heard, { tradition }).words)
const wordScores = r => Object.fromEntries(r.words.filter(w => w.score < 100).map(w => [w.word, w.score]))

const LECH_LECHA_4 = "vayelech avram ka'asher diber elav hashem vayelech ito lot ve'avram ben chamesh shanim ve'shivim shana betseto mecharan"

test('a clean reading scores 100 with every word clean', () => {
  const r = score(3, 'sephardic', LECH_LECHA_4)
  assert.equal(r.score, 100)
  // 16 words, with בֶּן־חָמֵשׁ graded as two
  assert.deepEqual([r.wordsClean, r.wordsTotal], [17, 17])
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
  // (וַאֲגַדְּלָה "avagadla" also drops the sheva na under the doubled ד)
  assert.deepEqual([r.soundsRight, r.soundsTotal, r.wordsClean], [45, 56, 1])
  // וַאֲבָרֶכְךָ: one wrong vowel in 11 sounds → 10/11 × 0.8 (the sheva under
  // the first כ is na, before the identical ך, so "-reche-" is right).
  assert.equal(wordScores(r)['וַאֲבָרֶכְךָ'], 73)
  assert.equal(r.score, 64)
})

test('a skipped word scores 0', () => {
  const r = score(3, 'sephardic', LECH_LECHA_4.replace("ve'shivim ", '').replace('betseto ', ''))
  assert.deepEqual(wordScores(r), { 'וְשִׁבְעִים': 0, 'בְּצֵאתוֹ': 0 })
  assert.equal(r.score, 88)
})

test('a word read out of place is one mistake, not also a slip', () => {
  const r = score(8, 'sephardic', 'az yashir moshe yisrael uvne et hashira hazot')
  // out of place, and "uvne" also drops the sheva na after the long וּ
  assert.deepEqual(wordScores(r), { 'וּבְנֵי': 48 })
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

test('assessments report the word-based score as the verse score and on each word', () => {
  const { words, scores } = assessManual(psukim[1].text, 'veescha legoy gagol vavarechecha avagadla shomcha veyes brecha', { tradition: 'ashkenazic' })
  const r = computeWordScore(words)
  assert.equal(scores.pronunciation, r.score)
  assert.deepEqual([scores.wordsCorrect, scores.wordsTotal, scores.soundsRight, scores.soundsTotal], [1, 8, 45, 56])
  assert.deepEqual(words.map(w => w.score), r.words.map(w => w.score))
})

test('word label names the one mistake, counts several, and marks repeats', () => {
  const label = heard => {
    const { words } = assessManual('וַיֹּאמֶר הַשֵּׁם אֶל־אַבְרָם', heard, { tradition: 'sephardic' })
    return words.map(wordLabel)
  }
  assert.deepEqual(label('vayomer hashem el avram'), ['Correct', 'Correct', 'Correct', 'Correct'])
  assert.deepEqual(label('vayomar hashem el avram'), ['Wrong vowel', 'Correct', 'Correct', 'Correct'])
  assert.deepEqual(label('vayomer hasem el avram'), ['Correct', 'Wrong letter', 'Correct', 'Correct'])
  assert.deepEqual(label('vayomer hashem hashem el avram'), ['Correct', 'Repeated', 'Correct', 'Correct'])
  assert.deepEqual(label('vayomer el avram'), ['Correct', 'Skipped', 'Correct', 'Correct'])
  assert.equal(label('vayomar hasham el avram')[1], 'Wrong vowel')
  assert.equal(label('vuyomar hashem el avram')[0], '2 wrong vowels')
  assert.equal(label('vayomar hasem el avram').slice(0, 2).join(), 'Wrong vowel,Wrong letter')
})

test('word label counts the mistakes the score counts, for new and saved readings', () => {
  // לְךָ read "lo": a wrong sheva na, and ךָ skipped — its "kh" and "aw" both
  // missing — is three mistakes, as the score counts them
  const { words } = assessManual(psukim[0].text, 'vayomer hashem el avram lech lo', { tradition: 'ashkenazic' })
  const lecha = words[5]
  assert.equal(wordLabel(lecha), '3 mistakes')
  assert.equal(wordScoreOf(lecha).mistakes, 3)
  const saved = { ...lecha, phonemes: lecha.phonemes.map(p => ({ ...p, issues: undefined })) }
  assert.equal(wordLabel(saved), '3 mistakes')
})

test('"aviyo" for אָבִיךָ: the "kh" left out, the vowel right', () => {
  const { words } = assessManual(psukim[0].text, 'vayomer hashem el avram lech lecha meartsecha umimoladtecha umibeit aviyo', { tradition: 'ashkenazic' })
  const avicha = words[9]
  assert.equal(wordLabel(avicha), 'Missing sound')
  assert.deepEqual(avicha.phonemes.map(p => p.note).filter(Boolean), ['The "kh" of ךָ wasn\'t heard — only its vowel, "aw" as in "law".'])
})
