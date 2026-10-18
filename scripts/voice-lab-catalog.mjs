// Builds voice-library/catalog.json for the shared Voice lab page
// (voice-library/voice-lab.html, published on claude.ai with the mp3s beside
// it): the verses, the variants and every saved take, from the local library.
// Run after generating new takes, then republish the page.
//
//   node scripts/voice-lab-catalog.mjs

import fs from 'node:fs'
import { voiceLabVerses } from '../src/data/voiceLab.js'
import { SPEECH_MODELS, SPEECH_VARIANTS } from '../src/services/prompts/speechPrompts.js'

const manifest = JSON.parse(fs.readFileSync('voice-library/manifest.json', 'utf8'))

const catalog = {
  verses: voiceLabVerses,
  // instructions: exactly what the model was told (the tts model's instructions,
  // or gpt-audio's system prompt); '' means the text was sent on its own
  // ({guide} variants carry the verse's English-letter spelling in their
  // instructions, so their takes list the instructions actually sent)
  variants: SPEECH_VARIANTS.map(({ id, accent, engine, label, about, respell, romanize, guide, instructions }) => ({
    id, accent, engine, model: SPEECH_MODELS[engine], label, about, respelled: !!(respell || guide), romanized: !!romanize,
    instructions: instructions.replace('{guide}', '[the verse in English letters, syllables and stress shown]'),
  })),
  clips: manifest.clips.map(({ id, verseId, variantId, voice, take, file, input, instructions }) => ({
    id, verseId, variantId, voice, take, file, input,
    ...(SPEECH_VARIANTS.find(v => v.id === variantId)?.guide ? { instructions } : {}),
  })),
}

fs.writeFileSync('voice-library/catalog.json', JSON.stringify(catalog) + '\n')
console.log(`catalog.json: ${catalog.verses.length} verses, ${catalog.variants.length} variants, ${catalog.clips.length} takes`)
