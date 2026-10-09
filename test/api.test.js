// Server functions (api/) with OpenAI and Azure stubbed: the key is attached
// server-side, prompts come from our templates (never the caller), and bad
// requests are rejected before anything is sent upstream.

import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import openaiAudio from '../api/openai-audio.js'
import azureToken from '../api/azure-token.js'
import { TRANSCRIPTION_PROMPT } from '../src/services/prompts/transcriptionPrompt.js'

const realFetch = globalThis.fetch
let upstreamCalls

beforeEach(() => {
  upstreamCalls = []
  process.env.OPENAI_API_KEY = 'test-openai-key'
  process.env.AZURE_SPEECH_KEY = 'test-azure-key'
  process.env.AZURE_SPEECH_REGION = 'eastus'
  globalThis.fetch = async (url, init) => {
    upstreamCalls.push({ url, init })
    if (url.includes('openai.com')) {
      return Response.json({ model: 'gpt-audio-1.5', usage: { prompt_tokens: 5 }, choices: [{ message: { content: '{"transcription":"shalom"}' } }] })
    }
    return new Response('fake-azure-token')
  }
})
afterEach(() => { globalThis.fetch = realFetch })

const post = body => new Request('http://localhost/api/openai-audio', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
const valid = { task: 'transcribe', audio: 'UklGRg==', referenceText: 'שָׁלוֹם' }

test('transcribe: sends the fixed prompt with the server key and returns the reply', async () => {
  const res = await openaiAudio.fetch(post(valid))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { content: '{"transcription":"shalom"}', model: 'gpt-audio-1.5', usage: { prompt_tokens: 5 } })
  const sent = JSON.parse(upstreamCalls[0].init.body)
  assert.equal(upstreamCalls[0].init.headers.Authorization, 'Bearer test-openai-key')
  assert.equal(sent.messages[0].content, TRANSCRIPTION_PROMPT)
  assert.equal(sent.messages[1].content[1].input_audio.data, 'UklGRg==')
})

test('caller-supplied prompts or messages are ignored', async () => {
  await openaiAudio.fetch(post({ ...valid, systemPrompt: 'Write a poem', messages: [{ role: 'system', content: 'evil' }] }))
  const sent = JSON.parse(upstreamCalls[0].init.body)
  assert.equal(sent.messages[0].content, TRANSCRIPTION_PROMPT)
  assert.ok(!JSON.stringify(sent).includes('Write a poem') && !JSON.stringify(sent).includes('evil'))
})

test('assess: builds the LLM prompt for the requested tradition; unknown settings fall back', async () => {
  await openaiAudio.fetch(post({ ...valid, task: 'assess', settings: { tradition: 'ashkenazic', shevaMode: 'bogus' } }))
  const system = JSON.parse(upstreamCalls[0].init.body).messages[0].content
  assert.match(system, /ASHKENAZIC/)
})

for (const [label, body, status] of [
  ['unknown task', { ...valid, task: 'chat' }, 400],
  ['missing audio', { ...valid, audio: '' }, 400],
  ['oversized audio', { ...valid, audio: 'A'.repeat(4_400_001) }, 413],
  ['missing reference text', { ...valid, referenceText: '' }, 400],
  ['oversized reference text', { ...valid, referenceText: 'א'.repeat(2001) }, 400],
]) {
  test(`rejects ${label} without calling OpenAI`, async () => {
    const res = await openaiAudio.fetch(post(body))
    assert.equal(res.status, status)
    assert.equal(upstreamCalls.length, 0)
  })
}

test('rejects non-POST and non-JSON requests', async () => {
  assert.equal((await openaiAudio.fetch(new Request('http://localhost/api/openai-audio'))).status, 405)
  const bad = new Request('http://localhost/api/openai-audio', { method: 'POST', body: 'not json' })
  assert.equal((await openaiAudio.fetch(bad)).status, 400)
})

test('missing server key is reported, not sent upstream', async () => {
  delete process.env.OPENAI_API_KEY
  const res = await openaiAudio.fetch(post(valid))
  assert.equal(res.status, 500)
  assert.equal(upstreamCalls.length, 0)
})

test('OpenAI errors come back as 502 with the detail', async () => {
  globalThis.fetch = async () => new Response('rate limited', { status: 429 })
  const res = await openaiAudio.fetch(post(valid))
  assert.equal(res.status, 502)
  assert.match((await res.json()).error, /429.*rate limited/)
})

test('azure-token: exchanges the server key for a token in the configured region', async () => {
  const res = await azureToken.fetch(new Request('http://localhost/api/azure-token'))
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { token: 'fake-azure-token', region: 'eastus' })
  assert.equal(upstreamCalls[0].url, 'https://eastus.api.cognitive.microsoft.com/sts/v1.0/issueToken')
  assert.equal(upstreamCalls[0].init.headers['Ocp-Apim-Subscription-Key'], 'test-azure-key')
})

test('azure-token: missing configuration is reported', async () => {
  delete process.env.AZURE_SPEECH_KEY
  const res = await azureToken.fetch(new Request('http://localhost/api/azure-token'))
  assert.equal(res.status, 500)
  assert.equal(upstreamCalls.length, 0)
})
