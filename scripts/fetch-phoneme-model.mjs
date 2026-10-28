// Downloads the phoneme model the app's scorer runs (api/phonemes.js): ZIPA
// small, int8 (71 MB), from Hugging Face, into models/zipa-s/. Runs before
// every build (npm run build), so Vercel bundles it with the function; skips
// files already there. ZIPA is by Jian Zhu et al. (github.com/lingjzhu/zipa);
// the ONNX export at huggingface.co/anyspeech/zipa-small-crctc-500k is CC BY 4.0.

import { mkdir, stat, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'

const REPO = 'https://huggingface.co/anyspeech/zipa-small-crctc-500k/resolve/main'
const DIR = join(new URL('..', import.meta.url).pathname, 'models/zipa-s')
const FILES = { 'model.int8.onnx': 70_000_000, 'tokens.txt': 500 }

await mkdir(DIR, { recursive: true })
for (const [file, minBytes] of Object.entries(FILES)) {
  const path = join(DIR, file)
  const have = await stat(path).catch(() => null)
  if (have && have.size >= minBytes) { console.log(`[phoneme model] ${file}: already here`); continue }
  const res = await fetch(`${REPO}/${file}`)
  if (!res.ok) throw new Error(`[phoneme model] ${file}: HTTP ${res.status}`)
  const data = Buffer.from(await res.arrayBuffer())
  if (data.length < minBytes) throw new Error(`[phoneme model] ${file}: only ${data.length} bytes`)
  await writeFile(path + '.part', data)
  await rename(path + '.part', path)
  console.log(`[phoneme model] ${file}: ${(data.length / 1e6).toFixed(1)} MB`)
}
