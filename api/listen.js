// Listen readings from ElevenLabs (Vercel Function; also served by the Vite dev
// server — see vite.config.js). A verse is read the first time someone asks for
// it and kept in Vercel Blob (listen/…mp3, private), so each verse costs
// ElevenLabs credits once; nothing is made ahead of time.
//
// GET ?pasuk=<verse id>&tradition=ashkenazic|sephardic → audio/mpeg
//
// Only verses in src/data/psukim.js can be read, never free text, so the key
// (ELEVENLABS_API_KEY) can't be used for anything else and the spend is capped
// by the verse list. The verse goes in as IPA (ipa in hebrewRomanize.js): every
// sound, the trope stress and American vowels are spelled out, where given
// Hebrew script the model reads Modern Israeli Hebrew.
//
// The model sometimes slips (a "g" put between two vowels), and differently
// each time. So a new reading is checked the way a student's is: transcribed
// (api/openai-audio.js) and graded. If the grader marks a word, the verse is
// read once more and the reading with fewer marked words is kept. The grader
// is noisy, so a marked word isn't always a real slip: listen/…json keeps what
// it marked, to listen to.
//
// A clip's name has a hash of everything that shapes it (IPA, voice, model),
// so changing any of them makes a new reading on the next request.

import { createHash } from 'node:crypto'
import { get, put } from '@vercel/blob'
import { psukim } from '../src/data/psukim.js'
import { ipa } from '../src/utils/hebrewRomanize.js'
import { parseTranscription, gradeTranscription } from '../src/services/openaiRulesAssessment.js'
import openaiAudio from './openai-audio.js'

const MODEL = 'eleven_v4'
const DEFAULT_VOICE = 'nPczCjzI2devNBz1zQrb'   // Brian: calm American narrator (stock voice)
const KAMATZ = 'uh'                             // Ashkenazi kamatz: "Avrum", "huh-UH-retz"
const MAX_READINGS = 2
const PREFIX = 'listen/'

const fail = (status, error) => Response.json({ error }, { status })

// What ElevenLabs is sent for a verse, and the clip's name in Blob
function reading(pasuk, tradition) {
  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE
  const text = ipa(pasuk.trope, { tradition, kamatz: KAMATZ })
  const request = { text, model_id: MODEL, language_code: 'en' }
  const hash = createHash('sha256').update(JSON.stringify({ voice, ...request })).digest('hex').slice(0, 12)
  return { voice, request, name: `${PREFIX}${pasuk.id}-${tradition}-${hash}` }
}

async function speak({ voice, request }) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(`ElevenLabs error (${response.status}): ${(await response.text()).slice(0, 300)}`)
  return { audio: Buffer.from(await response.arrayBuffer()), characters: Number(response.headers.get('character-cost')) || null }
}

// The words the grader marks in a reading, as "word: heard …"; null if it
// couldn't be checked (then the reading is kept as it is)
async function check(audio, pasuk, tradition) {
  const settings = { tradition, shevaMode: 'enforce' }
  try {
    const response = await openaiAudio.fetch(new Request('http://localhost/api/openai-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'transcribe', audio: audio.toString('base64'), format: 'mp3', referenceText: pasuk.text, settings }),
    }))
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    const { words } = gradeTranscription(parseTranscription(data.content), pasuk.text, settings)
    return words.filter(w => w.errorType !== 'None').map(w => `${w.word}: heard "${w.phoneticHeard || '—'}"`)
  } catch (err) {
    console.error('[listen] check failed:', err)
    return null
  }
}

async function generate(clip, pasuk, tradition) {
  const readings = []
  while (readings.length < MAX_READINGS) {
    const { audio, characters } = await speak(clip)
    const marked = await check(audio, pasuk, tradition)
    readings.push({ audio, characters, marked })
    if (!marked?.length) break
  }
  const best = readings.reduce((a, b) => ((b.marked?.length ?? 0) < (a.marked?.length ?? 0) ? b : a))
  const details = {
    pasuk: pasuk.id, tradition, voice: clip.voice, ...clip.request,
    readings: readings.map(r => ({ characters: r.characters, marked: r.marked })),
    kept: readings.indexOf(best),
    createdAt: new Date().toISOString(),
  }
  console.log(`[listen] read ${clip.name}: ${readings.length} reading(s), kept #${details.kept + 1}, marked: ${best.marked?.join(' | ') || 'none'}`)
  await Promise.all([
    put(`${clip.name}.mp3`, best.audio, { access: 'private', contentType: 'audio/mpeg', allowOverwrite: true }),
    put(`${clip.name}.json`, JSON.stringify(details, null, 2), { access: 'private', contentType: 'application/json', allowOverwrite: true }),
  ])
  return best.audio
}

// Readings in progress on this instance, so a double tap doesn't pay twice
const inProgress = new Map()

export default {
  async fetch(request) {
    if (request.method !== 'GET') return fail(405, 'Use GET.')
    if (!process.env.ELEVENLABS_API_KEY || !process.env.BLOB_READ_WRITE_TOKEN) {
      return fail(500, 'Listen is not set up on the server (ELEVENLABS_API_KEY and the Blob store).')
    }
    const params = new URL(request.url).searchParams
    const pasuk = psukim.find(p => p.id === params.get('pasuk'))
    const tradition = params.get('tradition')
    if (!pasuk) return fail(400, 'Unknown verse.')
    if (!['ashkenazic', 'sephardic'].includes(tradition)) return fail(400, 'Unknown tradition.')

    const clip = reading(pasuk, tradition)
    const headers = { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600' }

    const saved = await get(`${clip.name}.mp3`, { access: 'private' })
    if (saved?.stream) return new Response(saved.stream, { headers })

    let job = inProgress.get(clip.name)
    if (!job) {
      job = generate(clip, pasuk, tradition).finally(() => inProgress.delete(clip.name))
      inProgress.set(clip.name, job)
    }
    try {
      return new Response(await job, { headers })
    } catch (err) {
      console.error('[listen]', err)
      return fail(502, err.message)
    }
  },
}
