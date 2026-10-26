// Phoneme experiment: run the wav2vec2 XLSR-53 espeak phoneme model (ONNX) on
// a recording, line the verse's expected sounds up with it (CTC forced
// alignment), and score each shin/sin and dagesh letter against its partner
// sound (goodness of pronunciation). Everything runs locally.

import { readFile, mkdir, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, basename } from 'node:path'
import * as ort from 'onnxruntime-node'
import { tokenizeWord, getExpectedPhonetic, splitVerseWords } from '../../src/utils/hebrewRules.js'

const HERE = new URL('.', import.meta.url).pathname
const vocab = JSON.parse(await readFile(join(HERE, 'models/vocab.json'), 'utf8'))
const idToToken = Object.fromEntries(Object.entries(vocab).map(([t, i]) => [i, t]))
const BLANK = vocab['<pad>']
const V = Object.keys(vocab).length

// --- Audio ---------------------------------------------------------------------

// Any audio file → 16 kHz mono samples (afconvert, cached), normalised to zero
// mean and unit variance as the model's feature extractor does.
export async function loadAudio(path) {
  const cache = join(HERE, 'data/cache')
  await mkdir(cache, { recursive: true })
  const wav = join(cache, basename(path).replace(/\.\w+$/, '') + '.16k.wav')
  try { await access(wav) } catch { execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', path, wav]) }
  const buf = await readFile(wav)
  let off = 12
  while (off < buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4)
    if (id === 'data') {
      const n = Math.floor(Math.min(size, buf.length - off - 8) / 2)
      const x = new Float32Array(n)
      for (let i = 0; i < n; i++) x[i] = buf.readInt16LE(off + 8 + 2 * i) / 32768
      let mean = 0; for (const v of x) mean += v; mean /= n
      let sd = 0; for (const v of x) sd += (v - mean) ** 2; sd = Math.sqrt(sd / n) + 1e-7
      for (let i = 0; i < n; i++) x[i] = (x[i] - mean) / sd
      return x
    }
    off += 8 + size + (size % 2)
  }
  throw new Error('no data in ' + wav)
}

// --- Model -----------------------------------------------------------------------

let session
export async function frameLogProbs(samples) {
  session ??= await ort.InferenceSession.create(join(HERE, 'models/model.onnx'), { graphOptimizationLevel: 'all' })
  const input = new ort.Tensor('float32', samples, [1, samples.length])
  const out = await session.run({ [session.inputNames[0]]: input })
  const logits = out[session.outputNames[0]]
  const T = logits.dims[1]
  const lp = new Float32Array(T * V)
  for (let t = 0; t < T; t++) {
    let max = -Infinity
    for (let v = 0; v < V; v++) max = Math.max(max, logits.data[t * V + v])
    let sum = 0
    for (let v = 0; v < V; v++) sum += Math.exp(logits.data[t * V + v] - max)
    const lse = max + Math.log(sum)
    for (let v = 0; v < V; v++) lp[t * V + v] = logits.data[t * V + v] - lse
  }
  return { lp, T }
}

// What the model hears with no help: best token per 20 ms frame, repeats
// merged, blanks dropped.
export function freeDecode({ lp, T }) {
  const out = []
  let prev = -1
  for (let t = 0; t < T; t++) {
    let best = 0
    for (let v = 1; v < V; v++) if (lp[t * V + v] > lp[t * V + best]) best = v
    if (best !== prev && best !== BLANK) out.push(idToToken[best])
    prev = best
  }
  return out.join(' ')
}

// --- Expected sounds ---------------------------------------------------------------

const has = t => t in vocab
const set = (...tokens) => tokens.filter(has)
const VOWELS = set('a', 'ɑ', 'ɐ', 'aː', 'ä', 'æ', 'e', 'ɛ', 'e̞', 'eː', 'ɛː', 'eɪ', 'ɛɪ', 'ə', 'i', 'iː', 'ɪ', 'ɨ', 'ᵻ',
  'o', 'ɔ', 'o̞', 'oː', 'ɔː', 'oʊ', 'oɪ', 'ɔɪ', 'u', 'uː', 'ʊ', 'ɵ', 'ʌ', 'ɜ', 'ai', 'aɪ', 'au', 'aʊ', 'ui', 'ei', 'y')
// Model tokens that count as each of our sounds
const CONSONANT = {
  b: set('b', 'bʲ', 'bː'), v: set('v', 'vʲ', 'w', 'β', 'ʋ'),
  k: set('k', 'kʰ', 'kʲ', 'kː', 'q', 'c'), ch: set('x', 'χ', 'xʲ', 'ħ', 'h', 'ç'),
  p: set('p', 'pʰ', 'pʲ', 'pː'), f: set('f', 'fʲ', 'ɸ'),
  t: set('t', 'tʰ', 't̪', 'tʲ', 'tː'), s: set('s', 's̪', 'sʲ', 'sː'), sh: set('ʃ', 'ɕ', 'ʂ', 'ʃʲ'),
  d: set('d', 'dʲ', 'd̪', 'dː'), g: set('ɡ', 'ɡʲ', 'ɡː'), h: set('h', 'ħ'), z: set('z', 'ʒ'),
  y: set('j', 'ʝ', 'i'), l: set('l', 'ɫ', 'lː', 'ʎ'), m: set('m', 'mʲ'), n: set('n', 'nʲ', 'ŋ', 'ɲ'),
  r: set('ʁ', 'r', 'ɾ', 'ɹ', 'ɻ', 'ʀ', 'χ', 'ɣ'), ts: set('ts', 'tsʲ', 'tsː', 'ʦ'),
}
// The partner each tested sound is scored against
export const PARTNER = { sh: 's', s: 'sh', b: 'v', v: 'b', k: 'ch', ch: 'k', p: 'f', f: 'p', t: 's' }

// The verse as a sequence of units for alignment. Vowels match any vowel (we
// don't test them yet); a sheva or silent-able vowel is optional. Units on
// ש, ב/ו-less bet, כ, פ and ת carry `test` so they get scored.
export function expectedUnits(text, settings = {}) {
  const units = []
  splitVerseWords(text).forEach((word, wi) => {
    const atoms = tokenizeWord(word)
    const { segments } = getExpectedPhonetic(atoms, settings)
    for (const seg of segments) {
      const a = seg.atom
      const c = seg.consonant
      const consonantUnit = c && CONSONANT[c] && {
        kind: 'c', sound: c, tokens: [...new Set([...CONSONANT[c], ...(seg.altConsonants ?? []).flatMap(k => CONSONANT[k] ?? [])])],
        word, wi, letter: a.letter, atomIndex: seg.atomIndex,
        test: testedLetter(a, c),
      }
      const vowelUnit = seg.vowel && {
        kind: 'v', sound: seg.vowel, tokens: VOWELS, word, wi, letter: a.letter, atomIndex: seg.atomIndex,
        optional: a.vowel === 'sheva' || a.vowel?.startsWith('hataf') || (seg.altVowels ?? []).includes(''),
      }
      const ordered = seg.patachGenuvah ? [vowelUnit, consonantUnit] : [consonantUnit, vowelUnit]
      units.push(...ordered.filter(Boolean))
    }
  })
  return units
}

function testedLetter(atom, sound) {
  const L = atom.letter
  if (L === 'ש') return sound === 'sh' ? 'shin' : 'sin'
  if (L === 'ב') return atom.dagesh ? 'bet' : 'vet'
  if ((L === 'כ' || L === 'ך')) return atom.dagesh ? 'kaf' : 'khaf'
  if ((L === 'פ' || L === 'ף')) return atom.dagesh ? 'pe' : 'fe'
  if (L === 'ת' && !atom.dagesh && sound === 's') return 'sav'
  return null
}

// --- Forced alignment ----------------------------------------------------------------

// Log probability that frame t is any of `tokens`
function classLp(lp, t, tokens) {
  let max = -Infinity
  for (const id of tokens) max = Math.max(max, lp[t * V + id])
  if (max === -Infinity) return -Infinity
  let sum = 0
  for (const id of tokens) sum += Math.exp(lp[t * V + id] - max)
  return max + Math.log(sum)
}

// CTC Viterbi over blank, u1, blank, u2, ..., un, blank, where a unit is a set
// of acceptable tokens and optional units may be skipped. Returns the best
// path's log probability and each unit's frames [start, end) (null if skipped).
export function align({ lp, T }, units) {
  const n = units.length
  const ids = units.map(u => u.tokens.map(t => vocab[t]))
  const S = 2 * n + 1 // even = blank, odd = unit (s-1)/2
  const emit = new Float32Array(T * S)
  for (let t = 0; t < T; t++) {
    const b = lp[t * V + BLANK]
    for (let s = 0; s < S; s++) emit[t * S + s] = s % 2 === 0 ? b : classLp(lp, t, ids[(s - 1) >> 1])
  }
  const disjoint = (i, j) => !ids[i].some(x => ids[j].includes(x))
  // predecessors of each state (besides itself)
  const preds = Array.from({ length: S }, (_, s) => {
    const p = []
    if (s % 2 === 0) {
      if (s > 0) p.push(s - 1)
      // a skipped optional unit: blank → blank
      if (s >= 2 && units[(s - 2) >> 1].optional) p.push(s - 2)
    } else {
      const u = (s - 1) >> 1
      // walk back over skippable units
      for (let k = u - 1, blank = s - 1; ; k--) {
        p.push(blank)
        if (k < 0) break
        if (disjoint(k, u)) p.push(2 * k + 1)
        if (!units[k].optional) break
        blank = 2 * k
      }
    }
    return p
  })
  const startOk = s => {
    if (s === 0) return true
    for (let k = 0; k < Math.floor((s - 1) / 2) + (s % 2 === 0 ? 1 : 0); k++) if (!units[k].optional) return false
    return true
  }
  const NEG = -1e30
  let prev = new Float64Array(S).fill(NEG)
  const back = new Int16Array(T * S)
  for (let s = 0; s < S; s++) if (startOk(s)) prev[s] = emit[s]
  for (let t = 1; t < T; t++) {
    const cur = new Float64Array(S).fill(NEG)
    for (let s = 0; s < S; s++) {
      let best = prev[s], arg = s
      for (const p of preds[s]) if (prev[p] > best) { best = prev[p]; arg = p }
      cur[s] = best + emit[t * S + s]
      back[t * S + s] = arg
    }
    prev = cur
  }
  // end in the last blank or last unit, or earlier if the rest is optional
  let end = -1, score = NEG
  for (let s = S - 1; s >= 0; s--) {
    if (prev[s] > score) { score = prev[s]; end = s }
    if (s % 2 === 1 && !units[(s - 1) >> 1].optional) break
  }
  const spans = new Array(n).fill(null)
  for (let t = T - 1, s = end; t >= 0; t--) {
    if (s % 2 === 1) {
      const u = (s - 1) >> 1
      spans[u] = spans[u] ? [t, spans[u][1]] : [t, t + 1]
    }
    s = back[t * S + s]
  }
  return { score, spans }
}

// Score each tested letter: how much better the expected sound explains the
// audio than its partner. Re-aligns the whole verse with only that one unit
// swapped, so the comparison is a likelihood ratio over the best timing for
// each. Negative = the partner fits better, i.e. the reader likely said it.
export function scoreContrasts(post, units, base = align(post, units)) {
  return units.map((u, i) => {
    if (!u.test) return null
    const partner = u.test === 'sav' ? 't' : PARTNER[u.sound]
    const swapped = units.map((x, j) => j === i ? { ...x, tokens: CONSONANT[partner] } : x)
    const alt = align(post, swapped)
    return { i, letter: u.letter, word: u.word, test: u.test, expected: u.sound, partner, llr: base.score - alt.score, span: base.spans[i] }
  }).filter(Boolean)
}
