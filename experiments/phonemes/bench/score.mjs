// Score one bench take: what was flagged, and whether that's what the item
// expects (the mistake caught, nothing else flagged).
import { psukim } from '../../../src/data/psukim.js'
import { loadAudio, frameLogProbs, freeDecode, expectedUnits, scoreContrasts, isFlagged } from '../lib.mjs'
import { matchesFlag } from './items.mjs'

export const textOf = item => item.text ?? psukim.find(p => p.id === item.pasuk).text

export async function score(item, kind, file) {
  const post = await frameLogProbs(await loadAudio(file))
  const scores = scoreContrasts(post, expectedUnits(textOf(item), { tradition: item.trad }))
  const flags = scores.filter(isFlagged).map(s => ({ word: s.word, letter: s.letter, kind: s.kind, test: s.test, expected: s.expected, partner: s.partner, llr: +s.llr.toFixed(1) }))
  const wanted = kind === 'wrong' ? item.flag : []
  const caught = wanted.filter(w => flags.some(f => matchesFlag(w, f)))
  const extra = flags.filter(f => !wanted.some(w => matchesFlag(w, f)))
  return {
    heard: freeDecode(post), flags,
    missed: wanted.filter(w => !caught.includes(w)), extra,
    ok: caught.length === wanted.length && extra.length === 0,
  }
}
