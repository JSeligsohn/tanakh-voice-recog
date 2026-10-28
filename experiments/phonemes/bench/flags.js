// How the bench pages describe what the phoneme scorer flagged, in words a
// teacher would use ("the tzere in X: heard "ee" (see), should be "eh"...")
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
export const NIKKUD = { patah: 'patach', qamats: 'kamatz', tzere: 'tzere', segol: 'segol', hiriq: 'chirik', holam: 'cholam', shuruk: 'shuruk', qubuts: 'kubutz', 'hataf-patah': 'chataf patach', 'hataf-segol': 'chataf segol', 'hataf-qamats': 'chataf kamatz', 'sheva-na': 'sheva na', 'sheva-nach': 'sheva nach' }
export const inWord = w => `<span dir="rtl">${esc(w)}</span>`
// what a flag on the bench item is about: "ש in X" or "the chirik in X"
export const target = w => w.problem ? `${inWord(w.word)} (${esc(w.problem)})` : w.vowel ? `the ${NIKKUD[w.vowel] ?? w.vowel} in ${inWord(w.word)}` : `${esc(w.letter)} in ${inWord(w.word)}`
// vowel and letter sounds, said the way the app says them
export const SOUND = { a: '"ah" (father)', e: '"eh" (bed)', i: '"ee" (see)', o: '"oh" (bone)', u: '"oo" (moon)', 'a/o/u': '"ah", "oh" or "oo"',
  sh: '"sh"', s: '"s"', b: '"b"', v: '"v"', k: '"k"', ch: '"ch" (Bach)', p: '"p"', f: '"f"', t: '"t"',
  h: '"h"', d: '"d"', r: '"r"', z: '"z"', ts: '"tz"', m: '"m"', n: '"n"', g: '"g" (go)', l: '"l"', y: '"y"' }
export const sound = x => SOUND[x] ?? `"${x}"`
export const expectedVowel = f => f.test === 'tzere' ? '"eh" or "ei" (bed, they)' : sound(f.expected)
// what was flagged in a take
export const flagText = f => {
  if (f.kind === 'word') return f.test === 'skipped' ? `${inWord(f.word)} was left out`
    : f.test === 'wrong word' ? `${inWord(f.word)} wasn't read: heard something else ("${esc(f.partner)}")`
    : `${inWord(f.word)} couldn't be heard clearly`
  if (f.kind === 'syllable') return f.test === 'prefix left out'
    ? `the "${esc(f.expected)}-" at the start of ${inWord(f.word)} was left out`
    : `the "${esc(f.expected)}" in ${inWord(f.word)} was left out`
  if (f.kind === 'letter') return `${esc(f.letter)} in ${inWord(f.word)}: heard ${sound(f.partner)}, should be ${sound(f.expected)}`
  if (f.kind === 'order') return `the patach in ${inWord(f.word)} comes before the ${esc(f.letter)}: "-${esc(f.expected)}", not "-${esc(f.partner)}"`
  if (f.kind === 'end-vowel') return `a vowel added at the end of ${inWord(f.word)}`
  if (f.kind === 'ending') return `${inWord(f.word)} ends "-av", not "-ai-yoo"`
  if (f.kind === 'vowel-missing') return `the ${NIKKUD[f.test] ?? f.test} at the end of ${inWord(f.word)} was left out`
  if (f.kind === 'vowel' || f.kind === 'vowel-ou') return `the ${NIKKUD[f.test] ?? f.test} in ${inWord(f.word)}: heard ${sound(f.partner)}, should be ${expectedVowel(f)}`
  if (f.kind === 'sheva-na') return f.partner === 'short'
    ? `the sheva na in ${inWord(f.word)} was only slightly heard (say it more clearly)`
    : `the sheva na in ${inWord(f.word)} was left out (the letters ran together)`
  if (f.kind === 'sheva-nach') return `a vowel added after ${esc(f.letter)} in ${inWord(f.word)}`
  return `${esc(f.letter)} in ${inWord(f.word)}: heard ${sound(f.partner)}, should be ${sound(f.expected)}`
}
