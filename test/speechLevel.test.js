import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SpeechLevel, rmsOf } from '../src/utils/speechLevel.js'

test('no speech yet: nothing well above the room', () => {
  const level = new SpeechLevel()
  for (let i = 0; i < 20; i++) level.add(0.002 + (i % 3) * 0.0005)
  assert.equal(level.threshold(), null)
  assert.equal(level.isSpeech(0.003), false)
})

test('speech is well above the room; room noise is not', () => {
  const level = new SpeechLevel()
  for (let i = 0; i < 20; i++) level.add(0.002) // the room
  for (let i = 0; i < 40; i++) level.add(0.1) // reading
  assert.equal(level.isSpeech(0.1), true)
  assert.equal(level.isSpeech(0.004), false) // a fan, breathing
  assert.equal(level.isSpeech(0.03), true) // a quiet syllable
})

test('a lower cutoff counts quieter sounds as speech', () => {
  const strict = new SpeechLevel(), loose = new SpeechLevel({ above: 0.1 })
  for (const level of [strict, loose]) {
    for (let i = 0; i < 20; i++) level.add(0.002)
    for (let i = 0; i < 40; i++) level.add(0.1)
  }
  assert.equal(strict.isSpeech(0.015), false)
  assert.equal(loose.isSpeech(0.015), true)
})

test('rmsOf', () => {
  assert.equal(rmsOf(new Float32Array([0.5, -0.5, 0.5, -0.5])), 0.5)
  assert.equal(rmsOf(new Float32Array(0)), 0)
})

test('a quiet room\'s ups and downs, or a mic not delivering yet, are not speech', () => {
  const level = new SpeechLevel()
  for (let i = 0; i < 10; i++) level.add(0) // the mic's first moments
  for (let i = 0; i < 40; i++) level.add(i % 5 === 0 ? 0.006 : 0.0008) // clicks, gain settling
  assert.equal(level.threshold(), null)
  assert.equal(level.isSpeech(0.006), false)
})
