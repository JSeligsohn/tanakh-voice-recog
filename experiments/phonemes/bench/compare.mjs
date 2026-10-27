// The current grader and the phoneme scorer side by side, on testers' real
// attempts. Attempts come from the app's Review API (with the review password
// the user types into the Compare page; it's passed through, never stored),
// and are kept in data/attempts/ (git-ignored). For each attempt, word by
// word: what the production grader made of the gpt-audio transcription, and
// what the phoneme scorer flagged in the recording. The user's verdicts on
// the words where they disagree are saved to data/compare-verdicts.json.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { gradeTranscription, parseTranscription } from '../../../src/services/openaiRulesAssessment.js'
import { splitVerseWords } from '../../../src/utils/hebrewRules.js'
import { loadAudio, frameLogProbs, expectedUnits, scoreContrasts, isFlagged, MODEL_NAME } from '../lib.mjs'

const HERE = new URL('.', import.meta.url).pathname
const ATTEMPTS = join(HERE, '../data/attempts')
const RESULTS = join(HERE, '../data/compare.json')
const VERDICTS = join(HERE, '../data/compare-verdicts.json')
const RATE = 16000
const ID = /^[\w-]{10,80}$/

await mkdir(ATTEMPTS, { recursive: true })
const readJson = async (path, fallback) => JSON.parse(await readFile(path, 'utf8').catch(() => JSON.stringify(fallback)))
export const compared = await readJson(RESULTS, {})
export const verdicts = await readJson(VERDICTS, {})
export const progress = { running: false, done: 0, total: 0, error: null }

// Fetch any attempts not downloaded yet: details and recording
async function download(appUrl, key) {
  const api = new URL('/api/review', appUrl)
  const call = async query => {
    const res = await fetch(`${api}${query}`, { headers: { 'x-review-key': key } })
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Review API: HTTP ${res.status}`)
    return res
  }
  const { attempts } = await (await call('')).json()
  const have = new Set((await readdir(ATTEMPTS)).filter(f => f.endsWith('.wav')).map(f => f.slice(0, -4)))
  for (const a of attempts.filter(a => ID.test(a.id) && !have.has(a.id))) {
    const wav = Buffer.from(await (await call(`?audio=${encodeURIComponent(a.id)}`)).arrayBuffer())
    await writeFile(join(ATTEMPTS, `${a.id}.wav`), wav)
    await writeFile(join(ATTEMPTS, `${a.id}.json`), JSON.stringify(a))
  }
  return attempts.length
}

const settingsOf = meta => (typeof meta.settings === 'string' ? JSON.parse(meta.settings.replace(/'/g, '"')) : meta.settings) ?? {}

// Both graders on one attempt, word by word
async function compareOne(meta) {
  const settings = settingsOf(meta)
  const words = splitVerseWords(meta.referenceText)
  const transcription = typeof meta.content === 'string' ? parseTranscription(meta.content) : meta.content?.transcription ?? ''
  const current = gradeTranscription(transcription, meta.referenceText, settings).words

  // 0.4 s of silence first: a recording that starts on the first sound loses
  // an opening b, k or p
  const audio = await loadAudio(join(ATTEMPTS, `${meta.id}.wav`))
  const padded = new Float32Array(audio.length + Math.round(0.4 * RATE))
  padded.set(audio, Math.round(0.4 * RATE))
  const post = await frameLogProbs(padded)
  const flags = scoreContrasts(post, expectedUnits(meta.referenceText, settings)).filter(isFlagged)
    .map(s => ({ wi: s.wi, word: s.word, letter: s.letter, kind: s.kind, test: s.test, expected: s.expected, partner: s.partner, llr: +s.llr.toFixed(1) }))

  return {
    id: meta.id, tester: meta.tester, createdAt: meta.createdAt, referenceText: meta.referenceText, settings, transcription,
    model: MODEL_NAME,
    words: words.map((word, wi) => {
      const c = current[wi]
      const notes = (c?.phonemes ?? []).filter(p => p.note).map(p => p.note)
      return {
        word,
        current: { heard: c?.phoneticHeard ?? '', errorType: c?.errorType ?? 'None', score: c?.score ?? null, notes },
        phoneme: flags.filter(f => f.wi === wi),
      }
    }),
  }
}

// Download new attempts, then compare every one not compared yet (or all)
export async function sync(appUrl, key, { rescore = false } = {}) {
  if (progress.running) return
  Object.assign(progress, { running: true, done: 0, total: 0, error: null })
  try {
    if (key) await download(appUrl, key)
    const metas = []
    for (const f of (await readdir(ATTEMPTS)).filter(f => f.endsWith('.json'))) {
      const meta = await readJson(join(ATTEMPTS, f), null)
      if (meta?.referenceText && (rescore || !compared[meta.id])) metas.push(meta)
    }
    progress.total = metas.length
    for (const meta of metas) {
      try { compared[meta.id] = await compareOne(meta) } catch (err) { compared[meta.id] = { id: meta.id, error: err.message } }
      progress.done++
      await writeFile(RESULTS, JSON.stringify(compared))
    }
  } catch (err) {
    progress.error = err.message
  } finally {
    progress.running = false
  }
}

export async function saveVerdict(id, wi, verdict) {
  const key = `${id}#${wi}`
  if (verdict) verdicts[key] = { verdict, at: new Date().toISOString() }
  else delete verdicts[key]
  await writeFile(VERDICTS, JSON.stringify(verdicts, null, 1))
}

export const attemptFile = id => (ID.test(id) ? join(ATTEMPTS, `${id}.wav`) : null)
