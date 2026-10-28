// The phoneme scorer's findings, graded into the app's results
// (gradeWordFromFindings, gradeFindings): the same notes, sound breakdown and
// word score as a transcription would get.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gradeFindings } from '../src/services/phonemeAssessment.js'

const settings = { tradition: 'sephardic', shevaMode: 'enforce' }
const grade = (text, flags) => gradeFindings({ flags }, text, settings)
const notesOf = w => w.phonemes.filter(p => p.note).map(p => p.note)

test('no findings: every word correct', () => {
  const { words, scores } = grade('בְּרֵאשִׁית בָּרָא אֱלֹהִים', [])
  assert.deepEqual(words.map(w => w.errorType), ['None', 'None', 'None'])
  assert.equal(scores.pronunciation, 100)
})

test('a wrong letter: the rules engine\'s note, and the letter marked wrong', () => {
  const { words } = grade('דָּבָר', [{ wi: 0, atomIndex: 0, kind: 'letter', partner: 'r' }])
  assert.equal(words[0].errorType, 'Mispronunciation')
  assert.match(notesOf(words[0])[0], /ד \(dalet\) is "d".*you said "r"/)
  assert.equal(words[0].phonemes[0].breakdown.consonant.correct, false)
  assert.equal(words[0].phonemes[0].breakdown.vowel.correct, true)
})

test('a skipped word is an omission', () => {
  const { words } = grade('שְׁמַע יִשְׂרָאֵל', [{ wi: 1, atomIndex: null, kind: 'word', test: 'skipped', partner: 'left out' }])
  assert.deepEqual(words.map(w => w.errorType), ['None', 'Omission'])
})

test('a syllable left out counts each of its sounds', () => {
  const { words } = grade('הַשָּׁמַיִם', [{ wi: 0, atomIndex: 0, kind: 'syllable', test: 'prefix left out' }])
  assert.match(notesOf(words[0])[0], /^Skipped הַ/)
  assert.equal(words[0].phonemes[0].problems[0].count, 2)
})

test('patach genuvah said after its letter', () => {
  const { words } = grade('רוּחַ', [{ wi: 0, atomIndex: 1, kind: 'order', partner: 'cha' }])
  assert.match(notesOf(words[0])[0], /Patach genuvah/)
})

test('a sheva na said too short, and a vowel added under a final sheva', () => {
  const short = grade('נַפְשְׁךָ', [{ wi: 0, atomIndex: 1, kind: 'sheva-na', partner: 'short' }]).words[0]
  assert.match(notesOf(short)[0], /only slightly heard/)
  const added = grade('אַתְּ', [{ wi: 0, atomIndex: 1, kind: 'end-vowel', heard: 'a' }]).words[0]
  assert.match(notesOf(added)[0], /Sheva nach is silent.*"ah"/)
})

test('a word that sounds like another word: all its sounds wrong', () => {
  const { words } = grade('אֶחָד', [{ wi: 0, atomIndex: null, kind: 'word', test: 'wrong word', partner: 'gadol' }])
  assert.equal(words[0].errorType, 'Mispronunciation')
  assert.ok(words[0].phonemes.every(p => p.breakdown.vowel?.correct !== true && p.breakdown.consonant?.correct !== true))
})

test('a letter left out, its vowel still said ("le-a" for לְךָ)', () => {
  const { words } = grade('לְךָ', [{ wi: 0, atomIndex: 1, kind: 'letter-missing', partner: 'left out' }])
  assert.match(notesOf(words[0])[0], /"kh" of ךָ wasn't heard — only its vowel/)
  assert.equal(words[0].phonemes[1].breakdown.consonant.correct, false)
})

test('a syllable left out, its vowel said for the sheva before ("lo" for לְךָ)', () => {
  const { words } = grade('לְךָ', [
    { wi: 0, atomIndex: 0, kind: 'sheva-na', partner: 'another vowel', heard: 'o' },
    { wi: 0, atomIndex: 1, kind: 'syllable', partner: 'left out' },
  ])
  const [first, second] = notesOf(words[0])
  assert.match(first, /Sheva na is .* you said "oh"/)
  assert.match(second, /Skipped ךָ/)
})
