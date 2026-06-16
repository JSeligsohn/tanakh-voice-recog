// Hybrid pronunciation assessment:
// 1. OpenAI's gpt-audio model produces ONLY a phonetic transcription per word
// 2. Our deterministic hebrewScoring.js applies rules, generates notes, scores
//
// This bypasses the LLM's strong dialect priors, which interfere with consistent
// rule enforcement (e.g. Ashkenazic tav/sav). The LLM only does what it's
// genuinely good at — listening and transliterating sounds.

import { scoreWords } from '../utils/hebrewScoring.js'
import { alignByDP, tokenizePhonetic } from '../utils/phoneticAlignment.js'

const MODEL = 'gpt-audio-1.5'

const TRANSCRIPTION_PROMPT = `You are a phonetic transcription assistant for Hebrew. Listen to the audio of someone reading a Hebrew verse aloud and transcribe what you hear phonetically into Latin letters.

CRITICAL RULES:
- Transcribe what was actually HEARD, not what the word "should" sound like.
- Do NOT auto-correct mispronunciations. If the student says "yishrael" for ישראל, write "yishrael" — NOT "yisrael". If they say "hazot" for הַזֹּאת, write "hazot" — NOT "hazos". Resist the urge to normalize.
- Use spaces between words as you heard them. If the student blurred two words, still try to separate them at the natural word boundary.
- If a word or section is missing because the student skipped it or stopped early, just leave it out of the transcription — do NOT invent words you didn't actually hear.
- Use simple Latin letters only. Use "sh" for shin, "s" for sin, "ch" for guttural ח/כ, "ts" for tzadi. Use single vowels (a, e, i, o, u) or common digraphs (ay, oy, ey).

Output ONLY valid JSON in this exact format (no markdown, no preamble):
{
  "transcription": "phonetic transcription of the recording, words separated by spaces"
}`

export async function assessWithOpenAIRules(audioBlob, referenceText, settings = {}) {
  const key = import.meta.env.VITE_OPENAI_API_KEY
  if (!key) throw new Error('OpenAI API key not configured. Set VITE_OPENAI_API_KEY in your environment.')

  const wavBlob = await blobToWav(audioBlob)
  const base64 = await blobToBase64(wavBlob)

  const userMessage = `Reference text (one word per whitespace-separated token; treat maqef-joined sequences as a single token):\n${referenceText}\n\nThe student's recording is attached.`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      modalities: ['text'],
      messages: [
        { role: 'system', content: TRANSCRIPTION_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userMessage },
            { type: 'input_audio', input_audio: { data: base64, format: 'wav' } },
          ],
        },
      ],
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenAI API error (${response.status}): ${errText}`)
  }

  const data = await response.json()
  logUsage(data.usage)
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned no content. Full response: ' + JSON.stringify(data).slice(0, 300))

  const jsonStart = content.indexOf('{')
  const jsonEnd = content.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error('OpenAI returned no JSON object: ' + content.slice(0, 200))
  }
  const cleaned = content.slice(jsonStart, jsonEnd + 1)

  let parsed
  try { parsed = JSON.parse(cleaned) }
  catch { throw new Error('OpenAI returned malformed JSON: ' + cleaned.slice(0, 200)) }

  const referenceWords = referenceText.split(/\s+/).filter(Boolean)

  // Tokenize the model's transcription, then let DP alignment figure out which
  // tokens correspond to which reference words.
  const flatTokens = tokenizePhonetic(parsed.transcription ?? '')
  const alignResult = flatTokens.length > 0
    ? alignByDP(referenceWords, flatTokens, settings)
    : { heardByRef: referenceWords.map(() => ''), stutters: referenceWords.map(() => false) }
  const { heardByRef, stutters } = alignResult

  const scored = scoreWords(referenceWords, heardByRef, settings).map((w, i) => {
    if (!stutters[i] || w.errorType === 'Omission') return w
    const stutterNote = 'Stuttered/repeated this word — said multiple times before moving on.'
    const syllables = w.syllables.length > 0
      ? [{ ...w.syllables[0], note: w.syllables[0].note ? `${w.syllables[0].note} ${stutterNote}` : stutterNote }, ...w.syllables.slice(1)]
      : w.syllables
    return { ...w, syllables }
  })

  const nonOmitted = scored.filter(w => w.errorType !== 'Omission')
  const accuracy = nonOmitted.length > 0
    ? Math.round(nonOmitted.reduce((s, w) => s + w.score, 0) / nonOmitted.length)
    : 0
  const completeness = referenceWords.length > 0
    ? Math.round((nonOmitted.length / referenceWords.length) * 100)
    : 0
  const pronunciation = Math.round(accuracy * 0.75 + completeness * 0.25)

  const scores = { pronunciation, accuracy, fluency: accuracy, completeness }

  const flaggedSyllables = scored.flatMap(w =>
    w.syllables.filter(s => s.note).map(s => ({ word: w.word, syllable: s.phoneme, note: s.note }))
  )
  const feedback = scored.every(w => w.errorType === 'None')
    ? 'Great reading — clear and accurate throughout.'
    : flaggedSyllables.length > 0
      ? `Found ${flaggedSyllables.length} item${flaggedSyllables.length === 1 ? '' : 's'} to work on.`
      : 'Some words could use work — see word-by-word details.'

  const words = scored.map(w => ({
    word: w.word,
    score: w.score,
    errorType: w.errorType,
    phoneticHeard: w.phoneticHeard,
    phonemes: w.syllables.map(s => ({
      phoneme: s.phoneme,
      accuracyScore: s.accuracyScore,
      note: s.note,
    })),
  }))

  const rawSegment = {
    provider: 'openai-rules',
    model: data.model ?? MODEL,
    transcription: parsed.transcription,
    feedback,
    usage: data.usage,
    settings,
    perWordHeard: heardByRef,
    expectedPhonetic: scored.map(w => ({ word: w.word, expected: w.expectedPhonetic, heard: w.phoneticHeard })),
    flaggedSyllables,
  }

  return { words, scores, rawSegment }
}

// ── Audio conversion helpers (duplicated from openaiAssessment.js for isolation) ──

async function blobToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  audioCtx.close()
  return encodeWav(audioBuffer)
}

function encodeWav(audioBuffer) {
  const numChannels = 1
  const sampleRate = audioBuffer.sampleRate
  const samples = audioBuffer.getChannelData(0)
  const dataSize = samples.length * 2

  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const PRICE_PER_M = {
  textInput: 2.50,
  textInputCached: 1.25,
  audioInput: 40.00,
  textOutput: 10.00,
}

function logUsage(usage) {
  if (!usage) return
  const promptDetails = usage.prompt_tokens_details ?? {}
  const cached = promptDetails.cached_tokens ?? 0
  const audio = promptDetails.audio_tokens ?? 0
  const text = (usage.prompt_tokens ?? 0) - audio
  const output = usage.completion_tokens ?? 0
  const textUncached = Math.max(0, text - cached)

  const cost =
    (textUncached / 1_000_000) * PRICE_PER_M.textInput +
    (cached       / 1_000_000) * PRICE_PER_M.textInputCached +
    (audio        / 1_000_000) * PRICE_PER_M.audioInput +
    (output       / 1_000_000) * PRICE_PER_M.textOutput

  console.log(
    `[openai+rules usage] text: ${text} (${cached} cached) │ audio in: ${audio} │ output: ${output} │ ≈ $${cost.toFixed(4)}`
  )
}
