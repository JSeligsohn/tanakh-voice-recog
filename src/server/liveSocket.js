// The live reader's WebSocket (server only): one connection is one reading.
// Used by api/live.js on Vercel and by the Vite dev server (vite.config.js).
//
// The browser sends:
//   { type: 'start', referenceText, settings, follow?, tester? }   (text)
//   16 kHz mono 16-bit PCM, about 100 ms per message                 (binary)
//   { type: 'goto', wi }     the reader went back to a word         (text)
//   { type: 'stop' }         done reading                           (text)
// and gets back:
//   { type: 'ready' }
//   { type: 'word', wi, status, wrongTries, flags }   a word graded (status
//       'correct' | 'wrong' | 'skipped'; flags as api/phonemes.js sends them)
//   { type: 'current', wi }                            the word being read now
//   { type: 'final', model, flags, heard, seconds, attemptId? }   after stop: the
//       whole recording scored as api/phonemes.js does it (the full report)
//   { type: 'error', error }
// then the server closes the connection.

import { LiveTracker } from './phonemes/live.js'
import { scoreRecording } from './phonemes/scorer.js'
import { saveAttempt, storeConfigured } from './attempts.js'
import { cleanTesterName } from '../utils/tester.js'

const RATE = 16000
const MAX_SECONDS = 180
const MAX_REFERENCE_CHARS = 2000

export function handleLiveSocket(ws, request) {
  let tracker = null, start = null
  let busy = false, stopping = false, closed = false
  const send = msg => { if (!closed && ws.readyState === 1) ws.send(JSON.stringify(msg)) }
  const fail = error => { send({ type: 'error', error }); ws.close() }
  ws.on('close', () => { closed = true })

  // Checks run one at a time; audio that arrives meanwhile waits for the
  // next, and so does going back to a word
  let checking = Promise.resolve(), goTo = null
  function maybeCheck() {
    if (busy || stopping || !tracker) return
    if (goTo !== null) { tracker.goTo(goTo).forEach(send); goTo = null }
    if (!tracker.due) return
    busy = true
    checking = tracker.check()
      .then(events => events.forEach(send))
      .catch(err => console.error('[live] check failed:', err))
      .finally(() => { busy = false; maybeCheck() })
  }

  async function stop() {
    if (stopping || !tracker) return
    stopping = true
    try {
      await checking
      for (const e of await tracker.check({ final: true })) send(e)
      const samples = tracker.recording()
      if (samples.length < 0.2 * RATE) return fail('The recording is empty.')
      const started = performance.now()
      const result = await scoreRecording(samples, start.referenceText, start.settings)
      const reply = { type: 'final', ...result, seconds: +((performance.now() - started) / 1000).toFixed(2) }
      // a tester's reading is saved for the Review page, as api/phonemes.js does
      if (cleanTesterName(start.tester) && storeConfigured()) {
        try {
          reply.attemptId = await saveAttempt({
            tester: start.tester, audioBase64: wavBase64(samples), referenceText: start.referenceText, settings: start.settings,
            provider: 'phonemes-live', model: result.model, phonemes: { flags: result.flags, heard: result.heard },
            live: tracker.state.map(({ status, wrongTries }) => ({ status, wrongTries })),
            userAgent: request?.headers?.['user-agent']?.slice(0, 200) ?? null,
          })
        } catch (err) {
          console.error('[attempts] save failed:', err)
        }
      }
      send(reply)
    } catch (err) {
      console.error('[live] stop failed:', err)
      send({ type: 'error', error: 'The reading could not be scored.' })
    }
    ws.close()
  }

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      if (!tracker || stopping) return
      // copy: the buffer may not be aligned for 16-bit reads
      const bytes = new Uint8Array(data.byteLength)
      bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
      const pcm = new Int16Array(bytes.buffer, 0, bytes.byteLength >> 1)
      const samples = new Float32Array(pcm.length)
      for (let i = 0; i < pcm.length; i++) samples[i] = pcm[i] / 32768
      tracker.push(samples)
      if (tracker.length > MAX_SECONDS * RATE) return stop()
      return maybeCheck()
    }
    let msg
    try { msg = JSON.parse(data.toString()) } catch { return fail('Messages must be JSON.') }
    if (msg?.type === 'start' && !tracker) {
      const { referenceText, settings = {}, follow = true, tester } = msg
      if (typeof referenceText !== 'string' || !referenceText.trim() || referenceText.length > MAX_REFERENCE_CHARS) {
        return fail('Missing or invalid reference text.')
      }
      start = {
        referenceText, tester,
        settings: {
          tradition: settings?.tradition === 'ashkenazic' ? 'ashkenazic' : 'sephardic',
          shevaMode: settings?.shevaMode === 'ignore' ? 'ignore' : 'enforce',
        },
      }
      tracker = new LiveTracker(referenceText, start.settings, { follow: follow !== false })
      send({ type: 'ready' })
      send({ type: 'current', wi: 0 })
    } else if (msg?.type === 'goto' && tracker && !stopping) {
      goTo = Number(msg.wi)
      maybeCheck()
    } else if (msg?.type === 'stop') {
      stop()
    }
  })
}

// 16 kHz samples → base64 mono 16-bit WAV (for the saved attempt)
function wavBase64(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7FFF), 44 + 2 * i)
  }
  return buf.toString('base64')
}
