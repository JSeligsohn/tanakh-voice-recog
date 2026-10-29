// How well can the live reader tell that a reader has gone on to the next
// word? For each word of the bench's verse takes, the whole take lined up
// with the verse gives when each word really starts. Then, as the live reader
// would, the audio from the word's start up to a moment before or after the
// next word starts is lined up, and each candidate signal measured:
//   onset  B − A, B with the next word's start (through its first vowel and the letter after)
//   cv     the same, through its first vowel only
//   whole  the same, with the whole next word (nothing optional)
//   tail   sound frames after the word's last sound in A (seconds)
// Prints each signal's spread at each moment: before the next word starts it
// should stay low, after it should be high.
//
//   node live-boundaries.mjs [filter]

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { items } from './bench/items.mjs'
import { psukim } from '../../src/data/psukim.js'
import { readWav, to16k, frameLogProbs, align, expectedUnits, junkUnit, soundFrames } from '../../src/server/phonemes/scorer.js'

const textOf = item => item.text ?? psukim.find(p => p.id === item.pasuk).text
const DIR = new URL('./data/bench/', import.meta.url).pathname
const filter = process.argv[2]
const files = (await readdir(DIR)).filter(f => f.endsWith('.wav') && (filter ? f.includes(filter) : true)).sort()
const takes = files.map(file => ({ file, item: items.find(i => i.id === file.split('__')[0]) }))
  .filter(t => t.item && (filter || t.item.group === 'verse' || ['r3-pause', 'r3-fast', 'r3-repeat'].includes(t.item.id)))

const RATE = 16000, PAD = 0.4 * RATE, LEAD = 0.25
const OFFSETS = [-0.4, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.6]
const J = () => junkUnit(2)
const rows = []
for (const { file, item } of takes) {
  const text = textOf(item)
  const settings = { tradition: item.trad === 'ashkenazic' ? 'ashkenazic' : 'sephardic' }
  const { samples: raw, rate } = readWav(await readFile(join(DIR, file)))
  const samples = to16k(raw, rate)
  const units = expectedUnits(text, { ...settings, junk: false })
  const padded = new Float32Array(samples.length + PAD); padded.set(samples, PAD)
  const full = await frameLogProbs(padded)
  const { spans } = align(full, expectedUnits(text, settings))
  const withJ = expectedUnits(text, settings)
  const times = wi => {
    const s = withJ.map((u, k) => (u.wi === wi && u.kind !== 'j' && spans[k] ? spans[k] : null)).filter(Boolean)
    return s.length ? { start: s[0][0] * full.frameSeconds - 0.4, end: s.at(-1)[1] * full.frameSeconds - 0.4 } : null
  }
  const W = Math.max(...units.map(u => u.wi)) + 1
  for (let wi = 0; wi + 1 < W; wi++) {
    const here = times(wi), next = times(wi + 1)
    if (!here || !next) continue
    const word = units.filter(u => u.wi === wi), nextUnits = units.filter(u => u.wi === wi + 1)
    const firstVowel = nextUnits.findIndex(u => u.kind === 'v' && !u.optional)
    const after = nextUnits.findIndex((u, k) => k > firstVowel && u.kind === 'c')
    const upTo = n => nextUnits.map((u, k) => (k > n ? { ...u, optional: true } : u))
    const onset = upTo(after < 0 ? firstVowel : after), cv = upTo(firstVowel)
    for (const off of OFFSETS) {
      const from = Math.max(0, Math.round((here.start - LEAD) * RATE)), to = Math.round((next.start + off) * RATE)
      if (to <= from + 0.3 * RATE || to > samples.length) continue
      const win = new Float32Array(PAD + to - from); win.set(samples.subarray(from, to), PAD)
      const post = await frameLogProbs(win)
      const A = [J(), ...word, J()], a = align(post, A)
      const b = units2 => align(post, [J(), ...word, J(), ...units2, J()]).score - a.score
      const heard = soundFrames(post)
      const wordEnd = a.spans.slice(1, -1).findLast(Boolean)?.[1] ?? 0
      let tail = 0; for (let t = wordEnd; t < post.T; t++) tail += heard[t]
      rows.push({ off, onset: b(onset), cv: b(cv), whole: b(nextUnits), tail: tail * post.frameSeconds })
    }
  }
}

await writeFile(new URL('./results/live-boundaries.json', import.meta.url), JSON.stringify(rows))
const q = (xs, p) => xs.slice().sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))]
console.log(`${rows.length / OFFSETS.length | 0} word boundaries (approx.), ${takes.length} takes\n`)
for (const sig of ['onset', 'cv', 'whole', 'tail']) {
  console.log(`${sig}   (10% / median / 90% at each moment, seconds from the next word's start)`)
  for (const off of OFFSETS) {
    const xs = rows.filter(r => r.off === off).map(r => r[sig])
    console.log(`  ${(off >= 0 ? '+' : '') + off.toFixed(1)}  ${q(xs, 0.1).toFixed(1).padStart(6)} ${q(xs, 0.5).toFixed(1).padStart(6)} ${q(xs, 0.9).toFixed(1).padStart(6)}   n=${xs.length}`)
  }
}
