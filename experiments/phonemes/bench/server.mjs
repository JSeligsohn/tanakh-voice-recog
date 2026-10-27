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
import { compared, verdicts, progress, sync, saveVerdict, attemptFile } from './compare.mjs'

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

const bodyOf = async req => { const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks).toString() }

// A WAV, answering range requests (Safari needs them to play audio)
function sendWav(req, res, wav) {
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
  if (range) {
    const start = range[1] ? +range[1] : 0, end = range[2] ? Math.min(+range[2], wav.length - 1) : wav.length - 1
    res.writeHead(206, { 'Content-Type': 'audio/wav', 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${wav.length}`, 'Accept-Ranges': 'bytes' })
    return res.end(wav.subarray(start, end + 1))
  }
  res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' })
  return res.end(wav)
}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  try {
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, await readFile(join(HERE, 'page.html')), 'text/html; charset=utf-8')
    if (req.method === 'GET' && url.pathname === '/flags.js') return send(res, 200, await readFile(join(HERE, 'flags.js')), 'text/javascript; charset=utf-8')
    if (req.method === 'GET' && url.pathname === '/state') {
      return send(res, 200, { groups, latestRound, items: items.map(i => ({ ...i, text: textOf(i) })), results })
    }
    // Compare: the current grader and the phoneme scorer on testers' attempts
    if (req.method === 'GET' && url.pathname === '/compare') return send(res, 200, await readFile(join(HERE, 'compare.html')), 'text/html; charset=utf-8')
    if (req.method === 'GET' && url.pathname === '/compare/state') {
      return send(res, 200, { attempts: Object.values(compared).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')), verdicts, progress })
    }
    if (req.method === 'POST' && url.pathname === '/compare/sync') {
      // the review password is only passed on to the app's Review API
      const { appUrl, rescore } = JSON.parse((await bodyOf(req)) || '{}')
      if (appUrl && !/^https:\/\/[\w.-]+(:\d+)?\/?$/.test(appUrl)) return send(res, 400, { error: 'App address should look like https://example.vercel.app' })
      sync(appUrl, req.headers['x-review-key'] ?? '', { rescore: !!rescore })
      return send(res, 200, { started: true })
    }
    if (req.method === 'POST' && url.pathname === '/compare/verdict') {
      const { id, wi, verdict } = JSON.parse(await bodyOf(req))
      if (!compared[id] || !Number.isInteger(wi) || !['current', 'phoneme', 'both', 'neither', null].includes(verdict)) return send(res, 400, { error: 'bad verdict' })
      await saveVerdict(id, wi, verdict)
      return send(res, 200, { ok: true })
    }
    if (req.method === 'GET' && url.pathname === '/compare/audio') {
      const file = attemptFile(url.searchParams.get('id') ?? '')
      if (!file) return send(res, 400, { error: 'bad id' })
      return sendWav(req, res, await readFile(file))
    }
    // A plain page with a player per take: /listen?keys=<result key>,<result key>
    if (req.method === 'GET' && url.pathname === '/listen') {
      const keys = (url.searchParams.get('keys') ?? '').split(',').filter(k => results[k])
      const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
      const rows = keys.map(k => {
        const r = results[k], [id, kind, reader] = k.split('__'), item = items.find(i => i.id === id)
        return `<div class="take"><b>${esc(id)}</b> · ${kind === 'right' ? 'as written' : 'mistake'}${reader ? ` · ${esc(reader)}` : ''}<div class="say">${esc(item?.[kind] ?? '')}</div>` +
          `<audio controls preload="auto" src="/audio?file=${encodeURIComponent(r.file)}"></audio>` +
          `<div class="flags">${r.flags.length ? r.flags.map(f => esc(`${f.word}: ${f.kind === 'consonant' ? f.letter : f.test}${f.partner ? ` (heard ${f.partner})` : ''}`)).join(' · ') : 'no flags'}</div></div>`
      }).join('')
      return send(res, 200, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Listen</title>
<style>:root{--bg:#fafaf8;--ink:#1d1d1b;--muted:#6b6b66;--line:#e4e2dc}@media (prefers-color-scheme:dark){:root{--bg:#161615;--ink:#ecebe7;--muted:#a09f99;--line:#34332f}}
body{margin:0;padding:16px;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif;max-width:720px}.take{border-bottom:1px solid var(--line);padding:12px 0}.say{color:var(--muted);font-size:14px}audio{width:100%;margin:6px 0}.flags{font-size:13px;color:var(--muted)}</style>
</head><body><h1 style="font-size:18px">Listen</h1>${rows || '<p>No takes found.</p>'}</body></html>`, 'text/html; charset=utf-8')
    }
    if (req.method === 'GET' && url.pathname === '/audio') {
      const name = url.searchParams.get('file') ?? ''
      if (!/^[\w.-]+\.wav$/.test(name)) return send(res, 400, { error: 'bad file' })
      return sendWav(req, res, await readFile(join(DATA, name)))
    }
    if (req.method === 'POST' && url.pathname === '/take') {
      const item = items.find(i => i.id === url.searchParams.get('id'))
      const kind = url.searchParams.get('kind')
      const reader = url.searchParams.get('reader')
      if (!item || !['right', 'wrong'].includes(kind) || !item[kind]) return send(res, 400, { error: 'unknown item' })
      if (item.round >= 3 && !['adult', 'child'].includes(reader)) return send(res, 400, { error: 'unknown reader' })
      const chunks = []
      for await (const c of req) chunks.push(c)
      const key = item.round >= 3 ? `${item.id}__${kind}__${reader}` : `${item.id}__${kind}`
      const name = `${key}__${new Date().toISOString().replace(/[:.]/g, '-')}.wav`
      const file = join(DATA, name)
      await writeFile(file, padWav(Buffer.concat(chunks)))
      const result = { file: name, at: new Date().toISOString(), trad: item.trad, text: textOf(item), said: item[kind], ...(reader && { reader }), ...(await score(item, kind, file)) }
      results[key] = result
      await writeFile(RESULTS, JSON.stringify(results, null, 1))
      console.log(`${key}: ${result.ok ? 'as expected' : 'NOT as expected'}  heard: ${result.heard}`)
      return send(res, 200, result)
    }
    send(res, 404, { error: 'not found' })
  } catch (err) {
    console.error(err)
    send(res, 500, { error: err.message })
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Test bench: http://127.0.0.1:${PORT}`))
