// Whole verses: tester recordings and the Listen clips (correct readings).
// For each tested letter (shin/sin, bet/vet, kaf/khaf, pe/fe, Ashkenazic sav),
// the score of the written sound against its partner. Negative = flagged.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { loadAudio, frameLogProbs, freeDecode, expectedUnits, align, scoreContrasts } from './lib.mjs'

const ROOT = new URL('../../', import.meta.url).pathname
const clips = []
for (const f of (await readdir('data/attempts')).filter(f => f.endsWith('.json'))) {
  const m = JSON.parse(await readFile(`data/attempts/${f}`, 'utf8'))
  clips.push({ id: m.id, source: 'tester', audio: `data/attempts/${m.id}.wav`, text: m.referenceText, tradition: m.settings.tradition, gpt: JSON.parse(m.content).transcription })
}
const only = process.argv[2]
if (only !== 'tester') {
  const manifest = JSON.parse(await readFile(`${ROOT}voice-library/manifest.json`, 'utf8'))
  for (const c of manifest.clips) clips.push({ id: c.id, source: 'listen', audio: `${ROOT}voice-library/${c.file}`, text: c.verseText, tradition: c.accent === 'ashkenazi' ? 'ashkenazic' : 'sephardic' })
}

const results = []
for (const c of clips) {
  const post = await frameLogProbs(await loadAudio(c.audio))
  const units = expectedUnits(c.text, { tradition: c.tradition })
  const base = align(post, units)
  const scores = scoreContrasts(post, units, base)
  results.push({ ...c, heard: freeDecode(post), scores: scores.map(({ word, letter, test, expected, partner, llr, span }) => ({ word, letter, test, expected, partner, llr: +llr.toFixed(2), at: span && +(span[0] * post.frameSeconds).toFixed(2) })) })
  if (c.source === 'tester') {
    console.log(`\n${c.id} (${c.tradition})\n  gpt-audio: ${c.gpt}\n  phonemes:  ${results.at(-1).heard}`)
    for (const s of results.at(-1).scores) console.log(`   ${s.llr < 0 ? 'FLAG' : '    '} ${s.word.padEnd(14)} ${s.test.padEnd(5)} ${s.expected}→${s.partner}  ${String(s.llr).padStart(6)}  @${s.at}s`)
  }
}
await mkdir('results', { recursive: true })
await writeFile(`results/verses-${only ?? 'all'}.json`, JSON.stringify(results, null, 1))
