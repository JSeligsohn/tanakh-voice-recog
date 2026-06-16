// Programmatic Hebrew pronunciation rules engine.
// Replaces LLM-based scoring with deterministic rule application.
//
// Pipeline: Hebrew word with nikud → atoms → expected phonetic (per tradition)
// The scoring layer then aligns student's transcription against this expected
// phonetic and flags mismatches per atom.

// ── Unicode constants ────────────────────────────────────────────────

const SHEVA          = 'ְ'
const HATAF_SEGOL    = 'ֱ'
const HATAF_PATAH    = 'ֲ'
const HATAF_QAMATS   = 'ֳ'
const HIRIQ          = 'ִ'
const TZERE          = 'ֵ'
const SEGOL          = 'ֶ'
const PATAH          = 'ַ'
const QAMATS         = 'ָ'
const HOLAM          = 'ֹ'
const HOLAM_VAV      = 'ֺ'
const QUBUTS         = 'ֻ'
const DAGESH_MAPPIQ  = 'ּ'
const MAQEF          = '־'
const SHIN_DOT       = 'ׁ'
const SIN_DOT        = 'ׂ'

const VOWEL_NAME = {
  [SHEVA]:        'sheva',
  [HATAF_SEGOL]:  'hataf-segol',
  [HATAF_PATAH]:  'hataf-patah',
  [HATAF_QAMATS]: 'hataf-qamats',
  [HIRIQ]:        'hiriq',
  [TZERE]:        'tzere',
  [SEGOL]:        'segol',
  [PATAH]:        'patah',
  [QAMATS]:       'qamats',
  [HOLAM]:        'holam',
  [HOLAM_VAV]:    'holam',
  [QUBUTS]:       'qubuts',
}

// Vowels that count as "long" for sheva-na detection (S2 rule)
const LONG_VOWELS = new Set(['qamats', 'tzere', 'holam', 'shuruk'])

// ── Tokenizer ────────────────────────────────────────────────────────
// Parses a Hebrew word into atoms: { letter, vowel, dagesh, shinDot, sinDot, isFinal }

export function tokenizeWord(word) {
  const raw = []
  let current = null

  for (const char of word) {
    const code = char.codePointAt(0)
    // Skip cantillation marks (U+0591–U+05AF)
    if (code >= 0x0591 && code <= 0x05AF) continue
    // Skip meteg/rafe and maqef
    if (code === 0x05BD || char === MAQEF) continue

    // Base consonant (U+05D0–U+05EA)
    if (code >= 0x05D0 && code <= 0x05EA) {
      if (current) raw.push(current)
      current = { letter: char, vowel: null, dagesh: false, shinDot: false, sinDot: false, isFinal: false }
      continue
    }

    if (!current) continue
    if (char === DAGESH_MAPPIQ) { current.dagesh = true; continue }
    if (char === SHIN_DOT)      { current.shinDot = true; continue }
    if (char === SIN_DOT)       { current.sinDot = true; continue }
    const vName = VOWEL_NAME[char]
    if (vName) { current.vowel = vName; continue }
  }
  if (current) raw.push(current)

  return mergeVowelCarriers(raw)
}

// Vav and yud sometimes function as vowel markers, not standalone consonants.
// We collapse them into the preceding atom's vowel for accurate phonetics.
function mergeVowelCarriers(atoms) {
  const out = []

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i]
    const prev = out[out.length - 1]

    // Shuruk: ו with dagesh (looks like וּ), acts as 'u' vowel for previous atom
    if (a.letter === 'ו' && a.dagesh && !a.vowel) {
      if (prev && !prev.vowel) { prev.vowel = 'shuruk'; continue }
      // Standalone shuruk (no carrier) — keep as-is, will read as 'u'
      a.vowel = 'shuruk'
      a.dagesh = false
      out.push(a)
      continue
    }

    // Cholam malei: ו with cholam mark, becomes the cholam vowel for previous atom
    if (a.letter === 'ו' && a.vowel === 'holam' && !a.dagesh) {
      if (prev && !prev.vowel) { prev.vowel = 'holam'; continue }
    }

    // Chirik malei: י with no vowel of its own, after a letter with chirik
    if (a.letter === 'י' && !a.vowel && !a.dagesh && prev?.vowel === 'hiriq') {
      continue // silent yud, part of chirik malei
    }

    // Tzere malei: י with no vowel after a letter with tzere
    if (a.letter === 'י' && !a.vowel && !a.dagesh && prev?.vowel === 'tzere') {
      continue
    }

    out.push(a)
  }

  if (out.length > 0) out[out.length - 1].isFinal = true
  return out
}

// ── Sheva analysis ───────────────────────────────────────────────────

export function determineShevaType(atoms, index) {
  const atom = atoms[index]
  if (atom.vowel !== 'sheva') return null

  // S1: start of word
  if (index === 0) return 'na'
  // S5: end of word
  if (index === atoms.length - 1) return 'nach'

  const prev = atoms[index - 1]
  const next = atoms[index + 1]

  // S6: two consecutive shevas — first nach, second na
  if (next?.vowel === 'sheva') return 'nach'
  if (prev?.vowel === 'sheva') return 'na'

  // S4: under the first of two identical consecutive letters
  if (prev?.letter === atom.letter) return 'na'

  // S2: after a long vowel
  if (LONG_VOWELS.has(prev?.vowel)) return 'na'

  // S3 (default): after short vowel in middle = nach
  return 'nach'
}

// ── Expected-phonetic generator ──────────────────────────────────────
// Returns { segments, fullPhonetic }
// Each segment captures one atom's contribution: { atomIndex, atom, consonant, vowel, sound, shevaType }
// `sound` is the canonical Latin-letter representation we'll match the
// transcription against (e.g. "sh", "a", "b", "e" for sheva-na).

export function getExpectedPhonetic(atoms, { tradition = 'sephardic', shevaMode = 'enforce' } = {}) {
  const segments = atoms.map((atom, i) => {
    const consonant = consonantSound(atom, atoms, i, tradition)
    const { vowel, shevaType } = vowelSound(atom, atoms, i, tradition, shevaMode)
    return { atomIndex: i, atom, consonant, vowel, shevaType, sound: consonant + vowel }
  })
  return { segments, fullPhonetic: segments.map(s => s.sound).join('') }
}

function consonantSound(atom, atoms, index, tradition) {
  const L = atom.letter

  // Silent final ה without mappiq
  if (L === 'ה' && atom.isFinal && !atom.dagesh && !atom.vowel) return ''
  // ה with mappiq → audible 'h' even at end
  if (L === 'ה' && atom.dagesh) return 'h'

  // Vav functioning as a vowel carrier (shuruk "oo" or cholam "oh") — silent.
  // The 'u' or 'o' sound is produced by vowelSound, not consonantSound.
  if (L === 'ו' && (atom.vowel === 'shuruk' || atom.vowel === 'holam')) return ''

  // Shin vs Sin determined by dot placement
  if (L === 'ש') {
    if (atom.sinDot) return 's'
    return 'sh' // default to shin (right dot or unmarked)
  }

  // Tav: tradition-dependent when no dagesh
  if (L === 'ת') {
    if (atom.dagesh) return 't'
    return tradition === 'ashkenazic' ? 's' : 't'
  }

  // BGD-KPT with dagesh kal
  if (L === 'ב') return atom.dagesh ? 'b' : 'v'
  if (L === 'כ' || L === 'ך') return atom.dagesh ? 'k' : 'ch'
  if (L === 'פ' || L === 'ף') return atom.dagesh ? 'p' : 'f'

  const MAP = {
    'א': '', 'ע': '',
    'ה': 'h', 'ג': 'g', 'ד': 'd',
    'ו': 'v', 'ז': 'z', 'ח': 'ch', 'ט': 't',
    'י': 'y', 'ל': 'l',
    'מ': 'm', 'ם': 'm',
    'נ': 'n', 'ן': 'n',
    'ס': 's', 'צ': 'ts', 'ץ': 'ts',
    'ק': 'k', 'ר': 'r',
  }
  return MAP[L] ?? ''
}

function vowelSound(atom, atoms, index, tradition, shevaMode) {
  const v = atom.vowel
  if (!v) return { vowel: '', shevaType: null }

  // Sheva — depends on position
  if (v === 'sheva') {
    if (shevaMode === 'ignore') return { vowel: '', shevaType: null }
    const type = determineShevaType(atoms, index)
    return { vowel: type === 'na' ? 'e' : '', shevaType: type }
  }

  // Tradition-dependent vowels (option c): only differentiate when the dialect
  // actually distinguishes them acoustically. In Sephardic, patach/kamatz are
  // both "a" — we don't enforce a difference. In Ashkenazic, kamatz becomes "o".
  const MAP_SEPH = {
    'patah':         'a',
    'qamats':        'a',
    'tzere':         'e',
    'segol':         'e',
    'hiriq':         'i',
    'holam':         'o',
    'shuruk':        'u',
    'qubuts':        'u',
    'hataf-segol':   'e',
    'hataf-patah':   'a',
    'hataf-qamats':  'a',
  }
  // Ashkenazic vowel preferences vary widely by region (Lithuanian, German,
  // Polish, American). We aim for the Modern American Ashkenazic baseline used
  // in most US Hebrew schools: kamatz "o" (vs Seph "a"), but accept "oh" for
  // cholam and "e" for tzere as common variants. Strict enforcement is only
  // applied where the dialect distinction is clearly audible (kamatz, tav).
  const MAP_ASHK = {
    'patah':         'a',
    'qamats':        'o',   // distinct from patach — enforced
    'tzere':         'e',   // accept "e" or "ay" — use "e" as canonical
    'segol':         'e',
    'hiriq':         'i',
    'holam':         'o',   // accept "o" or "oy" — use "o" as canonical
    'shuruk':        'u',
    'qubuts':        'u',
    'hataf-segol':   'e',
    'hataf-patah':   'a',
    'hataf-qamats':  'o',
  }
  const map = tradition === 'ashkenazic' ? MAP_ASHK : MAP_SEPH
  return { vowel: map[v] ?? '', shevaType: null }
}
