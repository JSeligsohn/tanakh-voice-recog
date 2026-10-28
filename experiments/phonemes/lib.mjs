// Phoneme experiment: run the wav2vec2 XLSR-53 espeak phoneme model (ONNX) on
// a recording, line the verse's expected sounds up with it (CTC forced
// alignment), and score each shin/sin and dagesh letter against its partner
// sound, each vowel against the other vowels, and each sheva for being said
// or left out (goodness of pronunciation). Everything runs locally.

import { readFile, mkdir, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, basename } from 'node:path'
import * as ort from 'onnxruntime-node'
import { fbank } from './fbank.mjs'
import { tokenizeWord, getExpectedPhonetic, splitVerseWords } from '../../src/utils/hebrewRules.js'

const HERE = new URL('.', import.meta.url).pathname

// Which phoneme model to use: PHONEME_MODEL=<name> (default xlsr). PHONEME_THREADS
// caps the CPU threads, to estimate speed on a smaller server.
export const MODELS = {
  'xlsr': { file: 'models/model.onnx', vocab: 'models/vocab.json', frontend: 'wav2vec' },
  'xlsr-fp16': { file: 'models/model_fp16.onnx', vocab: 'models/vocab.json', frontend: 'wav2vec' },
  'xlsr-q4': { file: 'models/model_q4.onnx', vocab: 'models/vocab.json', frontend: 'wav2vec' },
  'lv60': { file: 'models/lv60/model.onnx', vocab: 'models/lv60/vocab.json', frontend: 'wav2vec' },
  'zipa-s': { file: 'models/zipa-s/model.onnx', tokens: 'models/zipa-s/tokens.txt', frontend: 'fbank' },
  'zipa-s-int8': { file: 'models/zipa-s/model.int8.onnx', tokens: 'models/zipa-s/tokens.txt', frontend: 'fbank' },
  'zipa-l': { file: 'models/zipa-l/model.onnx', tokens: 'models/zipa-l/tokens.txt', frontend: 'fbank' },
}
export const MODEL_NAME = process.env.PHONEME_MODEL ?? 'xlsr'
const MODEL = MODELS[MODEL_NAME]
if (!MODEL) throw new Error(`unknown PHONEME_MODEL ${MODEL_NAME}`)

const vocab = MODEL.vocab
  ? JSON.parse(await readFile(join(HERE, MODEL.vocab), 'utf8'))
  : Object.fromEntries((await readFile(join(HERE, MODEL.tokens), 'utf8')).trim().split('\n').map(l => { const i = l.lastIndexOf(' '); return [l.slice(0, i), +l.slice(i + 1)] }))
const idToToken = Object.fromEntries(Object.entries(vocab).map(([t, i]) => [i, t]))
const BLANK = vocab['<pad>'] ?? vocab['<blk>']
const V = Object.keys(vocab).length
// Tokens that aren't a sound of their own (ZIPA writes length, aspiration and
// word breaks as separate symbols): they count as silence in alignment
const SILENT = Object.keys(vocab).filter(t => /^(<.*>|▁|[ːˑʰʲʷˠˤ˞ʼ]|\p{M}+)$/u.test(t) && vocab[t] !== BLANK).map(t => vocab[t])

// --- Audio ---------------------------------------------------------------------

// Any audio file → 16 kHz mono samples in [-1, 1] (afconvert, cached)
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
      return x
    }
    off += 8 + size + (size % 2)
  }
  throw new Error('no data in ' + wav)
}

// --- Model -----------------------------------------------------------------------

let session
export async function frameLogProbs(samples) {
  const threads = +process.env.PHONEME_THREADS || 0
  session ??= await ort.InferenceSession.create(join(HERE, MODEL.file), { graphOptimizationLevel: 'all', ...(threads && { intraOpNumThreads: threads, interOpNumThreads: 1 }) })
  let feeds
  if (MODEL.frontend === 'fbank') {
    const { feats, T } = fbank(samples)
    feeds = { x: new ort.Tensor('float32', feats, [1, T, 80]), x_lens: new ort.Tensor('int64', BigInt64Array.from([BigInt(T)]), [1]) }
  } else {
    // zero mean and unit variance, as the wav2vec2 feature extractor does
    const x = Float32Array.from(samples)
    let mean = 0; for (const v of x) mean += v; mean /= x.length
    let sd = 0; for (const v of x) sd += (v - mean) ** 2; sd = Math.sqrt(sd / x.length) + 1e-7
    for (let i = 0; i < x.length; i++) x[i] = (x[i] - mean) / sd
    feeds = { [session.inputNames[0]]: new ort.Tensor('float32', x, [1, x.length]) }
  }
  const out = await session.run(feeds)
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
  // fold the silent symbols into the blank
  if (SILENT.length) {
    for (let t = 0; t < T; t++) {
      let sum = Math.exp(lp[t * V + BLANK])
      for (const id of SILENT) sum += Math.exp(lp[t * V + id])
      lp[t * V + BLANK] = Math.log(sum)
    }
  }
  return { lp, T, frameSeconds: (samples.length / 16000) / T }
}

// What the model hears with no help: best token per 20 ms frame, repeats
// merged, blanks dropped.
export function freeDecode({ lp, T }) {
  const out = []
  let prev = -1
  for (let t = 0; t < T; t++) {
    let best = 0
    for (let v = 1; v < V; v++) if (lp[t * V + v] > lp[t * V + best]) best = v
    if (best !== prev && best !== BLANK && !SILENT.includes(best)) out.push(idToToken[best])
    prev = best
  }
  return out.join(' ')
}

// --- Expected sounds ---------------------------------------------------------------

// What the model hears unaided over frames [from, to), as our coarse sounds
// ("sh", "v", "a", ...): each token mapped to the first sound class it's in
export function heardSounds({ lp, T }, from = 0, to = T) {
  const out = []
  let prev = -1
  for (let t = from; t < to; t++) {
    let best = 0
    for (let v = 1; v < V; v++) if (lp[t * V + v] > lp[t * V + best]) best = v
    if (best !== prev && best !== BLANK && !SILENT.includes(best)) out.push(soundOf(idToToken[best]))
    prev = best
  }
  return out.filter(Boolean)
}
let SOUND_OF
function soundOf(token) {
  if (!SOUND_OF) {
    SOUND_OF = {}
    for (const [c, toks] of Object.entries(VOWEL_CLASS)) for (const t of toks) SOUND_OF[t] = c === 'schwa' ? 'e' : c
    for (const [c, toks] of Object.entries(CONSONANT)) for (const t of toks) SOUND_OF[t] ??= c
  }
  return SOUND_OF[token] ?? token
}

const has = t => t in vocab
const set = (...tokens) => tokens.filter(has)
// "Junk": any sounds at all (a false start, an "um", another word), each at a
// cost, with the silence between them free, so the alignment can set them aside
export const junkUnit = (penalty, extra = {}) => ({ kind: 'j', tokens: [], penalty, optional: true, ...extra })
function junkLps(post, penalty) {
  post.cache ??= new Map()
  const key = 'junk' + penalty
  let out = post.cache.get(key)
  if (out) return out
  const { lp, T } = post
  out = new Float64Array(T)
  for (let t = 0; t < T; t++) {
    const pBlank = Math.exp(lp[t * V + BLANK])
    out[t] = Math.log(pBlank + Math.max(0, 1 - pBlank) * Math.exp(-penalty))
  }
  post.cache.set(key, out)
  return out
}

// The model's vowel tokens (many carry tone marks from other languages),
// grouped by their first sound. "schwa" is a reduced vowel: accepted for any
// vowel, never counted as the wrong one.
const VOWEL_CLASS = { a: [], e: [], i: [], o: [], u: [], schwa: [] }
const FIRST = [
  [/^(a|ɑ|ɐ|æ|ä|ʌ|ɶ)/, 'a'], [/^(e|ɛ)/, 'e'], [/^(i|ɪ|ɨ|ᵻ|y|ʏ)/, 'i'],
  [/^(o|ɔ|ɒ)/, 'o'], [/^(u|ʊ|ɯ|ʉ)/, 'u'], [/^(ə|ɚ|ɜ|ø|œ|ɵ|ɘ|ɞ|ɤ)/, 'schwa'],
]
for (const t of Object.keys(vocab)) {
  // vowels only: no consonant letters (but "ər" and "ɚ" are a reduced vowel)
  if (/[bcdfghjklmnpqrstvwxzðθʃʒɹɡŋʁχħʔ]/.test(t.replace(/^ər/, ''))) continue
  const hit = FIRST.find(([re]) => re.test(t))
  if (hit) VOWEL_CLASS[hit[1]].push(t)
}
const FULL = ['a', 'e', 'i', 'o', 'u']
export const vowelClassTokens = c => VOWEL_CLASS[c]
// Pairs not scored against each other in the main vowel check: a/o, which
// the model can't tell apart ("o-MEN" and "a-MEN" both come out ɑ), and o/u,
// which has a check of its own (`ou` on the unit) with its own cutoff
const NEAR = { a: ['o'], o: ['a', 'u'], u: ['o'] }
// An optional glide after a vowel: tzere "ei", holam "oi"/"ou". Only the lax
// glide sounds, so a plain "i" for tzere ("ITZ" for עֵץ) can't pass as e +
// glide, except where a yod is written after the tzere (אֱלֹהֵינוּ): there
// "ei" is what readers say, and the model often hears its "i" in full.
const GLIDE = { tzere: ['ɪ', 'j'], holam: ['ɪ', 'ʊ', 'j', 'w'], yud: [...VOWEL_CLASS.i, 'j'] }
const VOWELS = Object.values(VOWEL_CLASS).flat()
const vowelTokens = classes => [...classes, 'schwa'].flatMap(c => VOWEL_CLASS[c])
// Model tokens that count as each of our sounds
const CONSONANT = {
  b: set('b', 'bʲ', 'bː'), v: set('v', 'vʲ', 'w', 'β', 'ʋ'),
  k: set('k', 'kʰ', 'kʲ', 'kː', 'q', 'c'), ch: set('x', 'χ', 'xʲ', 'ħ', 'h', 'ç'),
  p: set('p', 'pʰ', 'pʲ', 'pː'), f: set('f', 'fʲ', 'ɸ'),
  t: set('t', 'tʰ', 't̪', 'tʲ', 'tː'), s: set('s', 's̪', 'sʲ', 'sː'), sh: set('ʃ', 'ɕ', 'ʂ', 'ʃʲ'),
  d: set('d', 'dʲ', 'd̪', 'dː'), g: set('ɡ', 'g', 'ɡʲ', 'ɡː'), h: set('h', 'ħ', 'ɦ'), z: set('z', 'ʒ'),
  y: set('j', 'ʝ', 'i'), l: set('l', 'ɫ', 'lː', 'ʎ'), m: set('m', 'mʲ'), n: set('n', 'nʲ', 'ŋ', 'ɲ'),
  r: set('ʁ', 'r', 'ɾ', 'ɹ', 'ɻ', 'ʀ', 'χ', 'ɣ'), ts: set('ts', 'tsʲ', 'tsː', 'ʦ'),
}
// a model without a "ts" symbol (ZIPA) writes it t + s
if (!CONSONANT.ts.length) CONSONANT.ts = set('t', 's')
// ח is never a plain "h" (that's the mistake English speakers make), and ה is
// never the throaty ħ; a soft כ heard as "h" still passes
const LETTER_TOKENS = {
  'ח': CONSONANT.ch.filter(t => !['h', 'ɦ'].includes(t)),
  'ה': CONSONANT.h.filter(t => t !== 'ħ'),
}
// The letter check: each letter against the letters it looks like (ד ר ך,
// ב כ, ה ח ת, ו ז ן, ס ם, ג נ, ט מ) and the sounds English speakers put in
// its place (ח as "h", צ as "s" or "z"). Scoring against every other
// consonant flagged too many correct readings: the model often hears a
// quick ל, ר or י as something else. And not ך against ר: the model hears
// a correct "ch" as a throaty Israeli "r" (a tester's מֵאַרְצְךָ).
const LOOKS_LIKE = {
  'ד': ['r'], 'ר': ['d'], 'ך': ['d'],
  'ב': ['k', 'ch'], 'כ': ['b', 'v'], 'ה': ['ch'], 'ח': ['h', 't'], 'ת': ['ch'],
  'ו': ['z', 'n'], 'ז': ['v', 'n'], 'ן': ['v', 'z'], 'ס': ['m'], 'ם': ['s'],
  'ג': ['n'], 'נ': ['g'], 'ט': ['m'], 'מ': ['t'], 'צ': ['z'], 'ץ': ['z'],
}
// (צ said "s" can't be checked: the model hears a correct "tz" as "s" too,
// in 9 of 12 correct readings on the bench)
const CONSONANT_TOKENS = new Set(Object.values(CONSONANT).flat().filter(t => !VOWELS.includes(t)))
const letterRivals = (u, partner) => (LOOKS_LIKE[u.letter] ?? []).filter(c => c !== u.sound && c !== partner && !u.alsoSounds.includes(c))
const rivalTokens = (u, classes) => [...new Set(classes.flatMap(c => CONSONANT[c]))].filter(t => CONSONANT_TOKENS.has(t) && !u.tokens.includes(t))
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
    const fullVowels = segments.filter(x => x.vowel && x.atom.vowel !== 'sheva').length
    segments.forEach((seg, k) => {
      const a = seg.atom
      const c = seg.consonant
      const last = k === segments.length - 1
      const consonantUnit = c && CONSONANT[c] && {
        kind: 'c', sound: c, tokens: [...new Set([...(LETTER_TOKENS[a.letter] ?? CONSONANT[c]), ...(seg.altConsonants ?? []).flatMap(k => CONSONANT[k] ?? [])])],
        alsoSounds: seg.altConsonants ?? [],
        word, wi, letter: a.letter, atomIndex: seg.atomIndex,
        test: testedLetter(a, c),
        nach: seg.shevaType === 'nach' && !a.isFinal,
        // a written sheva on the last letter (אַתְּ, לֵךְ): "A-ta", "LE-cheh" read
        // it as a vowel. Not on a last letter with no sheva (קוּם, גָּדוֹל): there
        // the model hears a full "m" or "l" released ("koom-uh"), or background
        // noise, as a vowel (11 correct bench takes, the user listened).
        silentEnd: last && a.vowel === 'sheva' && !seg.vowel && !seg.patachGenuvah,
        // ־ָיו is "av" (עָלָיו "a-LAV"), not "a-LAI-yoo"
        avEnding: last && a.letter === 'ו' && c === 'v' && /\u05B8[\u0591-\u05AF\u05BD]*י[\u0591-\u05AF\u05BD]*ו[\u0591-\u05AF\u05BD]*$/.test(word.replace(/־$/, '')),
      }
      const where = { word, wi, letter: a.letter, atomIndex: seg.atomIndex }
      const vowelUnit = seg.vowel && vowelUnitFor(seg, where, segments[k + 1]?.consonant, segments[k - 1]?.shevaType === 'nach', fullVowels, k === segments.length - 1 || segments.slice(k + 1).every(x => !x.vowel))
      const glideTokens = seg.vowel && (a.yudAfter ? GLIDE.yud : GLIDE[a.vowel])
      const glide = glideTokens && { kind: 'g', tokens: glideTokens.filter(has), ...where, optional: true }
      if (seg.patachGenuvah && vowelUnit) vowelUnit.genuvah = true
      const ordered = seg.patachGenuvah ? [vowelUnit, consonantUnit] : [consonantUnit, vowelUnit, glide]
      units.push(...ordered.filter(Boolean))
    })
  })
  return settings.junk === false ? units : withJunk(units)
}

// Optional junk before, between and after the words, so a false start, an
// "um" or a restart is set aside rather than graded as the word
const JUNK_PENALTY = +(process.env.PHONEME_JUNK ?? 2)
function withJunk(units) {
  if (!JUNK_PENALTY) return units
  const out = [junkUnit(JUNK_PENALTY)]
  units.forEach((u, i) => { out.push(u); if (units[i + 1]?.wi !== u.wi) out.push(junkUnit(JUNK_PENALTY)) })
  return out
}

// Can a sheva na be left out entirely, so the letters run together ("shma"
// for שְׁמַע, "breishit", "vha" for וְהַ)? Not when the first letter can't
// lead a cluster (לְךָ: some vowel is always there, so a missing one means it
// was said too short), and not after a sheva nach (וּמִמּוֹלַדְתְּךָ): that
// letter opens its own syllable whatever happens, and a hard t's release is
// heard like a vowel, so it can be short but not left out.
const STOPS = new Set(['b', 'p', 'k', 'g', 'd', 't'])
// one-letter prefixes: ו "and", ה "the", ל "to", ב "in", כ "like", מ "from", ש "that"
const PREFIX = new Set(['ו', 'ה', 'ל', 'ב', 'כ', 'מ', 'ש'])
const CAN_LEAD = new Set(['b', 'v', 'p', 'f', 'k', 'ch', 'g', 'd', 't', 's', 'sh', 'z', 'ts'])
const clusters = (c1, c2, afterNach) => !afterNach && CAN_LEAD.has(c1) && !!c2 && c1 !== c2

function vowelUnitFor(seg, where, nextConsonant, afterNach, fullVowels, lastVowel) {
  const nikkud = seg.atom.vowel
  // a chataf is short and may be swallowed, except on a silent letter (א, ע),
  // where it is the whole syllable (אֲנִי "a-ni")
  const optional = seg.altVowels.includes('') || (nikkud.startsWith('hataf') && !!seg.consonant)
  // Sheva na: any vowel counts as saying it; the test is whether it was said,
  // where it could have been left out
  if (nikkud === 'sheva') {
    return {
      kind: 'v', sound: 'e', tokens: VOWELS, ...where, optional: true,
      vowelTest: seg.shevaType === 'na' ? 'sheva-na' : null, canCluster: clusters(seg.consonant, nextConsonant, afterNach),
      // a stop released into ה, א or ע (תְהוֹם "te-hom"): the release is the
      // sheva, so a small trace of vowel is enough
      releasedStop: STOPS.has(seg.consonant) && (nextConsonant === 'h' || nextConsonant === ''),
    }
  }
  // A tzere before a written yod in a longer word (אֱלֹהֵינוּ): the model hears
  // a fluent "ei" there as "ee" (the user listened: every take flagged was a
  // clear "Elokeinu"), so "ee" passes. In a one-syllable word (בֵּית) the "ei"
  // is long and the model hears it, so "BIT" is still a mistake.
  const eiAsEe = nikkud === 'tzere' && seg.atom.yudAfter && fullVowels > 1 ? ['i'] : []
  // A segol right before a "ch" (לֶךְ "lech"): the throaty sound pulls the
  // vowel toward "a", and the model hears "lach" (3 compare takes the user
  // marked as fine). Before other letters (אֶל "el" read "al") it stays strict.
  const eBeforeCh = nikkud === 'segol' && nextConsonant === 'ch' ? ['a'] : []
  const accepted = [...new Set([seg.vowel, ...seg.altVowels, ...eiAsEe, ...eBeforeCh].filter(v => FULL.includes(v)))]
  return {
    kind: 'v', sound: seg.vowel, tokens: vowelTokens(accepted), ...where, optional,
    vowelTest: nikkud, accepted, rivals: FULL.filter(v => !accepted.includes(v) && !accepted.some(a => NEAR[a]?.includes(v))),
    ou: ouPartner(seg, accepted, where.word),
    // The final kamatz of ־ךָ can be checked for being left out ("lekh" for
    // לְךָ, "avikh" for אָבִיךָ): a tester's Ashkenazic reading dropped it four
    // times. Elsewhere a short, clearly said vowel often scores as low, so
    // other vowels aren't checked for this.
    missable: !optional && lastVowel && nikkud === 'qamats' && seg.atom.letter === 'ך',
  }
}

// o vs u (וֹ/וּ, the vowels students confuse most): the other one, if this
// vowel is scored for it. Not in two unstressed spots readers soften: the
// prefix וּ "u-" ("and"), and the final וּ of ־ֵינוּ (אֱלֹהֵינוּ, said "-no").
function ouPartner(seg, accepted, word) {
  if (accepted.length !== 1 || !['o', 'u'].includes(accepted[0])) return null
  const a = seg.atom
  if (a.vowel === 'shuruk' && a.letter === 'ו' && seg.atomIndex === 0) return null
  if (a.vowel === 'shuruk' && a.isFinal && /ינוּ־?$/.test(word)) return null
  return accepted[0] === 'o' ? 'u' : 'o'
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
  const cls = units.map((u, k) => u.kind === 'j' ? junkLps(post, u.penalty) : classLps(post, ids[k]))
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
// the same, counting only full vowels (not a reduced "uh")
const FULL_IDS = FULL.flatMap(v => VOWEL_CLASS[v]).map(t => vocab[t])
const fullVowelMass = ({ lp }, t) => FULL_IDS.reduce((sum, id) => sum + Math.exp(lp[t * V + id]), 0)
// how far after a word's last letter an added vowel is looked for (0.3 s)
const END_FRAMES = 15

// A sheva na must be heard (shevas enforced). A short one often gets no spike
// of its own but leaves a trace of vowel; with no trace at all, the letters
// ran together. Bench round 1: clearly said 0.67–0.98, short 0.12–0.34, left
// out ≤ 0.03. The trace decides when the alignment disagrees: in יְדֵי the
// model hears "ye" as an "i" and gives it to the yod.
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

// What was heard where a word should be: the word replaced by required junk,
// and the model's unaided sounds between the words on either side
function heardInstead(post, units, w) {
  const first = units.findIndex(u => u.wi === w && u.kind !== 'j'), last = units.findLastIndex(u => u.wi === w && u.kind !== 'j')
  const rep = [...units.slice(0, first), junkUnit(JUNK_PENALTY || 2, { optional: false }), ...units.slice(last + 1)]
  const { spans } = align(post, rep)
  const before = spans.slice(0, first).findLast((sp, k) => sp && rep[k].kind !== 'j')
  const after = spans.slice(first + 1).find((sp, k) => sp && rep[first + 1 + k].kind !== 'j')
  return heardSounds(post, before ? before[1] : 0, after ? after[0] : post.T)
}

// Share of a word's sounds that differ from what was heard (edit distance;
// optional sounds and h drop free, two different vowels cost half). Each
// vowel counts as its usual sound, not the extra ones grading accepts (a
// segol before "ch" also passing as "a"): those are for judging a sound, and
// shouldn't make another word look like this one.
function soundDistance(units, heard) {
  const exp = units.map(u => ({ sounds: u.kind === 'v' ? (u.accepted ? [u.sound] : FULL) : [u.sound], optional: !!u.optional || u.sound === 'h' }))
  const isV = x => FULL.includes(x)
  const n = exp.length, m = heard.length, d = Array.from({ length: n + 1 }, () => new Float64Array(m + 1))
  for (let i = 1; i <= n; i++) d[i][0] = d[i - 1][0] + (exp[i - 1].optional ? 0 : 1)
  for (let j = 1; j <= m; j++) d[0][j] = j
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const e = exp[i - 1], h = heard[j - 1]
    const sub = e.sounds.includes(h) ? 0 : isV(e.sounds[0]) && isV(h) ? 0.5 : 1
    d[i][j] = Math.min(d[i - 1][j - 1] + sub, d[i - 1][j] + (e.optional ? 0 : 1), d[i][j - 1] + 1)
  }
  return d[n][m] / Math.max(1, exp.filter(e => !e.optional).length)
}

// Cutoffs, tuned per model on the bench takes (rounds 1–2, with the sheva na
// flags the user confirmed by ear counted as real).
//   consonant, vowel, vowel-ou, vowel-missing, sheva-nach: flag a score below
//            this (vowel-missing: the compare takes' dropped ־ךָ endings −7.9 to
//            −4.8; correctly said endings on the bench, 3 of 33 below −4)
//   said:    a sheva na needs at least this much vowel trace to count as said
//            (saidAfterStop: on a stop before ה/א/ע; the user's clear "te-hom"
//            for תְהוֹם had 0.35)
//   some:    below this trace, with letters that can cluster, it was left out
//   skipped: a word whose verse fits this much better without it was left out
//            (round 3: the two skipped words −47, read words down to −28;
//            not yet tuned for ZIPA)
//   unclear: a word that fits this much worse than junk doesn't sound like
//            itself: "unclear" if hardly anything was heard there (cut off,
//            whispered), "wrong word" if what was heard differs from it in at
//            least `different` of its sounds (round 3: "gadol" for אֶחָד, 1.0;
//            one-sound mistakes up to 0.79)
//   (a sheva heard as a reduced "ə" counts as said: that's how a natural
//   sheva na sounds. Flagging it as short, from three deliberate "left out"
//   takes that came out ə, flagged the user's natural verse readings.)
const CUTOFFS = {
  xlsr: { letter: -3, syllable: -6.5, order: -1, 'end-vowel': 0.6, ending: -1, consonant: 0, vowel: -2.2, 'vowel-ou': -1, 'vowel-missing': -4.5, 'sheva-nach': -2.5, said: 0.6, saidAfterStop: 0.2, some: 0.1, skipped: -35, unclear: -5, different: 0.9 },
  zipa: { letter: -3, syllable: -6.5, order: -1, 'end-vowel': 0.6, ending: -1, consonant: -1, vowel: -2.5, 'vowel-ou': -2, 'vowel-missing': -4.5, 'sheva-nach': -1.5, said: 0.6, saidAfterStop: 0.2, some: 0.1, skipped: -35, unclear: -5, different: 0.9 },
}
export const FLAG_BELOW = CUTOFFS[MODEL_NAME.startsWith('zipa') ? 'zipa' : 'xlsr']

// A sheva na must be heard (shevas enforced). A short one often gets no spike
// of its own but leaves a trace of vowel; with no trace at all, the letters
// ran together. The trace decides, not the alignment: in יְדֵי the model hears
// "ye" as an "i" and gives it to the yod.
function shevaNaVerdict(trace, canCluster, releasedStop) {
  if (trace >= (releasedStop ? FLAG_BELOW.saidAfterStop : FLAG_BELOW.said)) return 'said'
  return trace >= FLAG_BELOW.some || !canCluster ? 'short' : 'left out'
}
export const isFlagged = s => ['word', 'syllable'].includes(s.kind) || (s.kind === 'sheva-na' ? s.partner !== 'said' : s.kind === 'end-vowel' ? s.trace >= FLAG_BELOW['end-vowel'] : s.llr < FLAG_BELOW[s.kind])

// Score each tested sound against what a reader might say instead. Each test
// re-aligns the whole verse with one unit changed, so the comparison is a
// likelihood ratio over the best timing for each. Negative = the alternative
// fits better, i.e. the reader likely said it.
//   consonant   the written sound vs its partner (sh/s, b/v, k/kh, p/f, t/s)
//   vowel       the accepted vowels vs all the others together
//   vowel-ou    o vs u
//   vowel-missing  the final kamatz of ־ךָ said vs left out
//   sheva-na    said vs left out, then said / short / left out (shevaNaVerdict)
//   sheva-nach  silent vs a vowel added after the letter
//   word        a word left out (then none of its sounds are scored)
export function scoreContrasts(post, units, base = align(post, units)) {
  const out = []
  // Words first. A skipped word: the verse fits far better without it. It's
  // taken out (one at a time, worst first) before anything else is scored, so
  // its sounds aren't squeezed into its neighbours. Then a word that still fits
  // much worse than junk doesn't sound like itself: a different word, or too
  // unclear to grade. Neither has its sounds graded.
  const wordsOf = us => [...new Set(us.filter(u => u.kind !== 'j').map(u => u.wi))]
  const without = (us, w) => us.filter(u => u.kind === 'j' || u.wi !== w)
  const skipped = new Set(), unclear = new Set()
  if (wordsOf(units).length > 1) {
    for (;;) {
      const score = align(post, units).score
      const worst = wordsOf(units).map(w => [w, score - align(post, without(units, w)).score]).sort((a, b) => a[1] - b[1])[0]
      if (!worst || worst[1] >= FLAG_BELOW.skipped || wordsOf(units).length < 2) break
      skipped.add(worst[0])
      out.push({ i: -1, wi: worst[0], letter: '', word: units.find(u => u.wi === worst[0]).word, kind: 'word', test: 'skipped', expected: 'said', partner: 'left out', llr: worst[1] })
      units = without(units, worst[0])
    }
    base = align(post, units)
    for (const w of wordsOf(units)) {
      const llr = base.score - align(post, without(units, w)).score
      if (llr >= FLAG_BELOW.unclear) continue
      const heard = heardInstead(post, units, w)
      const differs = soundDistance(units.filter(u => u.wi === w && u.kind !== 'j' && u.kind !== 'g'), heard)
      const test = heard.length < 2 ? 'unclear' : differs >= FLAG_BELOW.different ? 'wrong word' : null
      if (!test) continue
      unclear.add(w)
      out.push({ i: -1, wi: w, letter: '', word: units.find(u => u.wi === w).word, kind: 'word', test, expected: 'said', partner: heard.join(''), llr })
    }
  }
  // Then syllables: one left out ("sha-MA-yim" for הַשָּׁמַיִם, "va-yish-ta-VOO"
  // for וַיִּשְׁתַּחֲווּ) fits far better without its sounds. Taken out the same
  // way, worst first, so they aren't graded as wrong sounds.
  const syllables = us => {
    const keys = new Map()
    for (const u of us) {
      if (u.kind === 'j' || unclear.has(u.wi)) continue
      const key = `${u.wi}:${u.atomIndex}`
      if (!keys.has(key)) keys.set(key, { wi: u.wi, atomIndex: u.atomIndex, units: [] })
      keys.get(key).units.push(u)
    }
    // syllables with a vowel (a letter alone at the end isn't one), in words
    // with two or more
    const all = [...keys.values()].filter(x => x.units.some(u => u.kind === 'v'))
    return all.filter(x => all.filter(y => y.wi === x.wi).length > 1 && !mergesBack(us, x))
  }
  // A syllable with no real letter of its own (א, ע, ה, a ו "u", a yod between
  // vowels) right after a vowel runs into it in fluent reading: "ha-A-retz"
  // is said "haaretz", "ra-EL" "rael", "e-lo-KEI-nu ha-SHEM" "elokeinoshem".
  // The model hears one vowel, so it can't tell either syllable from one left
  // out. So "A-retz" for לָאָרֶץ isn't caught: "la-" and "a-" are one long
  // "a" either way. (Judging "la-" by its ל instead caught it, but flagged
  // three correct readings for each one caught.)
  const mergesBack = (us, x) => {
    const c = x.units.find(u => u.kind === 'c')
    if (c && !['h', 'y'].includes(c.sound)) return false
    const before = us.slice(0, us.indexOf(x.units[0])).findLast(u => u.kind !== 'j')
    return !!before && ['v', 'g'].includes(before.kind)
  }
  const dropSyllable = (us, x) => us.filter(u => u.kind === 'j' || u.wi !== x.wi || u.atomIndex !== x.atomIndex)
  // Said, as far as the evidence goes: its vowel there (a quiet ה or a soft
  // final letter the model barely hears isn't a missing syllable); with only a
  // sheva, its letter there
  const keepSyllable = (us, x) => us.map(u => u.wi === x.wi && u.atomIndex === x.atomIndex && u.kind === 'c' && x.units.some(v => v.kind === 'v' && !v.optional) ? { ...u, optional: true } : u)
  for (;;) {
    const worst = syllables(units).map(x => [x, align(post, keepSyllable(units, x)).score - align(post, dropSyllable(units, x)).score]).sort((a, b) => a[1] - b[1])[0]
    if (!worst || worst[1] >= FLAG_BELOW.syllable) break
    const [x, llr] = worst, first = x.units[0]
    const isPrefix = x.atomIndex === Math.min(...units.filter(u => u.wi === x.wi && u.kind !== 'j').map(u => u.atomIndex)) && PREFIX.has(first.letter)
    out.push({ i: -1, wi: x.wi, letter: first.letter, word: first.word, kind: 'syllable', test: isPrefix ? 'prefix left out' : 'syllable left out', expected: x.units.filter(u => u.kind !== 'g').map(u => u.sound).join(''), partner: 'left out', llr })
    units = dropSyllable(units, x)
  }
  base = align(post, units)

  const swap = (i, change) => align(post, units.map((x, j) => j === i ? { ...x, ...change } : x))
  const replace = (i, n, ...instead) => align(post, [...units.slice(0, i), ...instead, ...units.slice(i + n)])
  units.forEach((u, i) => {
    if (u.kind === 'j' || unclear.has(u.wi)) return
    const at = { i, wi: u.wi, letter: u.letter, word: u.word, span: base.spans[i] }
    const partner = u.test && (u.test === 'sav' ? 't' : PARTNER[u.sound])
    if (u.test) {
      out.push({ ...at, kind: 'consonant', test: u.test, expected: u.sound, partner, llr: base.score - swap(i, { tokens: CONSONANT[partner] }).score })
    }
    if (u.kind === 'c' && letterRivals(u, partner).length) {
      // every letter against all the others (a look-alike letter: ד for ר,
      // ס for ם; ח said "h", צ said "s" or "z")
      const rivals = letterRivals(u, partner)
      const llr = base.score - swap(i, { tokens: rivalTokens(u, rivals) }).score
      const heard = llr < 0 ? rivals.map(c => [c, swap(i, { tokens: rivalTokens(u, [c]) }).score]).sort((a, b) => b[1] - a[1])[0][0] : rivals.join('/')
      out.push({ ...at, kind: 'letter', test: u.letter, expected: u.sound, partner: heard, llr })
    }
    if (u.genuvah && units[i + 1]?.kind === 'c') {
      // patach genuvah: the "a" before the letter (רוּחַ "ROO-ach", not "ROO-cha")
      const llr = base.score - replace(i, 2, units[i + 1], u).score
      out.push({ ...at, kind: 'order', test: 'patach genuvah', expected: `${u.sound}${units[i + 1].sound}`, partner: `${units[i + 1].sound}${u.sound}`, llr })
    }
    const nextWord = units.slice(i + 1).find(x => x.kind !== 'j')
    // (not before a word starting with a vowel or ה: it runs straight on,
    // "el ha-A-retz a-SHER", so its vowel can't be told from one added)
    if (u.silentEnd && !(nextWord && (nextWord.kind === 'v' || nextWord.sound === 'h'))) {
      // a full vowel added after the last letter ("A-ta" for אַתְּ); a reduced
      // "uh" release doesn't count
      const llr = base.score - replace(i + 1, 0, { kind: 'v', tokens: FULL.flatMap(v => VOWEL_CLASS[v]), word: u.word }).score
      const from = base.spans[i]?.[1] ?? 0
      const next = base.spans.findIndex((sp, j) => j > i && sp && units[j].kind !== 'j')
      const to = Math.min(from + END_FRAMES, next < 0 ? post.T : base.spans[next][0])
      let trace = 0
      for (let t = from; t < to; t++) trace = Math.max(trace, fullVowelMass(post, t))
      out.push({ ...at, kind: 'end-vowel', test: 'vowel added at the end', expected: 'silent', partner: 'a vowel', llr, trace })
    }
    if (u.avEnding) {
      // ־ָיו read "-ai-yoo"
      const llr = base.score - replace(i, 1, { kind: 'v', tokens: [...new Set([...VOWEL_CLASS.i, 'j'].filter(has))], optional: true, word: u.word }, { kind: 'v', tokens: VOWEL_CLASS.u, word: u.word }).score
      out.push({ ...at, kind: 'ending', test: '-av ending', expected: 'av', partner: 'ayu', llr })
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
      out.push({ ...at, kind: 'sheva-na', test: 'sheva-na', expected: 'said', partner: shevaNaVerdict(trace, u.canCluster, u.releasedStop), llr, trace, heardAs })
    } else if (u.vowelTest && u.rivals.length) {
      const alt = swap(i, { tokens: u.rivals.flatMap(v => VOWEL_CLASS[v]) })
      const llr = base.score - alt.score
      // name the vowel that fits best, for the message
      const partner = llr < 0 ? u.rivals.map(v => [v, swap(i, { tokens: VOWEL_CLASS[v] }).score]).sort((a, b) => b[1] - a[1])[0][0] : u.rivals.join('/')
      out.push({ ...at, kind: 'vowel', test: u.vowelTest, expected: u.accepted.join('/'), partner, llr })
    }
    if (u.missable) {
      const llr = base.score - align(post, units.filter((_, j) => j !== i)).score
      out.push({ ...at, kind: 'vowel-missing', test: u.vowelTest, expected: u.accepted.join('/'), partner: 'left out', llr })
    }
    if (u.ou) {
      const llr = base.score - swap(i, { tokens: vowelTokens([u.ou]) }).score
      out.push({ ...at, kind: 'vowel-ou', test: u.vowelTest, expected: u.accepted[0], partner: u.ou, llr })
    }
    if (u.nach) {
      const added = align(post, [...units.slice(0, i + 1), { kind: 'v', tokens: VOWELS, word: u.word }, ...units.slice(i + 1)]).score
      out.push({ ...at, kind: 'sheva-nach', test: 'sheva-nach', expected: 'silent', partner: 'a vowel', llr: base.score - added })
    }
  })
  return out
}
