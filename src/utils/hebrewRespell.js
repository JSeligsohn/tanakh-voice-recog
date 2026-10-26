// Respell pointed Hebrew so a text-to-speech model reads it a particular way.
// The speech models follow the letters, not accent instructions (asked for an
// Ashkenazi reading, they still say "t" for ת without a dagesh), so the sounds
// we want are written into the text itself.
//
// Both respellings write a final ך with a dagesh (אַרְאֶךָּ) as ק: the models
// say "kh" for every final ך, since Modern Hebrew almost never has one.
//
// respellAshkenazi: kamatz → cholam ("o"), ת without dagesh → ס ("s"), and
//   optionally tzere → "ey" and cholam → "oy".
// respellCareful (Sephardi): kamatz katan → cholam ("kol", not "kal") and
//   sheva na → chataf segol, so the model sounds the vocal sheva.
// respellDivineNames: the ה of אֱלֹהִים and its forms → ק ("Elokeinu"), as
//   customarily said outside prayer.

import { tokenizeWord, determineShevaType, determineQamatsType, getExpectedPhonetic } from './hebrewRules.js'

const SHEVA = '\u05B0'
const HATAF_SEGOL = '\u05B1'
const TZERE = '\u05B5'
const QAMATS = '\u05B8'
const HOLAM = '\u05B9'
const HOLAM_HASER_FOR_VAV = '\u05BA'
const DAGESH = '\u05BC'
const QAMATS_QATAN = '\u05C7'

const isLetter = ch => ch >= 'א' && ch <= 'ת'
// Points that attach to a letter (cantillation, nikud, dagesh, shin/sin dots,
// meteg); maqef, paseq and sof pasuq are separate.
const isMark = ch => /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/.test(ch)

// Split text into words and the separators between them; each word is a list
// of { letter, marks } groups.
function parse(text) {
  const tokens = []
  for (const piece of text.split(/(\s+)/)) {
    if (!piece) continue
    if (/^\s+$/.test(piece)) { tokens.push(piece); continue }
    const groups = []
    for (const ch of piece) {
      if (isLetter(ch)) groups.push({ letter: ch, marks: '' })
      else if (isMark(ch) && groups.length > 0) groups[groups.length - 1].marks += ch
      else groups.push({ other: ch }) // maqef, punctuation
    }
    tokens.push({ word: piece, groups })
  }
  return tokens
}

const render = tokens => tokens.map(t => (typeof t === 'string' ? t : t.groups.map(g => g.other ?? g.letter + g.marks).join(''))).join('')

// Pair each letter group with its atom from the rules engine. The tokenizer
// folds vowel letters (shuruk/cholam vav, chirik/tzere yud) into the letter
// before, so those groups get no atom.
function withAtoms(token) {
  const atoms = tokenizeWord(token.word)
  let j = 0
  for (const g of token.groups) {
    if (g.other) continue
    if (atoms[j]?.letter === g.letter) { g.atom = atoms[j]; g.atomIndex = j; j++ }
  }
  return atoms
}

const nextLetter = (groups, i) => groups.slice(i + 1).find(g => !g.other)

function hardFinalKaf(g) {
  if (g.letter === 'ך' && g.marks.includes(DAGESH)) { g.letter = 'ק'; g.marks = g.marks.replace(DAGESH, '') }
}

export function respellAshkenazi(text, { tzereEy = false, cholamOy = false, kamatz = true } = {}) {
  const tokens = parse(text)
  for (const token of tokens) {
    if (typeof token === 'string') continue
    const out = []
    const groups = token.groups
    for (let i = 0; i < groups.length; i++) {
      const g = { ...groups[i] }
      out.push(g)
      if (g.other) continue
      const next = nextLetter(groups, i)

      // ָיו ("his", אֵלָיו): the yud is silent and the vav is "v". Once the
      // kamatz becomes a cholam, ֹיו would read "oyv" and ֹו "o", so write the
      // "v" as a ב: עָלָיו → עֹלֹב "olov".
      const afterNext = next && groups[groups.indexOf(next) + 1]
      if (kamatz && g.marks.includes(QAMATS) && next?.letter === 'י' && !next.marks &&
          afterNext?.letter === 'ו' && !afterNext.marks && groups.indexOf(afterNext) === groups.length - 1) {
        g.marks = g.marks.replace(QAMATS, HOLAM)
        out.push({ letter: 'ב', marks: '' })
        break
      }

      if (g.letter === 'ת' && !g.marks.includes(DAGESH)) g.letter = 'ס'
      hardFinalKaf(g)
      if (tzereEy && g.marks.includes(TZERE) && next?.letter !== 'י') out.push({ letter: 'י', marks: '' })
      if (cholamOy && (g.marks.includes(HOLAM) || g.marks.includes(HOLAM_HASER_FOR_VAV)) && next?.letter !== 'י') {
        out.push({ letter: 'י', marks: '' })
      }
      // After the cholam step, so a kamatz becomes a plain "o", not "oy"
      if (kamatz) g.marks = g.marks.replace(QAMATS, HOLAM).replace(QAMATS_QATAN, HOLAM)
    }
    token.groups = out
  }
  return render(tokens)
}

export function respellCareful(text) {
  const tokens = parse(text)
  for (const token of tokens) {
    if (typeof token === 'string') continue
    const atoms = withAtoms(token)
    for (const g of token.groups) {
      if (g.other) continue
      hardFinalKaf(g)
      if (g.marks.includes(QAMATS_QATAN)) g.marks = g.marks.replace(QAMATS_QATAN, HOLAM)
      if (!g.atom) continue
      if (g.marks.includes(QAMATS) && determineQamatsType(atoms, g.atomIndex) === 'katan') {
        g.marks = g.marks.replace(QAMATS, HOLAM)
      }
      if (g.marks.includes(SHEVA) && determineShevaType(atoms, g.atomIndex) === 'na') {
        g.marks = g.marks.replace(SHEVA, HATAF_SEGOL)
      }
    }
  }
  return render(tokens)
}

export function respellDivineNames(text) {
  const tokens = parse(text)
  for (const token of tokens) {
    if (typeof token === 'string') continue
    const atoms = withAtoms(token)
    const { segments } = getExpectedPhonetic(atoms)
    for (const g of token.groups) {
      if (g.atom && segments[g.atomIndex].altConsonants.includes('k')) g.letter = 'ק'
    }
  }
  return render(tokens)
}
