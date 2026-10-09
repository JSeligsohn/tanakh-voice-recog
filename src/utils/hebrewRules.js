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
const QAMATS_QATAN   = '\u05C7' // dedicated qamats katan sign used by some editions
const METEG          = '\u05BD'
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
  [QAMATS_QATAN]:  'qamats',
  [HOLAM]:        'holam',
  [HOLAM_VAV]:    'holam',
  [QUBUTS]:       'qubuts',
}

// Vowels that count as "long" for sheva-na detection (S2 rule)
const LONG_VOWELS = new Set(['qamats', 'tzere', 'holam', 'shuruk'])

// ── Tokenizer ────────────────────────────────────────────────────────
// Parses a Hebrew word into atoms: { letter, vowel, dagesh, shinDot, sinDot, isFinal }
//
// Maqef-joined words (אֶל־אַבְרָם) are tokenized one component at a time so each
// component keeps its own word-start and word-end: `wordStart` marks the first
// atom of every component, `isFinal` the last, and `beforeMaqef` the last atom
// of every component except the final one.

export function tokenizeWord(word) {
  const parts = word.split(MAQEF).filter(Boolean)
  return parts.flatMap((part, pi) => {
    const atoms = tokenizeComponent(part)
    if (atoms.length > 0) {
      atoms[0].wordStart = true
      if (pi < parts.length - 1) atoms[atoms.length - 1].beforeMaqef = true
    }
    return atoms
  })
}

function tokenizeComponent(word) {
  const raw = []
  let current = null

  for (const char of word) {
    const code = char.codePointAt(0)
    // Skip cantillation marks (U+0591–U+05AF)
    if (code >= 0x0591 && code <= 0x05AF) continue

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
    if (char === METEG)         { current.meteg = true; continue }
    if (char === QAMATS_QATAN)  { current.vowel = 'qamats'; current.qamatsKatanMark = true; continue }
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

  // S1: start of word (or of a maqef component)
  if (index === 0 || atom.wordStart) return 'na'
  // S5: end of word (or of a maqef component)
  if (index === atoms.length - 1 || atom.isFinal) return 'nach'

  const prev = atoms[index - 1]
  const next = atoms[index + 1]

  // S6: two consecutive shevas — first nach, second na
  if (next?.vowel === 'sheva') return 'nach'
  if (prev?.vowel === 'sheva') return 'na'

  // S4: under the first of two identical consecutive letters (הִנְנִי "hineni")
  if (next?.letter === atom.letter) return 'na'

  // After a qamats the sheva follows the qamats type: katan closes the syllable
  // (חָכְמָה "chochma" — nach); without a meteg we can't tell, so either is fine.
  if (prev?.vowel === 'qamats') {
    const qType = determineQamatsType(atoms, index - 1)
    if (qType === 'katan') return 'nach'
    if (qType === 'ambiguous') return 'either'
  }

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
    // altVowels: other readings accepted without penalty (lenient grading)
    const { vowel, shevaType, qamatsType = null, altVowels = [] } = vowelSound(atom, atoms, i, tradition, shevaMode)
    const seg = { atomIndex: i, atom, consonant, vowel, shevaType, qamatsType, altVowels }
    // Patach genuvah: the "a" is sounded before the final guttural (רוּחַ "ruach")
    if (isPatachGenuvah(atom)) return { ...seg, patachGenuvah: true, sound: vowel + consonant }
    return { ...seg, sound: consonant + vowel }
  })
  return { segments, fullPhonetic: segments.map(s => s.sound).join('') }
}

// Patach under a word-final ח, ע, or הּ (with mappiq) is a "stolen" patach: it
// is read before the consonant, not after it (רוּחַ "ruach", שָׂמֵחַ "sameach",
// גָּבֹהַּ "gavoah").
function isPatachGenuvah(atom) {
  if (!atom.isFinal || atom.wordStart || atom.vowel !== 'patah') return false
  return atom.letter === 'ח' || atom.letter === 'ע' || (atom.letter === 'ה' && atom.dagesh)
}

// ── Qamats analysis ──────────────────────────────────────────────────
// Qamats gadol ("a" in Sephardic) and qamats katan (short "o") share one sign.
// Katan is a qamats in a CLOSED, UNSTRESSED syllable. We don't track stress, and
// our texts have no meteg, so we apply the rules we can see in the letters:
//
//   QK0  explicit qamats katan sign (U+05C7)                → katan
//   QK0' meteg on the qamats (marks an open syllable)       → gadol
//   QK1  closed by a mid-word sheva (חָכְמָה / שָׁמְרוּ)      → ambiguous: the
//        same spelling is katan + sheva nach ("chochma") or gadol + sheva na
//        ("shamru"); only a meteg tells them apart
//   QK2  closed syllable right before a maqef (כָּל־)        → katan
//   QK3  before a hataf-qamats (צָהֳרַיִם, אָהֳלוֹ)           → katan
//   QK4  final syllable of a hollow-verb vayyiqtol, where the stress moves
//        back (וַיָּקָם "vayakom", וַיָּשָׁב "vayashov")      → katan
//   QK5  closed by a dagesh chazak in the next letter (חָנֵּנִי "chonneni")
//                                                           → katan
//        except stressed directional/final forms (שָׁמָּה, אָנָּא) and בָּתִּים
//   QK6  known katan words where QK1 is ambiguous (KATAN_WORDS) → katan
//
// Grading is lenient: a reader who says gadol "a" for a katan is not penalised
// (see vowelSound), and an ambiguous qamats accepts either reading.

// Words compare by skeleton: vav/yud dropped (they may have been merged into a
// vowel by the tokenizer) and final letter forms mapped to their base form.
const FINAL_TO_BASE = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }
const skeleton = letters => [...letters].filter(l => l !== 'ו' && l !== 'י').map(l => FINAL_TO_BASE[l] ?? l).join('')

// Common katan words QK1 can't resolve (written without prefixes)
const KATAN_WORDS = new Set([
  'חכמה', 'חכמת', 'חכמתו', 'חכמתך', 'חכמתם', 'חכמתי',
  'קדשו', 'קדשי', 'קדשך', 'קדשה', 'קדשם',
  'אזנים', 'אזני', 'אזנו', 'אזנך', 'אזניו', 'אזניך', 'אזניהם',
  'קרבן', 'קרבנו', 'קרבנך', 'קרבנם',
  'מתנים', 'מתניו', 'מתניך', 'מתניהם',
  'חדשו', 'שרשו', 'שרשם', 'צהרים',
].map(skeleton))
// Gadol despite a following dagesh chazak (QK5 exceptions)
const GADOL_WORDS = new Set(['בתים', 'בתי', 'בתיכם', 'בתיהם', 'בתיך', 'בתינו'].map(skeleton))
const PREFIX_LETTERS = 'והבכלמש'

// Is the qamats on the first letter of a listed word, after at most two prefix
// letters (וּבְ, הַ, ...) within its maqef component?
function matchesWordList(atoms, index, list) {
  let start = index
  while (start > 0 && !atoms[start].wordStart) start--
  if (index - start > 2) return false
  if (!atoms.slice(start, index).every(a => PREFIX_LETTERS.includes(a.letter))) return false
  let end = index
  while (end < atoms.length - 1 && !atoms[end].isFinal) end++
  return list.has(skeleton(atoms.slice(index, end + 1).map(a => a.letter)))
}

// Returns 'gadol' | 'katan' | 'ambiguous', or null if the atom has no qamats.
export function determineQamatsType(atoms, index) {
  const atom = atoms[index]
  if (atom.vowel !== 'qamats') return null
  if (atom.qamatsKatanMark) return 'katan'                               // QK0
  if (atom.meteg) return 'gadol'                                         // QK0'
  if (isQamatsKatanBeforeMaqef(atoms, index)) return 'katan'             // QK2
  if (atom.isFinal) return 'gadol'

  const next = atoms[index + 1]
  if (next.vowel === 'hataf-qamats') return 'katan'                      // QK3
  if (isHollowVayyiqtol(atoms, index)) return 'katan'                    // QK4
  if (matchesWordList(atoms, index, KATAN_WORDS)) return 'katan'        // QK6
  if (hasDageshChazak(next) && !isStressedBeforeDagesh(atoms, index)) {  // QK5
    return matchesWordList(atoms, index, GADOL_WORDS) ? 'gadol' : 'katan'
  }
  if (next.vowel === 'sheva' && !next.isFinal) return 'ambiguous'        // QK1
  return 'gadol'
}

// QK2: the maqef removes the word's stress, so a qamats in a closed final
// syllable becomes a short "o" (כָּל־ "kol", not "kal").
function isQamatsKatanBeforeMaqef(atoms, index) {
  const closer = atoms[index + 1]
  if (!closer?.beforeMaqef || atoms[index].isFinal) return false
  if (closer.vowel && closer.vowel !== 'sheva') return false
  // A silent letter leaves the syllable open (מָה־)
  const silent = 'אוי'.includes(closer.letter) || (closer.letter === 'ה' && !closer.dagesh)
  return !silent
}

// QK4: וַ + prefix (י/ת/נ with dagesh) + C2 with qamats + vowelless final C3.
function isHollowVayyiqtol(atoms, index) {
  const vav = atoms[index - 2], prefix = atoms[index - 1], last = atoms[index + 1]
  return !!vav && vav.wordStart && vav.letter === 'ו' && vav.vowel === 'patah' &&
    'יתנ'.includes(prefix.letter) && prefix.dagesh && prefix.vowel === 'qamats' &&
    last.isFinal && (!last.vowel || last.vowel === 'sheva')
}

// A dagesh after a vowel is always chazak (doubling). Mappiq in ה and a vav
// carrying shuruk are not dageshes.
function hasDageshChazak(atom) {
  if (!atom.dagesh || atom.wordStart) return false
  if (atom.letter === 'ה') return false
  if (atom.letter === 'ו' && atom.vowel === 'shuruk') return false
  return true
}

// QK5 exception: when the doubled letter opens a word-final syllable that ends
// in a silent ה/א (שָׁמָּה, אָנָּה, אָנָּא), the stress is on the qamats
// syllable, so it stays gadol.
function isStressedBeforeDagesh(atoms, index) {
  const doubled = atoms[index + 1], after = atoms[index + 2]
  if (!doubled || doubled.isFinal || !after?.isFinal || after.vowel) return false
  return after.letter === 'א' || (after.letter === 'ה' && !after.dagesh)
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
    // 'either' (after an ambiguous qamats) shows as vocal but accepts silence
    if (type === 'either') return { vowel: 'e', shevaType: type, altVowels: [''] }
    return { vowel: type === 'na' ? 'e' : '', shevaType: type }
  }

  // Qamats katan is "o" in every tradition. In Sephardic, where gadol is "a",
  // we're lenient: katan read as "a" is accepted, and an ambiguous qamats
  // (QK1) accepts either.
  // Ashkenazic kamatz is "o"/"aw" canonically, but readers vary — "boruch",
  // "baruch", "buruch" are all heard and all valid — so any of them passes.
  if (v === 'qamats') {
    const qamatsType = determineQamatsType(atoms, index)
    if (tradition === 'ashkenazic') return { vowel: 'o', shevaType: null, qamatsType, altVowels: ['a', 'u'] }
    if (qamatsType === 'katan') return { vowel: 'o', shevaType: null, qamatsType, altVowels: ['a'] }
    if (qamatsType === 'ambiguous') return { vowel: 'a', shevaType: null, qamatsType, altVowels: ['o'] }
    return { vowel: 'a', shevaType: null, qamatsType }
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
    'hataf-qamats':  'o',   // always "o" (חֳדָשִׁים "chodashim")
  }
  // Ashkenazic vowel preferences vary widely by region (Lithuanian, German,
  // Polish, American). We aim for the Modern American Ashkenazic baseline used
  // in most US Hebrew schools: kamatz "o" (vs Seph "a"), but accept "oh" for
  // cholam and "e" for tzere as common variants. Kamatz is graded leniently
  // ("o", "a" and "u" all pass — see vowelSound); tav/sav is enforced.
  const MAP_ASHK = {
    'patah':         'a',
    'qamats':        'o',   // canonical; "a"/"u" also accepted (vowelSound)
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
