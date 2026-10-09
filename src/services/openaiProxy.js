// Browser side of the OpenAI audio proxy: sends a recording to our server
// (api/openai-audio.js), which holds the API key and builds the prompt.
// task: 'transcribe' (OpenAI Rules) or 'assess' (OpenAI LLM).
// Returns { content, model, usage }, where content is the model's raw reply.

import { blobToWavBase64 } from '../utils/wav.js'

const MAX_AUDIO_BASE64 = 4_400_000 // keep in step with the server limit

export async function callOpenAIAudio(task, audioBlob, referenceText, settings = {}) {
  const audio = await blobToWavBase64(audioBlob)
  if (audio.length > MAX_AUDIO_BASE64) {
    throw new Error('This recording is too long to send (over about a minute). Try reading a shorter section.')
  }

  const response = await fetch('/api/openai-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, audio, referenceText, settings }),
  })
  let data = null
  try { data = await response.json() } catch { /* non-JSON error page */ }
  if (!response.ok) throw new Error(data?.error ?? `Server error (${response.status}).`)
  if (!data?.content) throw new Error('OpenAI returned no content.')
  return data
}
