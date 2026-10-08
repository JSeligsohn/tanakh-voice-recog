// Rules engine: expected pronunciation per word, and per-rule classification.
// Cases live in test/cases/expected.js.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tokenizeWord, getExpectedPhonetic, determineShevaType, determineQamatsType } from '../src/utils/hebrewRules.js'
import { expectedCases, shevaTypeCases, qamatsTypeCases } from './cases/expected.js'

const label = (c, detail) => `${c.review ? '[review] ' : ''}${c.word} ${detail} — ${c.rule}`
const options = c => (c.todo ? { todo: c.todo } : {})

for (const c of expectedCases) {
  for (const [tradition, want] of [['sephardic', c.seph], ['ashkenazic', c.ashk]]) {
    if (want === undefined) continue
    test(label(c, `(${tradition}) → ${want}`), options(c), () => {
      const { fullPhonetic } = getExpectedPhonetic(tokenizeWord(c.word), { tradition })
      assert.equal(fullPhonetic, want)
    })
  }
}

function typesOf(word, classify) {
  const atoms = tokenizeWord(word)
  return atoms.map((_, i) => classify(atoms, i)).filter(Boolean)
}

for (const c of shevaTypeCases) {
  test(label(c, `sheva → ${c.types.join(', ')}`), options(c), () => {
    assert.deepEqual(typesOf(c.word, determineShevaType), c.types)
  })
}

for (const c of qamatsTypeCases) {
  test(label(c, `qamats → ${c.types.join(', ')}`), options(c), () => {
    assert.deepEqual(typesOf(c.word, determineQamatsType), c.types)
  })
}
