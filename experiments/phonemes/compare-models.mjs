// Compare phoneme models on every saved bench take. For each check, how well
// the scores separate the planned mistakes from correct readings (AUC: 1 =
// perfectly, 0.5 = chance), and what the current cutoffs catch. Also the
// vowel pairs the default model can't hear (a/o, o/u), speed and memory.
//
//   PHONEME_MODEL=zipa-s [PHONEME_THREADS=1] node compare-models.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { loadAudio, frameLogProbs, expectedUnits, scoreContrasts, align, isFlagged, vowelClassTokens, MODEL_NAME } from './lib.mjs'
import { items, matchesFlag } from './bench/items.mjs'
import { textOf } from './bench/score.mjs'

// what each blind (a/o, o/u) mistake was said as
const BLIND = { 'v-shalum': 'u', 'v-omen': 'o', 'v-otoh': 'o', 'r2-lu': 'u', 'r2-ota': 'o' }
const NEAR = { a: 'o', o: 'u', u: 'o' }

const results = JSON.parse(await readFile('data/bench/results.json', 'utf8'))
const rows = [], near = []
let modelSeconds = 0, audioSeconds = 0
for (const [key, r] of Object.entries(results)) {
  const [id, take] = key.split('__')
  const item = items.find(i => i.id === id)
  if (!item) continue
  const samples = await loadAudio(`data/bench/${r.file}`)
  const t0 = performance.now()
  const post = await frameLogProbs(samples)
  modelSeconds += (performance.now() - t0) / 1000
  audioSeconds += samples.length / 16000
  const units = expectedUnits(textOf(item), { tradition: item.trad })
  const base = align(post, units)
  for (const s of scoreContrasts(post, units, base)) {
    rows.push({ key, kind: s.kind, llr: s.llr, flagged: isFlagged(s), target: take === 'wrong' && item.flag.some(f => matchesFlag(f, s)), blindItem: id in BLIND })
  }
  // a/o and o/u: the written vowel against its near partner
  units.forEach((u, i) => {
    if (u.kind !== 'v' || !u.accepted || u.accepted.length !== 1 || !NEAR[u.accepted[0]]) return
    const partner = id in BLIND && take === 'wrong' && item.flag.some(f => f.word.replace(/־/g, '') === u.word.replace(/־/g, '') && f.vowel === u.vowelTest) ? BLIND[id] : NEAR[u.accepted[0]]
    const alt = align(post, units.map((x, j) => j === i ? { ...x, tokens: [...vowelClassTokens(partner), ...vowelClassTokens('schwa')] } : x))
    near.push({ key, llr: base.score - alt.score, target: partner === BLIND[id] && take === 'wrong' })
  })
}

const auc = (targets, others) => {
  if (!targets.length || !others.length) return null
  let n = 0
  for (const t of targets) for (const o of others) n += t < o ? 1 : t === o ? 0.5 : 0
  return n / (targets.length * others.length)
}
const summary = { model: MODEL_NAME, threads: +process.env.PHONEME_THREADS || 'all', secondsPerAudioSecond: +(modelSeconds / audioSeconds).toFixed(3), peakMB: Math.round(process.resourceUsage().maxRSS / 1024) }
for (const kind of ['consonant', 'vowel', 'vowel-ou', 'sheva-na', 'sheva-nach']) {
  const rs = rows.filter(x => x.kind === kind && !x.blindItem)
  const t = rs.filter(x => x.target), o = rs.filter(x => !x.target)
  summary[kind] = { auc: +auc(t.map(x => x.llr), o.map(x => x.llr))?.toFixed(3), caught: `${t.filter(x => x.flagged).length}/${t.length}`, falseFlags: `${o.filter(x => x.flagged).length}/${o.length}` }
}
const nt = near.filter(x => x.target), no = near.filter(x => !x.target)
summary['a/o, o/u'] = { auc: +auc(nt.map(x => x.llr), no.map(x => x.llr))?.toFixed(3), mistakes: nt.map(x => +x.llr.toFixed(1)), correctBelow0: `${no.filter(x => x.llr < 0).length}/${no.length}` }
await mkdir('results', { recursive: true })
await writeFile(`results/compare-${MODEL_NAME}${process.env.PHONEME_THREADS ? '-t' + process.env.PHONEME_THREADS : ''}.json`, JSON.stringify(summary, null, 1))
console.log(JSON.stringify(summary))
