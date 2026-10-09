// analyzeRecordingStart on synthetic recordings: digital-silence warm-up,
// room noise, and a "speech" tone, in different orders.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRecordingStart } from '../src/utils/recordingCheck.js'

const RATE = 16000
const ms = n => Math.round((n / 1000) * RATE)

// Deterministic pseudo-random noise so tests are stable
function noise(n, level) {
  let seed = 1
  return Float32Array.from({ length: n }, () => {
    seed = (seed * 16807) % 2147483647
    return ((seed / 2147483647) * 2 - 1) * level
  })
}
const zeros = n => new Float32Array(n)
const speech = n => Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / RATE))
// Real takes end with a pause before Done is clicked; the room-noise level is
// measured from quiet stretches like this one.
const tail = () => noise(ms(600), 0.003)
const join = (...parts) => {
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

test('normal take: warm-up silence, room noise, then speech — not cut', () => {
  const r = analyzeRecordingStart(join(zeros(ms(600)), noise(ms(400), 0.003), speech(ms(1500)), tail()), RATE, { readyAtMs: 750 })
  assert.equal(r.cutOff, false)
  assert.ok(Math.abs(r.silentLeadMs - 600) <= 1)
  assert.ok(r.quietBeforeSpeechMs >= 350, `quiet ${r.quietBeforeSpeechMs}ms`)
  assert.equal(r.startedBeforeCue, false)
})

test('slow mic: speech already underway when audio arrives — cut', () => {
  const r = analyzeRecordingStart(join(zeros(ms(1200)), speech(ms(1500)), tail()), RATE, { readyAtMs: 1350 })
  assert.equal(r.cutOff, true)
  assert.ok(Math.abs(r.silentLeadMs - 1200) <= 1)
})

test('fast mic but reader spoke before the cue — cut, and flagged as early', () => {
  const r = analyzeRecordingStart(join(noise(ms(10), 0.003), speech(ms(1500)), tail()), RATE, { readyAtMs: 300 })
  assert.equal(r.cutOff, true)
  assert.equal(r.startedBeforeCue, true)
})

test('reader started before the cue but after audio was flowing — captured, not cut', () => {
  const r = analyzeRecordingStart(join(noise(ms(200), 0.003), speech(ms(1500)), tail()), RATE, { readyAtMs: 400 })
  assert.equal(r.cutOff, false)
  assert.equal(r.startedBeforeCue, true)
})

test('heavily noise-suppressed room (very quiet but not zero) is not mistaken for warm-up', () => {
  const r = analyzeRecordingStart(join(noise(ms(500), 0.00005), speech(ms(1500)), tail()), RATE)
  assert.equal(r.cutOff, false)
  assert.ok(r.silentLeadMs < 5)
})

test('no speech at all — nothing to judge', () => {
  const r = analyzeRecordingStart(join(zeros(ms(300)), noise(ms(1000), 0.003)), RATE)
  assert.deepEqual([r.speechDetected, r.cutOff], [false, false])
})

test('all digital silence — mic never delivered audio', () => {
  const r = analyzeRecordingStart(zeros(ms(1000)), RATE)
  assert.deepEqual([r.speechDetected, r.cutOff, r.silentLeadMs], [false, false, 1000])
})
