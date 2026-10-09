// Hybrid pronunciation assessment:
// 1. OpenAI's gpt-audio model produces ONLY a phonetic transcription per word
// 2. Our deterministic hebrewScoring.js applies rules, generates notes, scores
//
// This bypasses the LLM's strong dialect priors, which interfere with consistent
// rule enforcement (e.g. Ashkenazic tav/sav). The LLM only does what it's
// genuinely good at — listening and transliterating sounds.

import { scoreWords } from '../utils/hebrewScoring.js'
import { alignByDP, tokenizePhonetic, applyAlignmentNotes } from '../utils/phoneticAlignment.js'
import { callOpenAIAudio } from './openaiProxy.js'

// Audio → phonetic transcription only, with the production prompt. Shared by
// assessment and the dev Transcription check page, so the check measures
// exactly what students get. Returns { transcription, model, usage, cost }.
export async function transcribeAudio(audioBlob, referenceText) {
  const { content, model, usage } = await callOpenAIAudio('transcribe', audioBlob, referenceText)
  const cost = logUsage(usage)

  const jsonStart = content.indexOf('{')
  const jsonEnd = content.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error('OpenAI returned no JSON object: ' + content.slice(0, 200))
  }
  const cleaned = content.slice(jsonStart, jsonEnd + 1)

  let parsed
  try { parsed = JSON.parse(cleaned) }
  catch { throw new Error('OpenAI returned malformed JSON: ' + cleaned.slice(0, 200)) }

  return { transcription: parsed.transcription ?? '', model, usage, cost }
}

export async function assessWithOpenAIRules(audioBlob, referenceText, settings = {}) {
  const { transcription, model, usage } = await transcribeAudio(audioBlob, referenceText)

  const referenceWords = referenceText.split(/\s+/).filter(Boolean)

  // Tokenize the model's transcription, then let DP alignment figure out which
  // tokens correspond to which reference words.
  const flatTokens = tokenizePhonetic(transcription)
  const alignment = flatTokens.length > 0
    ? alignByDP(referenceWords, flatTokens, settings)
    : { heardByRef: referenceWords.map(() => '') }
  const { heardByRef } = alignment

  const scored = applyAlignmentNotes(scoreWords(referenceWords, heardByRef, settings), alignment)

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
      breakdown: s.breakdown,
    })),
  }))

  const rawSegment = {
    provider: 'openai-rules',
    model,
    transcription,
    feedback,
    usage,
    settings,
    perWordHeard: heardByRef,
    expectedPhonetic: scored.map(w => ({ word: w.word, expected: w.expectedPhonetic, heard: w.phoneticHeard })),
    flaggedSyllables,
  }

  return { words, scores, rawSegment }
}


const PRICE_PER_M = {
  textInput: 2.50,
  textInputCached: 1.25,
  audioInput: 40.00,
  textOutput: 10.00,
}

// Logs token usage and returns the estimated cost in dollars (0 if unknown).
function logUsage(usage) {
  if (!usage) return 0
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
  return cost
}
