// Pairs: free decoding, plus the contrast score on the tested letter.
import { pairs } from './pairs.mjs'
import { loadAudio, frameLogProbs, freeDecode, expectedUnits, align, scoreContrasts } from './lib.mjs'

const rows = []
for (const p of pairs) {
  for (const kind of ['right', 'wrong']) {
    const post = await frameLogProbs(await loadAudio(`data/pairs/${p.id}__${kind}.wav`))
    const units = expectedUnits(p.word)
    const scores = scoreContrasts(post, units)
    // the first tested letter matching the pair's letter
    const s = scores.find(x => x.letter === p.letter || (p.letter === 'ך' && x.letter === 'ך')) ?? scores[0]
    rows.push({ id: p.id, kind, heard: freeDecode(post), mistake: p.mistake, llr: s?.llr })
  }
}
for (const r of rows) console.log(`${r.id.padEnd(8)} ${r.kind.padEnd(5)} ${r.mistake.padEnd(8)} llr ${r.llr?.toFixed(1).padStart(6)}  heard: ${r.heard}`)
