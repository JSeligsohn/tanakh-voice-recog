// Ways of having OpenAI read a verse aloud (the Voice lab compares them).
// Built on the server (dev/openai-speech.js): the browser names a variant and
// a voice, never instructions of its own.
//
// Two OpenAI models:
//   tts  — gpt-4o-mini-tts (/v1/audio/speech). Takes the text plus a short
//          style instruction. Follows the letters, not accent requests.
//   chat — gpt-audio-1.5 (/v1/chat/completions with audio output), the model
//          we already use for transcription. Takes a full system prompt.

import { respellAshkenazi, respellCareful, respellDivineNames } from '../../utils/hebrewRespell.js'
import { romanize } from '../../utils/hebrewRomanize.js'

export const SPEECH_MODELS = { tts: 'gpt-4o-mini-tts', chat: 'gpt-audio-1.5' }

// The reading the app's Listen button plays: gpt-audio with the Hebrew and the
// English-letter guide, in the cedar voice (chosen in the Voice lab, 2026-10).
// Recorded ahead of time by scripts/generate-listen-audio.mjs.
export const LISTEN_READING = {
  voice: 'cedar',
  variants: { sephardic: 'seph-guide-chat', ashkenazic: 'ashk-guide-chat' },
}

// Voices both models offer
export const SPEECH_VOICES = ['ash', 'cedar', 'marin', 'coral', 'ballad', 'sage', 'verse']

const TEACHER = 'Read this Biblical Hebrew verse slowly and clearly, like a teacher reading to students. ' +
  'Pronounce every letter and vowel point (nikud) exactly as written; do not modernize or correct the spelling.'

const WORD_BY_WORD = 'Read this Hebrew verse word by word for a beginner: say each word clearly, with a short pause after it. ' +
  'Pronounce every letter and vowel point (nikud) exactly as written; do not modernize or correct the spelling.'

const READER = 'You are the reader for a Torah reading practice app. Read aloud exactly the Hebrew text the user sends, ' +
  'and nothing else: no introduction, no translation, no comments. Read slowly and clearly, like a teacher reading to students, ' +
  'and follow the nikud exactly.'

const SEPHARDI_READER = `${READER} Use Sephardi pronunciation, as in Israeli Torah reading: kamatz gadol is "a", ` +
  'tav is always "t", sound every vocal sheva (sheva na), and read kamatz katan as "o" (כׇּל = "kol").'

const ASHKENAZI_READER = `${READER} Use traditional Ashkenazi pronunciation, as heard in an American yeshiva: ` +
  'kamatz gadol is "o" (אָבִיךָ = "ovicho"), tav without a dagesh is "s" (בֵּית = "beys"), tzere is "ey", cholam is "oy".'

// For the variants that send the verse in English letters (see hebrewRomanize.js)
const ROMAN_GUIDE = 'This is a Biblical Hebrew verse written in English letters. Read it as Hebrew, never as English, ' +
  'exactly as spelled. Say each vowel the same way every time: a as in "father", e as in "bed", i as in "ski", ' +
  'o as in "more", u as in "rule". "kh" is the throaty sound in "Bach", "tz" as in "pizza". ' +
  'An apostrophe is a short catch in the voice.'

const SYLLABLES = 'Hyphens only mark the syllables: say each word smoothly, without pausing at the hyphens. ' +
  'Stress the syllable in CAPITALS; never spell out capitals as letters.'

const ACUTE_MARKS = 'An accent mark (á) shows the stressed syllable.'

const ROMAN_SEPHARDI = 'Use Sephardi pronunciation, as in Israeli Torah reading.'
const ROMAN_ASHKENAZI = 'Use an American Ashkenazi (yeshiva) accent: "ey" as in "they".'

const ROMAN_TEACHER = 'Read slowly and clearly, like a teacher reading to students, with a short pause at each comma.'

const ROMAN_READER = 'You are the reader for a Torah reading practice app. The user sends a Biblical Hebrew verse written in ' +
  'English letters. Read it aloud exactly as spelled, and nothing else: no introduction, no translation, no comments, ' +
  'and never replace it with the Hebrew you know, even if you recognize the verse.'

const ROMAN_ASHKENAZI_AW = 'Use an American Ashkenazi (yeshiva) accent: "aw" as in "law", "ey" as in "they".'

// Tests whether the English sound of the English-letter readings comes from the prompt
const NATIVE_ACCENT = 'Speak with a native Israeli Hebrew accent, never an English one: a Hebrew "r" from the back of ' +
  'the throat, short pure vowels with no English glide (e never becomes "ey", o never becomes "ow"), and Hebrew rhythm.'

// Hebrew text plus the English-letter spelling as a pronunciation guide: the
// Hebrew keeps the model's Hebrew accent, the guide settles each sound.
// {guide} is filled per verse (speechInstructions).
const GUIDE = 'Pronounce it exactly as this English-letter guide shows: hyphens mark the syllables (say each word ' +
  'smoothly), the syllable in CAPITALS is stressed, "kh" is the throaty sound in "Bach". Guide: {guide}'

const roman = (...parts) => parts.join(' ')

export const SPEECH_VARIANTS = [
  {
    id: 'seph-plain', accent: 'sephardi', engine: 'tts', label: 'Plain',
    about: 'Verse as written, no instructions. The baseline.',
    instructions: '',
  },
  {
    id: 'seph-teacher', accent: 'sephardi', engine: 'tts', label: 'Teacher',
    about: 'Verse as written, "read slowly like a teacher, follow the nikud". The one you liked in the first test.',
    instructions: TEACHER,
  },
  {
    id: 'seph-careful', accent: 'sephardi', engine: 'tts', label: 'Teacher + respelled',
    about: 'Teacher, with kamatz katan respelled as cholam and every sheva na as chataf segol, so it says "kol" and sounds the vocal sheva.',
    instructions: TEACHER, respell: 'careful',
  },
  {
    id: 'seph-slow', accent: 'sephardi', engine: 'tts', label: 'Word by word',
    about: 'Respelled like the one above, read one word at a time with a pause after each, for beginners.',
    instructions: WORD_BY_WORD, respell: 'careful',
  },
  {
    id: 'seph-chat', accent: 'sephardi', engine: 'chat', label: 'gpt-audio, instructions',
    about: 'Verse as written, read by gpt-audio-1.5 with a full Sephardi reading prompt.',
    instructions: SEPHARDI_READER,
  },
  {
    id: 'ashk-respell', accent: 'ashkenazi', engine: 'tts', label: 'Respelled',
    about: 'Kamatz → cholam, ת without dagesh → ס. The version you heard ("a drop yeshivish").',
    instructions: TEACHER, respell: 'ashkenazi',
  },
  {
    id: 'ashk-ey', accent: 'ashkenazi', engine: 'tts', label: 'Respelled + "ey"',
    about: 'As above, and tzere also gets a yud so it reads "ey" (הַשֵּׁם → "hasheym").',
    instructions: TEACHER, respell: 'ashkenazi-ey',
  },
  {
    id: 'ashk-ey-oy', accent: 'ashkenazi', engine: 'tts', label: 'Respelled + "ey" + "oy"',
    about: 'As above, and cholam also gets a yud so it reads "oy" (יוֹסֵף → "Yoysef"). The chassidish sound.',
    instructions: TEACHER, respell: 'ashkenazi-ey-oy',
  },
  {
    id: 'ashk-chat', accent: 'ashkenazi', engine: 'chat', label: 'gpt-audio, instructions',
    about: 'Verse as written, read by gpt-audio-1.5 with a full Ashkenazi reading prompt. Tests whether the smarter model follows accent instructions.',
    instructions: ASHKENAZI_READER,
  },
  {
    id: 'ashk-chat-respell', accent: 'ashkenazi', engine: 'chat', label: 'gpt-audio, respelled',
    about: 'gpt-audio-1.5 with the Ashkenazi prompt and the respelled text (kamatz → cholam, ת → ס).',
    instructions: ASHKENAZI_READER, respell: 'ashkenazi',
  },
  {
    id: 'seph-roman', accent: 'sephardi', engine: 'tts', label: 'English letters',
    about: 'The verse spelled in English letters by our rules engine, one hyphen per syllable, stress in capitals from the trope (va-YO-mer ha-SHEM).',
    instructions: roman(ROMAN_GUIDE, SYLLABLES, ROMAN_SEPHARDI, ROMAN_TEACHER), romanize: { tradition: 'sephardic', style: 'syllables' },
  },
  {
    id: 'seph-roman-acute', accent: 'sephardi', engine: 'tts', label: 'English letters, accent marks',
    about: 'English letters as whole words, stress shown by an accent mark (vayómer hashém).',
    instructions: roman(ROMAN_GUIDE, ACUTE_MARKS, ROMAN_SEPHARDI, ROMAN_TEACHER), romanize: { tradition: 'sephardic', style: 'acute' },
  },
  {
    id: 'seph-roman-chat', accent: 'sephardi', engine: 'chat', label: 'gpt-audio, English letters',
    about: 'The syllable spelling, read by gpt-audio-1.5.',
    instructions: roman(ROMAN_READER, ROMAN_GUIDE, SYLLABLES, ROMAN_SEPHARDI, ROMAN_TEACHER), romanize: { tradition: 'sephardic', style: 'syllables' },
  },
  {
    id: 'ashk-roman', accent: 'ashkenazi', engine: 'tts', label: 'English letters',
    about: 'Ashkenazi sounds spelled out (o for kamatz, s for ת, ey for tzere), one hyphen per syllable, stress in capitals from the trope.',
    instructions: roman(ROMAN_GUIDE, SYLLABLES, ROMAN_ASHKENAZI, ROMAN_TEACHER), romanize: { tradition: 'ashkenazic', style: 'syllables' },
  },
  {
    id: 'ashk-roman-acute', accent: 'ashkenazi', engine: 'tts', label: 'English letters, accent marks',
    about: 'English letters as whole words, stress shown by an accent mark (vayómer hashéym).',
    instructions: roman(ROMAN_GUIDE, ACUTE_MARKS, ROMAN_ASHKENAZI, ROMAN_TEACHER), romanize: { tradition: 'ashkenazic', style: 'acute' },
  },
  {
    id: 'ashk-roman-chat', accent: 'ashkenazi', engine: 'chat', label: 'gpt-audio, English letters',
    about: 'The Ashkenazi syllable spelling, read by gpt-audio-1.5.',
    instructions: roman(ROMAN_READER, ROMAN_GUIDE, SYLLABLES, ROMAN_ASHKENAZI, ROMAN_TEACHER), romanize: { tradition: 'ashkenazic', style: 'syllables' },
  },
  {
    id: 'seph-roman-native', accent: 'sephardi', engine: 'tts', label: 'English letters, Israeli accent prompt',
    about: 'The accent-mark spelling with a prompt that insists on a native Israeli accent. Shows whether the English sound comes from the prompt or from the letters.',
    instructions: roman(ROMAN_GUIDE, ACUTE_MARKS, NATIVE_ACCENT, ROMAN_TEACHER), romanize: { tradition: 'sephardic', style: 'acute' },
  },
  {
    id: 'seph-guide', accent: 'sephardi', engine: 'tts', label: 'Hebrew + English guide',
    about: 'The Hebrew verse, with the English-letter spelling in the instructions as a pronunciation guide.',
    instructions: roman(TEACHER, GUIDE), guide: { tradition: 'sephardic', style: 'syllables' },
  },
  {
    id: 'seph-guide-chat', accent: 'sephardi', engine: 'chat', label: 'gpt-audio, Hebrew + English guide',
    about: 'gpt-audio-1.5 with the Sephardi prompt, the Hebrew verse, and the English-letter spelling as a guide.',
    instructions: roman(SEPHARDI_READER, GUIDE), guide: { tradition: 'sephardic', style: 'syllables' },
  },
  {
    id: 'ashk-roman-aw', accent: 'ashkenazi', engine: 'tts', label: 'English letters, "aw"',
    about: 'Accent-mark spelling with kamatz as "aw" (avráwm), cholam still "o", and Hashem as "hashém".',
    instructions: roman(ROMAN_GUIDE, ACUTE_MARKS, ROMAN_ASHKENAZI_AW, ROMAN_TEACHER), romanize: { tradition: 'ashkenazic', style: 'acute', kamatz: 'aw' },
  },
  {
    id: 'ashk-roman-aw-chat', accent: 'ashkenazi', engine: 'chat', label: 'gpt-audio, English letters, "aw"',
    about: 'The syllable spelling with kamatz as "aw" (av-RAWM), read by gpt-audio-1.5.',
    instructions: roman(ROMAN_READER, ROMAN_GUIDE, SYLLABLES, ROMAN_ASHKENAZI_AW, ROMAN_TEACHER), romanize: { tradition: 'ashkenazic', style: 'syllables', kamatz: 'aw' },
  },
  {
    id: 'ashk-guide', accent: 'ashkenazi', engine: 'tts', label: 'Hebrew + English guide',
    about: 'The Hebrew with ת without dagesh written ס (kamatz left as is), and the Ashkenazi English-letter spelling ("aw") as a guide.',
    instructions: roman(TEACHER, ROMAN_ASHKENAZI_AW, GUIDE), respell: 'ashkenazi-tav', guide: { tradition: 'ashkenazic', style: 'syllables', kamatz: 'aw' },
  },
  {
    id: 'ashk-guide-chat', accent: 'ashkenazi', engine: 'chat', label: 'gpt-audio, Hebrew + English guide',
    about: 'gpt-audio-1.5 with the Ashkenazi prompt, the Hebrew with ת → ס, and the English-letter spelling ("aw") as a guide.',
    instructions: roman(READER, 'Use traditional Ashkenazi pronunciation, as heard in an American yeshiva.', GUIDE), respell: 'ashkenazi-tav', guide: { tradition: 'ashkenazic', style: 'syllables', kamatz: 'aw' },
  },
]

const RESPELL = {
  careful: respellCareful,
  ashkenazi: text => respellAshkenazi(text),
  'ashkenazi-ey': text => respellAshkenazi(text, { tzereEy: true }),
  'ashkenazi-ey-oy': text => respellAshkenazi(text, { tzereEy: true, cholamOy: true }),
  'ashkenazi-tav': text => respellAshkenazi(text, { kamatz: false }),
}

const stripTrope = text => text.replace(/[\u0591-\u05AF\u05C3]/g, '')

// The Hebrew a variant starts from: the English-letter variants need the
// trope (it gives the stress and pauses); the others send the verse without it
export function speechSource(variant, verse) {
  return variant.romanize || variant.guide ? verse.trope : verse.text
}

// The text a variant actually sends for a verse
export function speechInput(variant, text) {
  if (variant.romanize) return romanize(text, variant.romanize)
  if (variant.guide) text = respellDivineNames(stripTrope(text))
  return variant.respell ? RESPELL[variant.respell](text) : text
}

// The instructions for a verse: the variant's, with the guide filled in
export function speechInstructions(variant, text) {
  return variant.guide ? variant.instructions.replace('{guide}', romanize(text, variant.guide)) : variant.instructions
}

// The OpenAI request for one reading: { model, url, body, input }
export function buildSpeechRequest(variant, text, voice) {
  const input = speechInput(variant, text)
  const instructions = speechInstructions(variant, text)
  const model = SPEECH_MODELS[variant.engine]
  if (variant.engine === 'tts') {
    return {
      model, input,
      url: 'https://api.openai.com/v1/audio/speech',
      body: { model, voice, input, response_format: 'mp3', ...(instructions ? { instructions } : {}) },
    }
  }
  return {
    model, input,
    url: 'https://api.openai.com/v1/chat/completions',
    body: {
      model,
      modalities: ['text', 'audio'],
      audio: { voice, format: 'mp3' },
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: input },
      ],
    },
  }
}
