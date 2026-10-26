// Local test bench: record each item in items.mjs read right and read with
// its mistake, and see at once what the phoneme model flagged. Takes are saved
// to data/bench/ (git-ignored), labelled with what they were meant to be.
// Nothing leaves this computer.
//
//   node bench/server.mjs   →   http://127.0.0.1:8790

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { psukim } from '../../../src/data/psukim.js'
import { loadAudio, frameLogProbs, freeDecode, expectedUnits, scoreContrasts } from '../lib.mjs'
import { groups, items } from './items.mjs'

const HERE = new URL('.', import.meta.url).pathname
const DATA = join(HERE, '../data/bench')
const RESULTS = join(DATA, 'results.json')
const PORT = 8790
const RATE = 16000

await mkdir(DATA, { recursive: true })
const results = JSON.parse(await readFile(RESULTS, 'utf8').catch(() => '{}'))
const textOf = item => item.text ?? psukim.find(p => p.id === item.pasuk).text

// Same word and letter, ignoring maqef and final-letter forms
const BASE = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }
const sameWord = (a, b) => a.replace(/־/g, '') === b.replace(/־/g, '')
const sameLetter = (a, b) => (BASE[a] ?? a) === (BASE[b] ?? b)

async function score(item, kind, file) {
  const post = await frameLogProbs(await loadAudio(file))
  const scores = scoreContrasts(post, expectedUnits(textOf(item), { tradition: item.trad }))
  const flags = scores.filter(s => s.llr < 0).map(s => ({ word: s.word, letter: s.letter, expected: s.expected, partner: s.partner, llr: +s.llr.toFixed(1) }))
  const later = groups.find(g => g.id === item.group)?.later
  const wanted = kind === 'wrong' && !later ? item.flag : []
  const caught = wanted.filter(w => flags.some(f => sameWord(f.word, w.word) && sameLetter(f.letter, w.letter)))
  const extra = flags.filter(f => !wanted.some(w => sameWord(f.word, w.word) && sameLetter(f.letter, w.letter)))
  return {
    heard: freeDecode(post), flags, later: !!later,
    missed: wanted.filter(w => !caught.includes(w)), extra,
    ok: caught.length === wanted.length && extra.length === 0,
  }
}

// 16 kHz mono 16-bit WAV from the page, with 0.4 s of silence added at each
// end (a take that starts on the first sound loses an opening b, k or p)
function padWav(buf) {
  const data = buf.indexOf('data') + 8
  const pad = Buffer.alloc(Math.round(0.4 * RATE) * 2)
  const pcm = Buffer.concat([pad, buf.subarray(data), pad])
  const header = Buffer.from(buf.subarray(0, data))
  header.writeUInt32LE(header.length - 8 + pcm.length, 4)
  header.writeUInt32LE(pcm.length, data - 4)
  return Buffer.concat([header, pcm])
}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  try {
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, await readFile(join(HERE, 'page.html')), 'text/html; charset=utf-8')
    if (req.method === 'GET' && url.pathname === '/state') {
      return send(res, 200, { groups, items: items.map(i => ({ ...i, text: textOf(i) })), results })
    }
    if (req.method === 'GET' && url.pathname === '/audio') {
      const name = url.searchParams.get('file') ?? ''
      if (!/^[\w.-]+\.wav$/.test(name)) return send(res, 400, { error: 'bad file' })
      return send(res, 200, await readFile(join(DATA, name)), 'audio/wav')
    }
    if (req.method === 'POST' && url.pathname === '/take') {
      const item = items.find(i => i.id === url.searchParams.get('id'))
      const kind = url.searchParams.get('kind')
      if (!item || !['right', 'wrong'].includes(kind)) return send(res, 400, { error: 'unknown item' })
      const chunks = []
      for await (const c of req) chunks.push(c)
      const name = `${item.id}__${kind}__${new Date().toISOString().replace(/[:.]/g, '-')}.wav`
      const file = join(DATA, name)
      await writeFile(file, padWav(Buffer.concat(chunks)))
      const result = { file: name, at: new Date().toISOString(), trad: item.trad, text: textOf(item), said: item[kind], ...(await score(item, kind, file)) }
      results[`${item.id}__${kind}`] = result
      await writeFile(RESULTS, JSON.stringify(results, null, 1))
      console.log(`${item.id} ${kind}: ${result.ok ? 'as expected' : 'NOT as expected'}  heard: ${result.heard}`)
      return send(res, 200, result)
    }
    send(res, 404, { error: 'not found' })
  } catch (err) {
    console.error(err)
    send(res, 500, { error: err.message })
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Test bench: http://127.0.0.1:${PORT}`))
