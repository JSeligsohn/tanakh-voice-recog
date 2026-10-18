// The sound key for student-facing feedback. The rules engine works in plain
// Latin letters ("di", "cha"), which a student can read several ways ("di" as
// "dee", "die" or "dih"; "ch" as in "chair"). Feedback instead spells every
// sound one fixed way, with an English word that has that sound:
// "ee" as in "see", "kh" as in "Bach". Example words are ones that sound
// the same in most English accents.

// Vowels: key spelling → how it's described
const VOWELS = {
  ah: 'as in "father"',
  eh: 'as in "bed"',
  ee: 'as in "see"',
  oh: 'as in "go"',
  oo: 'as in "food"',
  uh: 'a quick sound, like the "a" in "about"',
  ay: 'as in "day"',
  oy: 'as in "boy"',
  aw: 'as in "law"',
}

// Consonants: key spelling → how it's described
const CONSONANTS = {
  b: 'as in "boy"', v: 'as in "very"', g: 'as in "get"', d: 'as in "dog"',
  h: 'as in "hat"', z: 'as in "zoo"', kh: 'the throaty sound in "Bach"',
  t: 'as in "top"', y: 'as in "yes"', k: 'as in "kite"', l: 'as in "let"',
  m: 'as in "moon"', n: 'as in "no"', s: 'as in "sun"', p: 'as in "pen"',
  f: 'as in "fun"', ts: 'as in "cats"', r: 'as in "run"', sh: 'as in "shoe"',
}

// The sound guide shown with the results: the vowels, and the consonants
// whose English spelling could mislead
export const SOUND_GUIDE = {
  vowels: ['ah', 'eh', 'ee', 'oh', 'oo', 'uh', 'ay', 'oy', 'aw'].map(say => ({ say, asIn: VOWELS[say] })),
  consonants: ['kh', 'ts', 'g', 'sh', 's'].map(say => ({ say, asIn: CONSONANTS[say] })),
}

// "ee" as in "see" — a key spelling with its description
export function describe(say) {
  const asIn = VOWELS[say] ?? CONSONANTS[say]
  if (say === 'uh') return `a quick "uh", like the "a" in "about"`
  if (say === 'kh') return `"kh" (${asIn})`
  return asIn ? `"${say}" ${asIn}` : `"${say}"`
}

// The engine's consonant sound in the key's spelling ("ch" → "kh")
export const consonantSay = latin => (latin === 'ch' ? 'kh' : latin ?? '')

// The expected vowel of a syllable in the key's spelling, from its vowel sign
// and the tradition; null for none (a sheva nach is silent).
export function vowelSay(syl, tradition) {
  const v = syl.atom?.vowel
  if (v === 'sheva') return syl.shevaType === 'nach' || !syl.vowel ? null : 'uh'
  if (v === 'qamats') {
    if (syl.qamatsType === 'katan') return 'oh'
    return tradition === 'ashkenazic' ? 'aw' : 'ah'
  }
  if (v === 'tzere') return tradition === 'ashkenazic' ? 'ay' : 'eh'
  return SIGN_SAY[v] ?? (syl.vowel ? latinToSay(syl.vowel) : null)
}
const SIGN_SAY = {
  'patah': 'ah', 'hataf-patah': 'ah', 'segol': 'eh', 'hataf-segol': 'eh', 'hiriq': 'ee',
  'holam': 'oh', 'hataf-qamats': 'oh', 'shuruk': 'oo', 'qubuts': 'oo',
}

// A syllable as it should be said, in the key's spelling ("dee", "khaw")
export function syllableSay(syl, tradition) {
  const c = consonantSay(syl.consonant)
  const v = vowelSay(syl, tradition) ?? ''
  return syl.patachGenuvah ? v + c : c + v
}

// The vowel's name, as the letter breakdown shows it
export function vowelSignName(syl) {
  const v = syl.atom?.vowel
  if (v === 'qamats' && syl.qamatsType === 'katan') return 'kamatz katan'
  if (v === 'sheva') return syl.shevaType === 'nach' ? 'sheva nach' : 'sheva na'
  return SIGN_NAME[v] ?? v
}
const SIGN_NAME = {
  'patah': 'patach', 'hataf-patah': 'patach', 'qamats': 'kamatz', 'hataf-qamats': 'hataf kamatz',
  'segol': 'segol', 'hataf-segol': 'hataf segol', 'tzere': 'tzere', 'hiriq': 'chirik',
  'holam': 'cholam', 'shuruk': 'shuruk', 'qubuts': 'kubutz',
}

// Respell what a student said (normalized Latin letters, as the transcriber
// writes them) in the key's spelling: "do" → "doh", "cha" → "khah".
const LATIN_UNITS = [
  ['sh', 'sh'], ['ch', 'kh'], ['kh', 'kh'], ['ts', 'ts'], ['tz', 'ts'],
  ['ay', 'ay'], ['ai', 'ay'], ['ey', 'ay'], ['ei', 'ay'], ['oy', 'oy'], ['oi', 'oy'],
  ['aw', 'aw'], ['ee', 'ee'], ['iy', 'ee'], ['oo', 'oo'],
  ['a', 'ah'], ['e', 'eh'], ['i', 'ee'], ['o', 'oh'], ['u', 'oo'],
]
const VOWEL_SAYS = new Set(Object.keys(VOWELS))
export function latinToSay(latin) {
  const s = (latin ?? '').toLowerCase().replace(/[^a-z]/g, '')
  let out = ''
  let i = 0
  while (i < s.length) {
    const unit = LATIN_UNITS.find(([from]) => s.startsWith(from, i))
    if (unit) {
      out += unit[1]
      i += unit[0].length
      // A spelled "h" after a vowel ("ah", "oh") is part of the vowel when
      // nothing follows it or a consonant does
      if (VOWEL_SAYS.has(unit[1]) && s[i] === 'h' && !/[aeiouy]/.test(s[i + 1] ?? '')) i++
      continue
    }
    out += s[i++]
  }
  return out
}

// What a student said for a vowel, described ("oh" as in "go"); null when
// they said no vowel
export function describeHeardVowel(latin) {
  const say = latinToSay(latin)
  return say ? describe(say) : null
}

// ── Letters ──────────────────────────────────────────────────────────

const DAGESH = 'ּ'
const SHIN_DOT = 'ׁ'
const SIN_DOT = 'ׂ'

const LETTER_NAME = {
  'א': 'alef', 'ב': 'vet', 'ג': 'gimel', 'ד': 'dalet', 'ה': 'he', 'ו': 'vav', 'ז': 'zayin',
  'ח': 'chet', 'ט': 'tet', 'י': 'yud', 'כ': 'khaf', 'ך': 'final khaf', 'ל': 'lamed',
  'מ': 'mem', 'ם': 'final mem', 'נ': 'nun', 'ן': 'final nun', 'ס': 'samech', 'ע': 'ayin',
  'פ': 'fe', 'ף': 'final fe', 'צ': 'tsadi', 'ץ': 'final tsadi', 'ק': 'kuf', 'ר': 'resh', 'ת': 'tav',
}
// Letters whose dot (dagesh) changes the sound: name with the dot, and the
// sound each form makes
const DOT_PAIRS = {
  'ב': { dotted: 'bet', dottedSay: 'b', plainSay: 'v' },
  'כ': { dotted: 'kaf', dottedSay: 'k', plainSay: 'kh' },
  'ך': { dotted: 'final kaf', dottedSay: 'k', plainSay: 'kh' },
  'פ': { dotted: 'pe', dottedSay: 'p', plainSay: 'f' },
  'ף': { dotted: 'final pe', dottedSay: 'p', plainSay: 'f' },
}

// A letter as feedback names it: the letter with the marks that decide its
// sound, and its name — בּ (bet, with a dot), שׂ (sin, dot on the left)
export function letterLabel(atom, tradition) {
  const L = atom.letter
  if (L === 'ש') return atom.sinDot ? `ש${SIN_DOT} (sin, dot on the left)` : `ש${SHIN_DOT} (shin, dot on the right)`
  if (DOT_PAIRS[L]) return atom.dagesh ? `${L}${DAGESH} (${DOT_PAIRS[L].dotted}, with a dot)` : `${L} (${LETTER_NAME[L]}, no dot)`
  if (L === 'ת' && tradition === 'ashkenazic') return atom.dagesh ? `ת${DAGESH} (tav, with a dot)` : 'ת (sav, no dot)'
  return `${L} (${LETTER_NAME[L] ?? L})`
}

// When the sound a student said is the other form of the same letter (בּ read
// as ב), or the letter it's most often mixed up with (ח read as ה), the
// letter they read instead: "the sound of ב (vet, no dot)"
export function soundOfOtherLetter(atom, heardSay, tradition) {
  const L = atom.letter
  const pair = DOT_PAIRS[L]
  if (pair) {
    if (atom.dagesh && heardSay === pair.plainSay) return `${L} (${LETTER_NAME[L]}, no dot)`
    if (!atom.dagesh && heardSay === pair.dottedSay) return `${L}${DAGESH} (${pair.dotted}, with a dot)`
  }
  if (L === 'ש') {
    if (atom.sinDot && heardSay === 'sh') return `ש${SHIN_DOT} (shin)`
    if (!atom.sinDot && heardSay === 's') return `ש${SIN_DOT} (sin)`
  }
  if (L === 'ת' && tradition === 'ashkenazic') {
    if (atom.dagesh && heardSay === 's') return 'ת (sav, no dot)'
    if (!atom.dagesh && heardSay === 't') return `ת${DAGESH} (tav, with a dot)`
  }
  if (L === 'ח' && heardSay === 'h') return 'ה (he)'
  if (L === 'ה' && heardSay === 'kh') return 'ח (chet)'
  return null
}
