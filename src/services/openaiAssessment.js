// Pronunciation assessment via OpenAI's audio-capable chat completions model.
// Designed for American students reading Torah with Ashkenazic pronunciation —
// the LLM is prompted with the dialect rules and asked for syllable-level scoring.
// The prompt is built on the server (see prompts/assessmentPrompt.js).

import { callOpenAIAudio } from './openaiProxy.js'

export async function assessWithOpenAI(audioBlob, referenceText, settings = {}) {
  const { content, model, usage } = await callOpenAIAudio('assess', audioBlob, referenceText, settings)
  logUsage(usage)

  // The model sometimes adds preamble ("Let me listen...") or wraps in code fences.
  // Extract the JSON object by scanning for the outermost {...}.
  const jsonStart = content.indexOf('{')
  const jsonEnd = content.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error('OpenAI returned no JSON object. Response was: ' + content.slice(0, 200))
  }
  const cleaned = content.slice(jsonStart, jsonEnd + 1)

  let parsed
  try { parsed = JSON.parse(cleaned) }
  catch { throw new Error('OpenAI returned malformed JSON: ' + cleaned.slice(0, 200)) }

  // Map to the internal shape Azure produces, so the UI doesn't need to branch.
  // Syllables map to "phonemes" since they fill the same role in the breakdown panel.
  const words = (parsed.words ?? []).map(w => ({
    word: w.word,
    score: w.score ?? 0,
    errorType: w.errorType ?? 'None',
    phoneticHeard: w.phonetic_heard ?? '',
    phonemes: (w.syllables ?? []).map(s => ({
      phoneme: s.syllable,
      accuracyScore: s.score ?? 0,
      note: s.note ?? '',
    })),
  }))

  const scores = {
    pronunciation: parsed.scores?.pronunciation ?? 0,
    accuracy:      parsed.scores?.accuracy      ?? 0,
    fluency:       parsed.scores?.fluency       ?? 0,
    completeness:  parsed.scores?.completeness  ?? 0,
  }

  const rawSegment = {
    provider: 'openai',
    model,
    transcription: parsed.transcription,
    feedback: parsed.feedback,
    usage,
    raw: parsed,
  }

  return { words, scores, rawSegment }
}

// Approximate gpt-audio-1.5 pricing (per 1M tokens, USD) — check console for actuals
// Update these if OpenAI changes pricing.
const PRICE_PER_M = {
  textInput: 2.50,
  textInputCached: 1.25,  // 50% discount on cached prompt tokens
  audioInput: 40.00,      // audio is the dominant cost
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
    `[openai usage] text: ${text} (${cached} cached, ${(cached / text * 100 || 0).toFixed(0)}% hit) │ audio in: ${audio} │ output: ${output} │ ≈ $${cost.toFixed(4)}`
  )
  console.log('[openai usage] raw object:', usage)
}

