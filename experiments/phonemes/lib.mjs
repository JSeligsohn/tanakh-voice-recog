// Phoneme experiment: run the wav2vec2 XLSR-53 espeak phoneme model (ONNX) on
// a recording, line the verse's expected sounds up with it (CTC forced
// alignment), and score each shin/sin and dagesh letter against its partner
// sound, each vowel against the other vowels, and each sheva for being said
// or left out (goodness of pronunciation). Everything runs locally.

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
// The model's vowel tokens (many carry tone marks from other languages),
// grouped by their first sound. "schwa" is a reduced vowel: accepted for any
// vowel, never counted as the wrong one.
const VOWEL_CLASS = { a: [], e: [], i: [], o: [], u: [], schwa: [] }
const FIRST = [
  [/^(a|ɑ|ɐ|æ|ä|ʌ)/, 'a'], [/^(e|ɛ)/, 'e'], [/^(i|ɪ|ɨ|ᵻ|y)/, 'i'],
  [/^(o|ɔ|ɒ)/, 'o'], [/^(u|ʊ|ɯ)/, 'u'], [/^(ə|ɚ|ɜ|ø|œ|ɵ)/, 'schwa'],
]
for (const t of Object.keys(vocab)) {
  // vowels only: no consonant letters (but "ər" and "ɚ" are a reduced vowel)
  if (/[bcdfghjklmnpqrstvwxzðθʃʒɹɡŋʁχħʔ]/.test(t.replace(/^ər/, ''))) continue
  const hit = FIRST.find(([re]) => re.test(t))
  if (hit) VOWEL_CLASS[hit[1]].push(t)
}
const FULL = ['a', 'e', 'i', 'o', 'u']
// Pairs the model can't tell apart (one-frame spikes spread between them), so
// they aren't scored against each other: "o-MEN" and "a-MEN" both come out ɑ,
// and o/u blur the same way.
const NEAR = { a: ['o'], o: ['a', 'u'], u: ['o'] }
// An optional glide after a vowel: tzere "ei" (the yod after it is silent in
// the rules), holam "oi"/"ou". Only the lax glide sounds, so a plain "i" for
// tzere ("ITZ" for עֵץ) can't pass as e + glide.
const GLIDE = { tzere: ['ɪ', 'j'], holam: ['ɪ', 'ʊ', 'j', 'w'] }
const VOWELS = Object.values(VOWEL_CLASS).flat()
const vowelTokens = classes => [...classes, 'schwa'].flatMap(c => VOWEL_CLASS[c])
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

// The verse as a sequence of units for alignment. Each vowel unit accepts the
// vowels the rules engine accepts there (plus a reduced "uh"); a sheva or a
// vowel that may be silent is optional. Units on ש, ב, כ, פ and ת carry
// `test`, and every vowel unit `vowelTest`, so they get scored; a consonant
// followed by a sheva nach carries `nach`, to check that no vowel was added.
export function expectedUnits(text, settings = {}) {
  const units = []
  splitVerseWords(text).forEach((word, wi) => {
    const atoms = tokenizeWord(word)
    const { segments } = getExpectedPhonetic(atoms, settings)
    segments.forEach((seg, k) => {
      const a = seg.atom
      const c = seg.consonant
      const consonantUnit = c && CONSONANT[c] && {
        kind: 'c', sound: c, tokens: [...new Set([...CONSONANT[c], ...(seg.altConsonants ?? []).flatMap(k => CONSONANT[k] ?? [])])],
        word, wi, letter: a.letter, atomIndex: seg.atomIndex,
        test: testedLetter(a, c),
        nach: seg.shevaType === 'nach' && !a.isFinal,
      }
      const where = { word, wi, letter: a.letter, atomIndex: seg.atomIndex }
      const vowelUnit = seg.vowel && vowelUnitFor(seg, where, segments[k + 1]?.consonant, segments[k - 1]?.shevaType === 'nach')
      const glideTokens = seg.vowel && (GLIDE[a.vowel] ?? (a.yudAfter ? GLIDE.tzere : null))
      const glide = glideTokens && { kind: 'g', tokens: glideTokens.filter(has), ...where, optional: true }
      const ordered = seg.patachGenuvah ? [vowelUnit, consonantUnit] : [consonantUnit, vowelUnit, glide]
      units.push(...ordered.filter(Boolean))
    })
  })
  return units
}

// Can a sheva na be left out entirely, so the letters run together ("shma"
// for שְׁמַע, "breishit", "vha" for וְהַ)? Not when the first letter can't
// lead a cluster (לְךָ: some vowel is always there, so a missing one means it
// was said too short), and not after a sheva nach (וּמִמּוֹלַדְתְּךָ): that
// letter opens its own syllable whatever happens, and a hard t's release is
// heard like a vowel, so it can be short but not left out.
const CAN_LEAD = new Set(['b', 'v', 'p', 'f', 'k', 'ch', 'g', 'd', 't', 's', 'sh', 'z', 'ts'])
const clusters = (c1, c2, afterNach) => !afterNach && CAN_LEAD.has(c1) && !!c2 && c1 !== c2

function vowelUnitFor(seg, where, nextConsonant, afterNach) {
  const nikkud = seg.atom.vowel
  const optional = seg.altVowels.includes('') || nikkud.startsWith('hataf')
  // Sheva na: any vowel counts as saying it; the test is whether it was said,
  // where it could have been left out
  if (nikkud === 'sheva') {
    return {
      kind: 'v', sound: 'e', tokens: VOWELS, ...where, optional: true,
      vowelTest: seg.shevaType === 'na' ? 'sheva-na' : null, canCluster: clusters(seg.consonant, nextConsonant, afterNach),
    }
  }
  const accepted = [...new Set([seg.vowel, ...seg.altVowels].filter(v => FULL.includes(v)))]
  return {
    kind: 'v', sound: seg.vowel, tokens: vowelTokens(accepted), ...where, optional,
    vowelTest: nikkud, accepted, rivals: FULL.filter(v => !accepted.includes(v) && !accepted.some(a => NEAR[a]?.includes(v))),
  }
}

function testedLetter(atom, sound) {
  const L = atom.letter
  if (L === 'ש') return sound === 'sh' ? 'shin' : 'sin'
  if (L === 'ב') return atom.dagesh ? 'bet' : 'vet'
  if ((L === 'כ' || L === 'ך')) return atom.dagesh ? 'kaf' : 'khaf'
  if ((L === 'פ' || L === 'ף')) return atom.dagesh ? 'pe' : 'fe'
  if (L === 'ת') return sound === 's' ? 'sav' : 'tav'
  return null
}

// --- Forced alignment ----------------------------------------------------------------

// Log probability that each frame is any of `ids`, cached per token set
function classLps(post, ids) {
  post.cache ??= new Map()
  const key = ids.join(',')
  let out = post.cache.get(key)
  if (out) return out
  const { lp, T } = post
  out = new Float64Array(T)
  for (let t = 0; t < T; t++) {
    let max = -Infinity
    for (const id of ids) max = Math.max(max, lp[t * V + id])
    if (max === -Infinity) { out[t] = -Infinity; continue }
    let sum = 0
    for (const id of ids) sum += Math.exp(lp[t * V + id] - max)
    out[t] = max + Math.log(sum)
  }
  post.cache.set(key, out)
  return out
}

// CTC Viterbi over blank, u1, blank, u2, ..., un, blank, where a unit is a set
// of acceptable tokens and optional units may be skipped. Returns the best
// path's log probability and each unit's frames [start, end) (null if skipped).
export function align(post, units) {
  const { lp, T } = post
  const n = units.length
  const ids = units.map(u => u.tokens.map(t => vocab[t]))
  const S = 2 * n + 1 // even = blank, odd = unit (s-1)/2
  const emit = new Float32Array(T * S)
  const cls = ids.map(x => classLps(post, x))
  for (let t = 0; t < T; t++) {
    const b = lp[t * V + BLANK]
    for (let s = 0; s < S; s++) emit[t * S + s] = s % 2 === 0 ? b : cls[(s - 1) >> 1][t]
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

// Probability that frame t is some vowel
const VOWEL_IDS = VOWELS.map(t => vocab[t])
const vowelMass = ({ lp }, t) => VOWEL_IDS.reduce((sum, id) => sum + Math.exp(lp[t * V + id]), 0)

// A sheva na must be heard (shevas enforced). A short one often gets no spike
// of its own but leaves a trace of vowel; with no trace at all, the letters
// ran together. Bench round 1: clearly said 0.67–0.98, short 0.12–0.34, left
// out ≤ 0.03. The trace decides when the alignment disagrees: in יְדֵי the
// model hears "ye" as an "i" and gives it to the yod.
// A sheva that is heard but comes out as a reduced "ə" rather than "e" is
// short too: all three deliberate "left out" takes the trace missed (l-CHA,
// mish-p-CHOT, BNEI) were mostly ə, and clearly said ones mostly e.
const SAID_TRACE = 0.6, SOME_TRACE = 0.1, MUMBLED = 0.35
function shevaNaVerdict(llr, trace, canCluster, heardAs) {
  if (llr >= 0 || trace >= SAID_TRACE) return heardAs?.class === 'schwa' && heardAs.schwa >= MUMBLED ? 'short' : 'said'
  return trace >= SOME_TRACE || !canCluster ? 'short' : 'left out'
}

// Which vowel class has the most probability over a span: { class, share }
function vowelQuality(post, span) {
  if (!span) return null
  const mass = {}
  for (const [c, toks] of Object.entries(VOWEL_CLASS)) {
    mass[c] = 0
    for (let t = span[0]; t < span[1]; t++) for (const tok of toks) mass[c] += Math.exp(post.lp[t * V + vocab[tok]])
  }
  const total = Object.values(mass).reduce((a, b) => a + b, 0) || 1
  const [c, m] = Object.entries(mass).sort((a, b) => b[1] - a[1])[0]
  return { class: c, share: +(m / total).toFixed(2), schwa: +(mass.schwa / total).toFixed(2), e: +(mass.e / total).toFixed(2) }
}

// How far below zero a score must fall to be flagged. Vowels and shevas are
// noisier than consonants (rounds 1–2: correct vowels reached −2.0, the
// vowel mistakes it can hear scored −2.3 to −4.9).
export const FLAG_BELOW = { consonant: 0, vowel: -2.2, 'sheva-nach': -2.5 }
export const isFlagged = s => s.kind === 'sheva-na' ? s.partner !== 'said' : s.llr < FLAG_BELOW[s.kind]

// Score each tested sound against what a reader might say instead. Each test
// re-aligns the whole verse with one unit changed, so the comparison is a
// likelihood ratio over the best timing for each. Negative = the alternative
// fits better, i.e. the reader likely said it.
//   consonant   the written sound vs its partner (sh/s, b/v, k/kh, p/f, t/s)
//   vowel       the accepted vowels vs all the others together
//   sheva-na    said vs left out, then said / short / left out (shevaNaVerdict)
//   sheva-nach  silent vs a vowel added after the letter
export function scoreContrasts(post, units, base = align(post, units)) {
  const swap = (i, change) => align(post, units.map((x, j) => j === i ? { ...x, ...change } : x))
  const out = []
  units.forEach((u, i) => {
    const at = { i, letter: u.letter, word: u.word, span: base.spans[i] }
    if (u.test) {
      const partner = u.test === 'sav' ? 't' : PARTNER[u.sound]
      out.push({ ...at, kind: 'consonant', test: u.test, expected: u.sound, partner, llr: base.score - swap(i, { tokens: CONSONANT[partner] }).score })
    }
    if (u.vowelTest === 'sheva-na') {
      const saidAlign = swap(i, { optional: false }), said = saidAlign.score
      const heardAs = vowelQuality(post, saidAlign.spans[i])
      const without = align(post, units.filter((_, j) => j !== i))
      // with the sheva left out, how much vowel the model still hears from the
      // letter before it to the letter after (a short sheva often has no spike
      // of its own, but leaves a trace)
      const from = without.spans[i - 1]?.[0] ?? 0, to = without.spans[i]?.[1] ?? post.T
      let trace = 0
      for (let t = from; t < to; t++) trace = Math.max(trace, vowelMass(post, t))
      const llr = said - without.score
      out.push({ ...at, kind: 'sheva-na', test: 'sheva-na', expected: 'said', partner: shevaNaVerdict(llr, trace, u.canCluster, heardAs), llr, trace, heardAs })
    } else if (u.vowelTest && u.rivals.length) {
      const alt = swap(i, { tokens: u.rivals.flatMap(v => VOWEL_CLASS[v]) })
      const llr = base.score - alt.score
      // name the vowel that fits best, for the message
      const partner = llr < 0 ? u.rivals.map(v => [v, swap(i, { tokens: VOWEL_CLASS[v] }).score]).sort((a, b) => b[1] - a[1])[0][0] : u.rivals.join('/')
      out.push({ ...at, kind: 'vowel', test: u.vowelTest, expected: u.accepted.join('/'), partner, llr })
    }
    if (u.nach) {
      const added = align(post, [...units.slice(0, i + 1), { kind: 'v', tokens: VOWELS, word: u.word }, ...units.slice(i + 1)]).score
      out.push({ ...at, kind: 'sheva-nach', test: 'sheva-nach', expected: 'silent', partner: 'a vowel', llr: base.score - added })
    }
  })
  return out
}
