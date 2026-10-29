// Play bench takes through the live reader's tracker (src/server/phonemes/live.js)
// as the microphone would: 100 ms at a time, checking whenever it's due, as
// fast as the model allows. Prints each word's verdict, when in the audio it
// came, and the full-verse scorer's verdict on the same take for comparison.
//
//   node live-sim.mjs [filter]      e.g. node live-sim.mjs shema   (default: verses and readings)
//   HOLD=1 node live-sim.mjs ...    a wrong word must be read right before going on
//   TAIL=0 node live-sim.mjs ...    no quiet after the take (default 3 s, as the app listens on)

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { items } from './bench/items.mjs'
import { psukim } from '../../src/data/psukim.js'
import { readWav, to16k, scoreRecording, frameLogProbs, align, expectedUnits } from '../../src/server/phonemes/scorer.js'
import { splitVerseWords } from '../../src/utils/hebrewRules.js'

// the app's model (not the experiment's default, xlsr): nothing here imports lib.mjs
// LIVE_MODULE=<path>: another version of the tracker, to compare
const { LiveTracker } = await import(process.env.LIVE_MODULE ?? '../../src/server/phonemes/live.js')
const textOf = item => item.text ?? psukim.find(p => p.id === item.pasuk).text
const DIR = new URL('./data/bench/', import.meta.url).pathname
const filter = process.argv[2]
const files = (await readdir(DIR)).filter(f => f.endsWith('.wav')).sort()
const takes = files.map(file => {
  const [id, kind] = file.split('__')
  return { file, item: items.find(i => i.id === id), kind }
}).filter(t => t.item && (filter ? t.file.includes(filter) : ['verse', 'reading'].includes(t.item.group)))

const CHUNK = 1600
let agree = 0, disagree = 0
const lags = [], atStop = []
for (const { file, item, kind } of takes) {
  const text = textOf(item)
  const settings = { tradition: item.trad === 'ashkenazic' ? 'ashkenazic' : 'sephardic' }
  const { samples: raw, rate } = readWav(await readFile(join(DIR, file)))
  // the reader stops, and the microphone listens on (TAIL seconds of quiet, default 3)
  const read = to16k(raw, rate), tail = Math.round(16000 * +(process.env.TAIL ?? 3))
  const samples = new Float32Array(read.length + tail)
  samples.set(read)
  const tracker = new LiveTracker(text, settings, { follow: !process.env.HOLD })
  const log = []
  let checks = 0, busy = 0
  for (let at = 0; at < samples.length; at += CHUNK) {
    tracker.push(samples.subarray(at, at + CHUNK))
    if (!tracker.due) continue
    const t0 = performance.now()
    const events = await tracker.check()
    busy += performance.now() - t0; checks++
    for (const e of events) log.push({ ...e, at: tracker.length / 16000 })
  }
  // the reader pressed stop: grade what's left
  for (const e of await tracker.check({ final: true })) log.push({ ...e, at: tracker.length / 16000, final: true })

  const full = await scoreRecording(samples, text, settings)
  const words = splitVerseWords(text)
  // when each word ends, from the whole take lined up with the verse
  const padded = new Float32Array(samples.length + 6400); padded.set(samples, 6400)
  const fullPost = await frameLogProbs(padded)
  const units = expectedUnits(text, settings), spans = align(fullPost, units).spans
  const wordEnd = wi => Math.max(...units.map((u, k) => u.wi === wi && spans[k] ? spans[k][1] : 0)) * fullPost.frameSeconds - 0.4
  console.log(`\n${file}  (${(samples.length / 16000).toFixed(1)} s, ${checks} checks, ${(busy / Math.max(1, checks)).toFixed(0)} ms each)`)
  console.log(`  ${kind === 'wrong' ? 'mistake: ' + item.wrong : item.right ?? ''}`)
  words.forEach((w, wi) => {
    const verdicts = log.filter(e => e.type === 'word' && e.wi === wi)
    const last = verdicts.at(-1)
    const fullFlags = full.flags.filter(f => f.wi === wi && !(f.kind === 'sheva-na' && f.partner === 'short'))
    const fullStatus = fullFlags.length ? 'wrong' : 'correct'
    const liveStatus = last?.status === 'skipped' ? 'wrong' : last?.status ?? 'never'
    if (liveStatus === fullStatus) agree++; else disagree++
    const trail = verdicts.map(v => `${{ correct: '✓', wrong: '✗', skipped: '–' }[v.status]}+${(v.at - wordEnd(wi)).toFixed(1)}${v.final ? '(stop)' : ''}`).join(' ')
    if (verdicts[0]) (verdicts[0].final ? atStop : lags).push(verdicts[0].at - wordEnd(wi))
    const why = last?.flags?.filter(f => !(f.kind === 'sheva-na' && f.partner === 'short')).map(f => `${f.kind}:${f.test}→${f.partner} ${f.score}`).join(', ')
    console.log(`  ${liveStatus === fullStatus ? ' ' : '≠'} ${w.padEnd(14)} live ${trail.padEnd(22) || 'never'.padEnd(22)} full ${fullStatus}${why ? '   ' + why : ''}${fullFlags.length && liveStatus !== fullStatus ? '   full: ' + fullFlags.map(f => `${f.kind}:${f.test}→${f.partner} ${f.score}`).join(', ') : ''}`)
  })
}
console.log(`\nAgree with the full-verse scorer on ${agree} of ${agree + disagree} words.`)
const q = (xs, p) => xs.slice().sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))]?.toFixed(2)
console.log(`Lit up while reading: ${lags.length} words, after the word ended by ${q(lags, 0.5)} s (median), ${q(lags, 0.9)} s (90%). Only at stop: ${atStop.length}.`)
