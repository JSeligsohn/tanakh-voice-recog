// Spells a pointed Hebrew verse in English letters for text-to-speech, so we
// control every sound instead of the model's Modern Hebrew habits: which
// sheva is said, dagesh (k / kh), silent letters, the accent, and the stress.
//
// The sounds come from our rules engine (getExpectedPhonetic). The stress and
// the pauses come from the cantillation, so pass the verse with its trope:
// each word is stressed on the syllable that carries its accent, and the
// verse pauses (commas) where the trope has a major break.
//
//   romanize(text, { tradition: 'sephardic' | 'ashkenazic', style: 'syllables' | 'acute', kamatz: 'o' | 'aw' })
//     syllables: va-YO-mer ha-SHEM el av-RAM   (hyphens, stress in capitals)
//     acute:     vayómer hashém el avrám       (stress as an accent mark)
//     kamatz:    Ashkenazi kamatz as "o" or "aw" (av-RAWM, keeping cholam "o")

import { tokenizeWord, getExpectedPhonetic } from './hebrewRules.js'

const MAQEF = '\u05BE'
const METEG = '\u05BD'
const SOF_PASUQ = '\u05C3'

const isLetter = c => c >= 'א' && c <= 'ת'
const isAccent = c => c >= '\u0591' && c <= '\u05AF'

// Accents written on a word's last letter (pashta, segolta, zarqa, telisha
// qetana) or first letter (telisha gedola, yetiv, dehi) whatever its stress.
// Only a second copy elsewhere in the word (e.g. a doubled pashta) marks it.
const POSTPOSITIVE = new Set(['\u0599', '\u0592', '\u05AE', '\u05A9'])
const PREPOSITIVE = new Set(['\u05A0', '\u059A', '\u05AD'])

// Major breaks: etnachta, segolta, shalshelet, zaqef qatan and gadol, revia
const PAUSE = new Set(['\u0591', '\u0592', '\u0593', '\u0594', '\u0595', '\u0597'])

const CONSONANT = { ch: 'kh', ts: 'tz' }
const ACUTE = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }

// The letter (index among the part's letters) that carries the stress, or
// null for a part with no accent (the first word of a maqef pair).
// lastInVerse: the part before sof pasuq, whose accent is silluq (a meteg).
function stressedLetter(part, lastInVerse) {
  const marks = []
  let letter = -1
  let letters = 0
  for (const c of part) {
    if (isLetter(c)) { letter++; letters++ }
    else if (isAccent(c) || c === METEG) marks.push({ c, letter })
  }
  const accents = marks.filter(m => m.c !== METEG)
  const placed = accents.filter(m =>
    !(POSTPOSITIVE.has(m.c) && m.letter === letters - 1) && !(PREPOSITIVE.has(m.c) && m.letter === 0))
  if (placed.length) return placed[placed.length - 1].letter
  if (accents.length) return letters - 1 // only a postpositive or prepositive accent: the usual final stress
  if (lastInVerse) {
    const silluq = marks.filter(m => m.c === METEG).pop()
    if (silluq) return silluq.letter
  }
  return null
}

// The atom (rules-engine index within the part) that holds a given letter
function atomOfLetter(part, letterIndex) {
  let letter = -1
  let end = part.length
  for (let i = 0; i < part.length; i++) {
    if (!isLetter(part[i])) continue
    if (++letter === letterIndex + 1) { end = i; break }
  }
  return tokenizeWord(part.slice(0, end)).length - 1
}

const QAMATS_VOWELS = new Set(['qamats', 'hataf-qamats'])
const plain = word => word.replace(/[^\u05D0-\u05EA]/g, '')

// Syllables of one maqef part, from its rules-engine segments
function syllables(segments, { tradition, kamatz, part }) {
  const out = []
  segments.forEach((s, k) => {
    // אֱלֹהִים and its forms: "k", as customarily said outside prayer (Elokeinu)
    const sound = s.altConsonants?.includes('k') ? 'k' : s.consonant
    const consonant = CONSONANT[sound] ?? sound
    const last = out[out.length - 1]
    if (!consonant && !s.vowel) return // silent letter

    // Patach genuvah: said before its letter (רוּחַ = ru-akh)
    if (k === segments.length - 1 && s.atom.vowel === 'patah' && 'חעה'.includes(s.atom.letter) && last && last.vowel !== 'a') {
      out.push({ onset: '', vowel: 'a', coda: consonant, atom: s.atomIndex })
      return
    }
    if (s.vowel) {
      let vowel = s.vowel
      if (tradition === 'ashkenazic') {
        // Hashem stays "ha-shem" in an Ashkenazi reading too
        if (s.atom.vowel === 'tzere' && plain(part) !== 'השם') vowel = 'ey'
        if (kamatz === 'aw' && QAMATS_VOWELS.has(s.atom.vowel) && vowel === 'o') vowel = 'aw'
      }
      out.push({ onset: consonant, vowel, coda: '', atom: s.atomIndex })
      return
    }
    if (last) last.coda += consonant
    else out.push({ onset: consonant, vowel: '', coda: '', atom: s.atomIndex })
  })
  return out
}

function render(sylls, stressed, style) {
  const many = sylls.length > 1
  if (style === 'acute') {
    return sylls.map((s, i) => {
      const vowel = many && i === stressed ? ACUTE[s.vowel[0]] + s.vowel.slice(1) : s.vowel
      const glottal = i > 0 && !s.onset ? "'" : ''
      return glottal + s.onset + vowel + s.coda
    }).join('')
  }
  return sylls.map((s, i) => {
    const text = s.onset + s.vowel + s.coda
    return many && i === stressed ? text.toUpperCase() : text
  }).join('-')
}

function romanizeWord(word, lastInVerse, { tradition, style, kamatz }) {
  const atoms = tokenizeWord(word)
  const { segments } = getExpectedPhonetic(atoms, { tradition })
  const parts = word.split(MAQEF).filter(Boolean)

  let offset = 0
  return parts.map((part, pi) => {
    const count = tokenizeWord(part).length
    const mine = segments.filter(s => s.atomIndex >= offset && s.atomIndex < offset + count)
    const sylls = syllables(mine, { tradition, kamatz, part })
    const letter = stressedLetter(part, lastInVerse && pi === parts.length - 1)
    let stressed = -1
    if (letter !== null) {
      const atom = offset + atomOfLetter(part, letter)
      sylls.forEach((s, i) => { if (s.atom <= atom) stressed = i })
    }
    offset += count
    return render(sylls, stressed, style)
  }).join(' ')
}

export function romanize(text, { tradition = 'sephardic', style = 'syllables', kamatz = 'o' } = {}) {
  const words = text.replace(/[\u05C0|]/g, ' ').trim().split(/\s+/)
  return words.map((raw, i) => {
    const end = raw.includes(SOF_PASUQ) || i === words.length - 1
    const word = raw.replace(SOF_PASUQ, '')
    const roman = romanizeWord(word, end, { tradition, style, kamatz })
    const pause = end ? '.' : [...word].some(c => PAUSE.has(c)) ? ',' : ''
    return roman + pause
  }).join(' ').replace(/^./, c => c.toUpperCase())
}
