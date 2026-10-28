// Re-score every saved bench take with the current lib.mjs, to tune the
// scoring without re-recording. Prints each planned mistake's score and every
// flag on a sound that was read correctly. --save also rewrites
// data/bench/results.json, so the page shows the current scoring.
//
//   node rescore-bench.mjs [kind] [--save] [--round=N] [--dump=rows.json]
//   kind: word, syllable, letter, order, end-vowel, ending, consonant, vowel,
//   vowel-ou, vowel-missing, sheva-na, sheva-nach. --dump writes every score.
import { readFile, writeFile } from 'node:fs/promises'
import { loadAudio, frameLogProbs, expectedUnits, scoreContrasts, FLAG_BELOW } from './lib.mjs'
import { items, matchesFlag } from './bench/items.mjs'
import { textOf, score } from './bench/score.mjs'

const save = process.argv.includes('--save')
const only = process.argv.slice(2).find(a => !a.startsWith('--'))
const dump = process.argv.find(a => a.startsWith('--dump='))?.split('=')[1]
const round = +(process.argv.find(a => a.startsWith('--round='))?.split('=')[1] ?? 0)
const results = JSON.parse(await readFile('data/bench/results.json', 'utf8'))
const rows = []
const t0 = Date.now()
for (const [key, r] of Object.entries(results)) {
  const [id, take] = key.split('__')
  const item = items.find(i => i.id === id)
  if (!item || (round && item.round !== round)) continue
  const post = await frameLogProbs(await loadAudio(`data/bench/${r.file}`))
  if (save) Object.assign(r, await score(item, take, `data/bench/${r.file}`))
  for (const s of scoreContrasts(post, expectedUnits(textOf(item), { tradition: item.trad }))) {
    if (only && s.kind !== only) continue
    const target = take === 'wrong' && item.flag.some(f => matchesFlag(f, s))
    rows.push({ key, ...s, target, llr: +s.llr.toFixed(1) })
  }
}
const show = x => `${String(x.llr).padStart(6)}  ${x.key.padEnd(24)} ${x.word} ${x.kind} ${x.test} ${x.expected}→${x.partner}${x.trace != null ? ` (trace ${x.trace.toFixed(2)})` : ''}`
const targets = rows.filter(x => x.target), others = rows.filter(x => !x.target)
for (const kind of ['word', 'syllable', 'letter-missing', 'letter', 'order', 'end-vowel', 'ending', 'consonant', 'vowel', 'vowel-ou', 'vowel-missing', 'sheva-na', 'sheva-nach']) {
  const t = targets.filter(x => x.kind === kind), o = others.filter(x => x.kind === kind)
  if (!t.length && !o.length) continue
  const cut = ['word', 'syllable'].includes(kind) ? Infinity : FLAG_BELOW[kind]
  if (kind === 'end-vowel') {
    const bad = x => x.trace >= FLAG_BELOW['end-vowel']
    console.log(`\n== end-vowel (a full vowel ≥ ${FLAG_BELOW['end-vowel']} after the last letter): planned mistakes caught ${t.filter(bad).length}/${t.length}; correct readings flagged ${o.filter(bad).length}/${o.length}`)
    t.forEach(x => console.log(bad(x) ? '  caught' : '  MISSED', show(x)))
    o.filter(bad).forEach(x => console.log('  FLAG  ', show(x)))
    continue
  }
  if (kind === 'sheva-na') {
    const bad = x => x.partner !== 'said'
    console.log(`\n== sheva-na: planned mistakes caught ${t.filter(bad).length}/${t.length}; correct readings flagged ${o.filter(bad).length}/${o.length}`)
    t.forEach(x => console.log(bad(x) ? '  caught' : '  MISSED', show(x)))
    o.filter(bad).forEach(x => console.log('  FLAG  ', show(x)))
    continue
  }
  console.log(`\n== ${kind} (flag below ${cut}): planned mistakes caught ${t.filter(x => x.llr < cut).length}/${t.length}; correct sounds flagged ${o.filter(x => x.llr < cut).length}/${o.length}`)
  t.forEach(x => console.log(x.llr < cut ? '  caught' : '  MISSED', show(x)))
  o.filter(x => x.llr < cut).sort((a, b) => a.llr - b.llr).forEach(x => console.log('  FALSE ', show(x)))
  const near = o.filter(x => x.llr >= cut && x.llr < cut + 1.5)
  if (near.length) console.log(`  (${near.length} correct sounds scored within 1.5 of the cut)`)
}
if (dump) await writeFile(dump, JSON.stringify(rows.map(({ span, ...x }) => x)))
if (save) await writeFile('data/bench/results.json', JSON.stringify(results, null, 1))
console.log(`\n${Object.keys(results).length} takes in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
