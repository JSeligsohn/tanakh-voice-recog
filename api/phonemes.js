// The phoneme scorer (Vercel Function; also served by the Vite dev server — see
// vite.config.js): runs the ZIPA phoneme model on a recording and checks each
// sound of the verse against what was heard (src/server/phonemes/scorer.js).
// Nothing leaves the server: no outside API is called.
//
// POST { audio: base64 16-bit WAV (16 kHz mono from the app), referenceText, settings, tester? }
//   → { model, flags, heard, seconds, attemptId? }
//
// A tester's recording is saved with what was flagged, for the Review page
// (src/server/attempts.js), as api/openai-audio.js does for transcriptions.

import { readWav, to16k, scoreRecording } from '../src/server/phonemes/scorer.js'
import { saveAttempt, storeConfigured } from '../src/server/attempts.js'
import { cleanTesterName } from '../src/utils/tester.js'

const MAX_AUDIO_BASE64 = 4_400_000   // Vercel caps request bodies at 4.5 MB (and the app sends no more)
const MAX_REFERENCE_CHARS = 2000
const MAX_SECONDS = 90

const fail = (status, error) => Response.json({ error }, { status })

export default {
  async fetch(request) {
    if (request.method !== 'POST') return fail(405, 'Use POST.')

    let body
    try { body = await request.json() } catch { return fail(400, 'Request body must be JSON.') }
    const { audio, referenceText, settings = {}, tester } = body ?? {}

    if (typeof audio !== 'string' || audio.length === 0) return fail(400, 'Missing audio.')
    if (audio.length > MAX_AUDIO_BASE64) return fail(413, 'Recording is too long.')
    if (typeof referenceText !== 'string' || !referenceText.trim() || referenceText.length > MAX_REFERENCE_CHARS) {
      return fail(400, 'Missing or invalid reference text.')
    }
    const safeSettings = {
      tradition: settings?.tradition === 'ashkenazic' ? 'ashkenazic' : 'sephardic',
      shevaMode: settings?.shevaMode === 'ignore' ? 'ignore' : 'enforce',
    }

    let samples
    try {
      const { samples: raw, rate } = readWav(Buffer.from(audio, 'base64'))
      samples = to16k(raw, rate)
    } catch (err) {
      return fail(400, `Couldn't read the recording: ${err.message}`)
    }
    if (samples.length > MAX_SECONDS * 16000) return fail(413, 'Recording is too long.')
    if (samples.length < 0.2 * 16000) return fail(400, 'The recording is empty.')

    const started = performance.now()
    const result = await scoreRecording(samples, referenceText, safeSettings)
    const reply = { ...result, seconds: +((performance.now() - started) / 1000).toFixed(2) }

    // Save a tester's attempt for review. A failed save never fails the reading.
    let attemptId = null
    if (cleanTesterName(tester) && storeConfigured()) {
      try {
        attemptId = await saveAttempt({
          tester, audioBase64: audio, referenceText, settings: safeSettings,
          provider: 'phonemes', model: result.model, phonemes: { flags: result.flags, heard: result.heard },
          userAgent: request.headers.get('user-agent')?.slice(0, 200) ?? null,
        })
      } catch (err) {
        console.error('[attempts] save failed:', err)
      }
    }
    return Response.json(attemptId ? { ...reply, attemptId } : reply)
  },
}
