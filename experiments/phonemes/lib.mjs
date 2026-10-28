// The phoneme scorer as the experiment uses it: the app's scorer
// (src/server/phonemes/scorer.js) with the experiment's defaults (env.mjs), plus
// loading any audio file from disk.

import './env.mjs'
import { readFile, mkdir, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, basename } from 'node:path'
import { readWav } from '../../src/server/phonemes/scorer.js'

export * from '../../src/server/phonemes/scorer.js'

const HERE = new URL('.', import.meta.url).pathname

// Any audio file → 16 kHz mono samples in [-1, 1] (afconvert, cached)
export async function loadAudio(path) {
  const cache = join(HERE, 'data/cache')
  await mkdir(cache, { recursive: true })
  const wav = join(cache, basename(path).replace(/\.\w+$/, '') + '.16k.wav')
  try { await access(wav) } catch { execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', path, wav]) }
  return readWav(await readFile(wav)).samples
}
