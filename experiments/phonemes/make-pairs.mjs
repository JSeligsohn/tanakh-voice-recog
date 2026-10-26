// Speaks each pair (pairs.mjs) with the macOS Hebrew voice, Carmit, into
// data/pairs/<id>__right.wav and __wrong.wav, with 0.4 s of silence before and
// after: a clip that starts at 0 ms loses an opening b, k or p.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { pairs } from './pairs.mjs'

const RATE = 16000
const PAD = Buffer.alloc(Math.round(0.4 * RATE) * 2)
mkdirSync('data/pairs', { recursive: true })
for (const p of pairs) {
  for (const kind of ['right', 'wrong']) {
    const out = `data/pairs/${p.id}__${kind}.wav`
    execFileSync('say', ['-v', 'Carmit', '-r', '150', '-o', out, '--file-format=WAVE', `--data-format=LEI16@${RATE}`, p[kind]])
    const wav = readFileSync(out)
    const data = wav.indexOf('data') + 8
    const pcm = Buffer.concat([PAD, wav.subarray(data), PAD])
    const header = Buffer.from(wav.subarray(0, data))
    header.writeUInt32LE(header.length - 8 + pcm.length, 4)
    header.writeUInt32LE(pcm.length, data - 4)
    writeFileSync(out, Buffer.concat([header, pcm]))
  }
}
rmSync('data/cache', { recursive: true, force: true }) // loadAudio caches by name
console.log(`made ${pairs.length * 2} clips in data/pairs/`)
