// waitForAudio with a fake AudioContext: the mic delivers exact zeros for a
// while (warming up), then real samples. Covers the ready, still-silent, and
// suspended-context (can't inspect → fixed fallback, no hang) paths.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { waitForAudio } from '../src/utils/micReady.js'

// silentPolls: how many reads return all zeros before audio "arrives"
// (Infinity = never). startState: the AudioContext's initial state, and
// whether resume() ever settles.
function installFakeAudioContext({ silentPolls = 0, startState = 'running', resumeSettles = true } = {}) {
  let reads = 0
  globalThis.AudioContext = class {
    constructor() { this.state = startState }
    resume() {
      if (!resumeSettles) return new Promise(() => {})
      this.state = 'running'
      return Promise.resolve()
    }
    close() { this.state = 'closed'; return Promise.resolve() }
    createAnalyser() {
      return {
        fftSize: 0,
        getFloatTimeDomainData(buf) { buf.fill(reads++ < silentPolls ? 0 : 0.001) },
      }
    }
    createMediaStreamSource() { return { connect() {} } }
  }
}

test('ready immediately when the mic is already delivering audio', async () => {
  installFakeAudioContext({ silentPolls: 0 })
  const r = await waitForAudio({}, { pollMs: 5 })
  assert.equal(r.ready, true)
})

test('waits through a warm-up period of digital silence', async () => {
  installFakeAudioContext({ silentPolls: 10 })
  const r = await waitForAudio({}, { pollMs: 5, timeoutMs: 2000 })
  assert.equal(r.ready, true)
  assert.ok(r.ms >= 40, `should have waited through the silence (took ${r.ms}ms)`)
})

test('gives up after the timeout if the mic never delivers audio', async () => {
  installFakeAudioContext({ silentPolls: Infinity })
  const r = await waitForAudio({}, { pollMs: 5, timeoutMs: 100 })
  assert.deepEqual([r.ready, r.reason], [false, 'still silent'])
})

test('a suspended context that resumes is inspected normally', async () => {
  installFakeAudioContext({ startState: 'suspended', silentPolls: 3 })
  const r = await waitForAudio({}, { pollMs: 5 })
  assert.equal(r.ready, true)
})

test('a suspended context that never resumes falls back instead of hanging', async () => {
  installFakeAudioContext({ startState: 'suspended', resumeSettles: false })
  const start = performance.now()
  const r = await waitForAudio({}, { pollMs: 5 })
  assert.deepEqual([r.ready, r.reason], [false, 'audio inspection unavailable'])
  assert.ok(performance.now() - start < 1000, 'should fall back quickly')
})
