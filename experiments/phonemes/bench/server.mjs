// Local test bench: record each item in items.mjs read right and read with
// its mistake, and see at once what the phoneme model flagged. Takes are saved
// to data/bench/ (git-ignored), labelled with what they were meant to be.
// Nothing leaves this computer.
//
//   node bench/server.mjs   →   http://127.0.0.1:8790

import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { groups, items, latestRound } from './items.mjs'
import { textOf, score } from './score.mjs'

const HERE = new URL('.', import.meta.url).pathname
const DATA = join(HERE, '../data/bench')
const RESULTS = join(DATA, 'results.json')
const PORT = 8790
const RATE = 16000

await mkdir(DATA, { recursive: true })
const results = JSON.parse(await readFile(RESULTS, 'utf8').catch(() => '{}'))

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
      return send(res, 200, { groups, latestRound, items: items.map(i => ({ ...i, text: textOf(i) })), results })
    }
    if (req.method === 'GET' && url.pathname === '/audio') {
      const name = url.searchParams.get('file') ?? ''
      if (!/^[\w.-]+\.wav$/.test(name)) return send(res, 400, { error: 'bad file' })
      const wav = await readFile(join(DATA, name))
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
      if (range) {
        const start = range[1] ? +range[1] : 0, end = range[2] ? Math.min(+range[2], wav.length - 1) : wav.length - 1
        res.writeHead(206, { 'Content-Type': 'audio/wav', 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${wav.length}`, 'Accept-Ranges': 'bytes' })
        return res.end(wav.subarray(start, end + 1))
      }
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' })
      return res.end(wav)
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
