// Server-side OpenAI text-to-speech for a Hebrew verse, for the dev-only Voice
// lab (served by the Vite dev server — see vite.config.js). Kept out of api/
// so it isn't deployed: the app's Listen plays recordings made ahead of time
// (scripts/generate-listen-audio.mjs). The API key stays on the server
// (OPENAI_API_KEY). The browser names a reading variant and a voice; the
// instructions come from our templates (src/services/prompts/speechPrompts.js),
// and only pointed Hebrew text is accepted, so this can't be used as a
// general-purpose speech endpoint.
//
// POST { text, variant, voice } → audio/mpeg
//   headers: X-Speech-Model, and for gpt-audio X-Speech-Transcript (URI-encoded
//   text of what it read; often cut short even when the audio is complete)

import { SPEECH_VARIANTS, SPEECH_VOICES, buildSpeechRequest } from '../src/services/prompts/speechPrompts.js'

const MAX_TEXT_CHARS = 1000
// Hebrew letters and points, maqef, sof pasuq, spaces, and light punctuation
const HEBREW_ONLY = /^[\u0591-\u05F4\s.,:;]+$/

const fail = (status, error) => Response.json({ error }, { status })

export default {
  async fetch(request) {
    if (request.method !== 'POST') return fail(405, 'Use POST.')
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return fail(500, 'OPENAI_API_KEY is not set on the server.')

    let body
    try { body = await request.json() } catch { return fail(400, 'Request body must be JSON.') }
    const { text, variant: variantId, voice } = body ?? {}

    const variant = SPEECH_VARIANTS.find(v => v.id === variantId)
    if (!variant) return fail(400, 'Unknown variant.')
    if (!SPEECH_VOICES.includes(voice)) return fail(400, 'Unknown voice.')
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT_CHARS || !HEBREW_ONLY.test(text)) {
      return fail(400, 'Text must be pointed Hebrew (up to 1000 characters).')
    }

    const req = buildSpeechRequest(variant, text, voice)
    const upstream = await fetch(req.url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 500)
      return fail(502, `OpenAI API error (${upstream.status}): ${detail}`)
    }

    const headers = { 'Content-Type': 'audio/mpeg', 'X-Speech-Model': req.model, 'Cache-Control': 'no-store' }
    if (variant.engine === 'tts') {
      return new Response(await upstream.arrayBuffer(), { headers })
    }
    const data = await upstream.json()
    const audio = data.choices?.[0]?.message?.audio
    if (!audio?.data) return fail(502, 'OpenAI returned no audio.')
    headers['X-Speech-Transcript'] = encodeURIComponent(audio.transcript ?? '')
    return new Response(Buffer.from(audio.data, 'base64'), { headers })
  },
}
