// Records the Listen reading of each verse in src/data/psukim.js, once per
// tradition, with the setup chosen in the Voice lab (LISTEN_READING: gpt-audio
// with the Hebrew and an English-letter guide, cedar voice).
//
// gpt-audio sometimes drops, repeats or swaps a word, so each reading is
// transcribed back and compared with the verse; a reading that doesn't match
// is made again (up to MAX_ATTEMPTS). This catches wrong, missing and extra
// words, not a wrong sound ("samesh" for חָמֵשׁ): the transcriber "corrects"
// a familiar verse. So listen to new readings before shipping.
//
// --grade grades the saved readings exactly as a student's reading is graded
// (OpenAI Rules) and lists the words it marks wrong, as suspects to listen to.
// It's too noisy to redo readings by: it also missed "samesh", and it marks
// some correct readings wrong. Needs macOS (afconvert).
//
// Writes public/audio/listen/<verse id>-<tradition>.mp3 and lists them in
// src/data/listenAudio.json. Verses already recorded are skipped.
//
//   node scripts/generate-listen-audio.mjs                 # record what's missing
//   node scripts/generate-listen-audio.mjs gen-12-1 --force  # redo one verse
//   node scripts/generate-listen-audio.mjs gen-12-4 --force --tradition ashkenazic
//   node scripts/generate-listen-audio.mjs --grade          # list suspect words in the saved readings

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import openaiAudio from '../api/openai-audio.js'
import { parseTranscription, gradeTranscription } from '../src/services/openaiRulesAssessment.js'
import { psukim } from '../src/data/psukim.js'
import { SPEECH_VARIANTS, LISTEN_READING, buildSpeechRequest } from '../src/services/prompts/speechPrompts.js'

const OUT_DIR = 'public/audio/listen'
const INDEX = 'src/data/listenAudio.json'
const MAX_ATTEMPTS = 4

try { process.loadEnvFile() } catch { /* no .env: use the environment */ }
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error('OPENAI_API_KEY is not set (in .env or the environment).')

const args = process.argv.slice(2)
const force = args.includes('--force')
const gradeOnly = args.includes('--grade')
const traditionArg = args.includes('--tradition') ? args[args.indexOf('--tradition') + 1] : null
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--tradition')

const index = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : {}
fs.mkdirSync(OUT_DIR, { recursive: true })

// The verse's letters, to compare with a transcript, ignoring what a transcript
// writes differently: points, spacing and maqef (it joins and splits maqef words
// either way), punctuation, vowel letters (ו, י), final forms, and how it writes
// Hashem (ה', יהוה) or Elokim (אלוקים).
function letters(text) {
  return text
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/(^|[^א-ת])ה'/g, '$1השם')
    .replace(/יהוה/g, 'השם')
    .replace(/אלוק|אלק/g, 'אלה')
    .replace(/[^א-ת]/g, '')
    .replace(/[וי]/g, '')
    .replace(/[ךםןףץ]/g, c => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[c])
}

async function openai(path, init) {
  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    ...init, headers: { Authorization: `Bearer ${apiKey}`, ...init.headers },
  })
  if (!response.ok) throw new Error(`OpenAI ${path} ${response.status}: ${(await response.text()).slice(0, 300)}`)
  return response.json()
}

async function read(variant, pasuk) {
  const req = buildSpeechRequest(variant, pasuk.trope, LISTEN_READING.voice)
  const data = await openai('chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body),
  })
  const audio = data.choices?.[0]?.message?.audio?.data
  if (!audio) throw new Error('OpenAI returned no audio.')
  return { audio: Buffer.from(audio, 'base64'), model: req.model }
}

async function transcribe(audio) {
  const form = new FormData()
  form.append('model', 'gpt-4o-transcribe')
  form.append('language', 'he')
  form.append('file', new Blob([audio], { type: 'audio/mpeg' }), 'reading.mp3')
  return (await openai('audio/transcriptions', { method: 'POST', body: form })).text
}

// Words the app's grader marks wrong in a reading, as "word: heard (note)"
async function grade(audio, pasuk, tradition) {
  // The app sends 16-bit mono WAV; convert the mp3 the same way
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'listen-'))
  fs.writeFileSync(path.join(dir, 'in.mp3'), audio)
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16', '-c', '1', path.join(dir, 'in.mp3'), path.join(dir, 'out.wav')])
  const wav = fs.readFileSync(path.join(dir, 'out.wav')).toString('base64')
  fs.rmSync(dir, { recursive: true })

  const settings = { tradition, shevaMode: 'enforce' }
  const response = await openaiAudio.fetch(new Request('http://localhost/api/openai-audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'transcribe', audio: wav, referenceText: pasuk.text, settings }),
  }))
  const data = await response.json()
  if (!response.ok) throw new Error(`Grading failed: ${data.error}`)
  const { words } = gradeTranscription(parseTranscription(data.content), pasuk.text, settings)
  return words.filter(w => w.errorType !== 'None').map(w => {
    const notes = w.phonemes.map(p => p.note).filter(Boolean)
    return `${w.word}: heard "${w.phoneticHeard || '—'}"${notes.length ? ` (${notes.join('; ')})` : ''}`
  })
}

if (gradeOnly) {
  for (const pasuk of psukim.filter(p => !only.length || only.includes(p.id))) {
    for (const [tradition, entry] of Object.entries(index[pasuk.id] ?? {})) {
      if (traditionArg && tradition !== traditionArg) continue
      const flagged = await grade(fs.readFileSync(`public/${entry.file}`), pasuk, tradition)
      console.log(`${pasuk.id} ${tradition}: ${flagged.length ? flagged.join(' | ') : 'ok'}`)
    }
  }
  process.exit()
}

const failed = []
for (const pasuk of psukim.filter(p => !only.length || only.includes(p.id))) {
  for (const [tradition, variantId] of Object.entries(LISTEN_READING.variants)) {
    if (traditionArg && tradition !== traditionArg) continue
    if (index[pasuk.id]?.[tradition] && !force) continue
    const variant = SPEECH_VARIANTS.find(v => v.id === variantId)
    const expected = letters(pasuk.text)

    let done = false
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !done; attempt++) {
      const { audio, model } = await read(variant, pasuk)
      const transcript = await transcribe(audio)
      const heard = letters(transcript)
      if (heard !== expected) {
        console.log(`${pasuk.id} ${tradition} #${attempt}: mismatch\n  verse: ${pasuk.text}\n  heard: ${transcript}`)
        continue
      }
      const file = `audio/listen/${pasuk.id}-${tradition}.mp3`
      fs.writeFileSync(`public/${file}`, audio)
      index[pasuk.id] = {
        ...index[pasuk.id],
        [tradition]: { file, model, variant: variantId, voice: LISTEN_READING.voice, transcript, attempts: attempt, createdAt: new Date().toISOString() },
      }
      fs.writeFileSync(INDEX, JSON.stringify(index, null, 2) + '\n')
      console.log(`${pasuk.id} ${tradition}: ok (attempt ${attempt})`)
      done = true
    }
    if (!done) failed.push(`${pasuk.id} ${tradition}`)
  }
}
if (failed.length) {
  console.log(`\nNo matching reading after ${MAX_ATTEMPTS} attempts: ${failed.join(', ')}`)
  process.exitCode = 1
}
