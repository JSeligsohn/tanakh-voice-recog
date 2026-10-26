// Server-side proxy for the OpenAI audio model (Vercel Function; also served by
// the Vite dev server — see vite.config.js). The API key stays on the server
// (OPENAI_API_KEY). The browser sends only the recording, the verse text, and
// grading settings; prompts are built here from fixed templates, so this
// endpoint can't be used to send OpenAI arbitrary instructions.
//
// POST { task: 'transcribe' | 'assess', audio: base64 WAV (or MP3 with format: 'mp3'), referenceText, settings, tester? }
//   → { content, model, usage, attemptId? }   (content is the model's raw reply)
//
// A tester's transcription (tester set: see src/utils/tester.js) is saved with
// its recording for the Review page (src/server/attempts.js); attemptId is its
// id, for a review link (/?review=<id>).

import { TRANSCRIPTION_PROMPT, transcriptionUserMessage } from '../src/services/prompts/transcriptionPrompt.js'
import { buildSystemPrompt, assessmentUserMessage } from '../src/services/prompts/assessmentPrompt.js'
import { saveAttempt, storeConfigured } from '../src/server/attempts.js'
import { cleanTesterName } from '../src/utils/tester.js'

const MODEL = 'gpt-audio-1.5'
const MAX_AUDIO_BASE64 = 4_400_000   // Vercel caps request bodies at 4.5 MB
const MAX_REFERENCE_CHARS = 2000

const TASKS = {
  // OpenAI (Rules): transcription only; our rules engine grades
  transcribe: { temperature: 0.1, system: () => TRANSCRIPTION_PROMPT, user: transcriptionUserMessage },
  // OpenAI (LLM): the model transcribes and grades
  assess: { temperature: 0.2, system: settings => buildSystemPrompt(settings), user: assessmentUserMessage },
}

const fail = (status, error) => Response.json({ error }, { status })

export default {
  async fetch(request) {
    if (request.method !== 'POST') return fail(405, 'Use POST.')
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return fail(500, 'OPENAI_API_KEY is not set on the server.')

    let body
    try { body = await request.json() } catch { return fail(400, 'Request body must be JSON.') }
    const { task, audio, format, referenceText, settings = {}, tester } = body ?? {}

    const spec = TASKS[task]
    if (!spec) return fail(400, 'Unknown task.')
    if (typeof audio !== 'string' || audio.length === 0) return fail(400, 'Missing audio.')
    if (audio.length > MAX_AUDIO_BASE64) return fail(413, 'Recording is too long.')
    if (typeof referenceText !== 'string' || !referenceText.trim() || referenceText.length > MAX_REFERENCE_CHARS) {
      return fail(400, 'Missing or invalid reference text.')
    }
    // Only known setting values reach the prompt builder
    const safeSettings = {
      tradition: settings?.tradition === 'ashkenazic' ? 'ashkenazic' : 'sephardic',
      shevaMode: settings?.shevaMode === 'ignore' ? 'ignore' : 'enforce',
    }

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        modalities: ['text'],
        messages: [
          { role: 'system', content: spec.system(safeSettings) },
          {
            role: 'user',
            content: [
              { type: 'text', text: spec.user(referenceText) },
              { type: 'input_audio', input_audio: { data: audio, format: format === 'mp3' ? 'mp3' : 'wav' } },
            ],
          },
        ],
        temperature: spec.temperature,
      }),
    })

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 500)
      return fail(502, `OpenAI API error (${upstream.status}): ${detail}`)
    }
    const data = await upstream.json()
    const reply = {
      content: data.choices?.[0]?.message?.content ?? '',
      model: data.model ?? MODEL,
      usage: data.usage ?? null,
    }

    // Save a tester's attempt for review. A failed save never fails the reading.
    let attemptId = null
    if (task === 'transcribe' && cleanTesterName(tester) && storeConfigured()) {
      try {
        attemptId = await saveAttempt({
          tester, audioBase64: audio, referenceText, settings: safeSettings, ...reply,
          userAgent: request.headers.get('user-agent')?.slice(0, 200) ?? null,
        })
      } catch (err) {
        console.error('[attempts] save failed:', err)
      }
    }
    return Response.json(attemptId ? { ...reply, attemptId } : reply)
  },
}
