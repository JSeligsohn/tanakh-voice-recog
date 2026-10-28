// Downloads the phoneme model the app's scorer runs (api/phonemes.js): ZIPA
// small, int8 (71 MB), from Hugging Face, into models/zipa-s/. Runs before
// every build (npm run build), so Vercel bundles it with the function; skips
// files already there. ZIPA is by Jian Zhu et al. (github.com/lingjzhu/zipa);
// the ONNX export at huggingface.co/anyspeech/zipa-small-crctc-500k is CC BY 4.0.
//
// On Vercel it also deletes onnxruntime's builds for other platforms (macOS,
// Windows, Linux ARM: 250 MB of its 299), which would otherwise be bundled
// with the function and take it over Vercel's 250 MB limit.

import { mkdir, stat, writeFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const REPO = 'https://huggingface.co/anyspeech/zipa-small-crctc-500k/resolve/main'
const DIR = join(ROOT, 'models/zipa-s')

if (process.env.VERCEL) {
  const bin = join(ROOT, 'node_modules/onnxruntime-node/bin/napi-v6')
  for (const other of ['darwin', 'win32', 'linux/arm64']) await rm(join(bin, other), { recursive: true, force: true })
  console.log('[phoneme model] removed onnxruntime builds for other platforms')
}
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
