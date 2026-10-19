import fs from 'node:fs/promises'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Server-only secrets read from .env for the local API (never VITE_-prefixed,
// so Vite never copies them into the browser bundle).
const SERVER_ENV = ['OPENAI_API_KEY', 'AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION', 'BLOB_READ_WRITE_TOKEN', 'REVIEW_KEY']

// Serves the Vercel Functions in api/ during `npm run dev`, so local dev
// works the same as production without the Vercel CLI. Each api/<name>.js
// exports default { fetch(request) } and handles /api/<name>.
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const name of SERVER_ENV) if (env[name]) process.env[name] = env[name]

      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([\w-]+)(?:\?|$)/)
        if (!match) return next()
        try {
          const { default: handler } = await server.ssrLoadModule(`/api/${match[1]}.js`)
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: req.headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
          })
          const response = await handler.fetch(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          server.config.logger.error(`[local-api] ${req.url}: ${err.stack ?? err}`)
          res.statusCode = 500
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

// Dev-only store for the Voice lab: every reading generated there is saved
// under voice-library/ (one mp3 per take) with manifest.json describing each
// take — what was sent, which model and voice, and your rating and note — so
// the readings become the start of the app's audio library.
//
//   GET   /dev/voice-library               → manifest { clips: [...] }
//   GET   /dev/voice-library/files/<file>  → the mp3
//   POST  /dev/voice-library/clips         { verseId, variantId, voice } → new take
//   PATCH /dev/voice-library/clips/<id>    { rating?, note? } → updated take
const VOICE_LIBRARY = path.resolve('voice-library')
const VOICE_MANIFEST = path.join(VOICE_LIBRARY, 'manifest.json')

function voiceLibrary() {
  return {
    name: 'voice-library',
    apply: 'serve',
    configureServer(server) {
      async function readManifest() {
        try { return JSON.parse(await fs.readFile(VOICE_MANIFEST, 'utf8')) } catch { return { clips: [] } }
      }
      // Manifest changes run one at a time so parallel generations don't clobber each other
      let queue = Promise.resolve()
      function changeManifest(change) {
        const run = queue.then(async () => {
          const manifest = await readManifest()
          const result = await change(manifest)
          await fs.mkdir(VOICE_LIBRARY, { recursive: true })
          await fs.writeFile(VOICE_MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
          return result
        })
        queue = run.catch(() => {})
        return run
      }
      const send = (res, status, data) => {
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(data))
      }
      async function readJson(req) {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        return JSON.parse(Buffer.concat(chunks).toString() || '{}')
      }

      server.middlewares.use('/dev/voice-library', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost')
          if (req.method === 'GET' && url.pathname === '/') return send(res, 200, await readManifest())

          if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
            const file = path.resolve(VOICE_LIBRARY, decodeURIComponent(url.pathname.slice('/files/'.length)))
            if (!file.startsWith(VOICE_LIBRARY + path.sep)) return send(res, 403, { error: 'Outside the library.' })
            res.setHeader('Content-Type', 'audio/mpeg')
            return res.end(await fs.readFile(file))
          }

          if (req.method === 'POST' && url.pathname === '/clips') {
            const { verseId, variantId, voice } = await readJson(req)
            const { voiceLabVerses } = await server.ssrLoadModule('/src/data/voiceLab.js')
            const { SPEECH_VARIANTS, speechInput, speechSource, speechInstructions } = await server.ssrLoadModule('/src/services/prompts/speechPrompts.js')
            const { default: speech } = await server.ssrLoadModule('/dev/openai-speech.js')
            const verse = voiceLabVerses.find(v => v.id === verseId)
            const variant = SPEECH_VARIANTS.find(v => v.id === variantId)
            if (!verse || !variant) return send(res, 400, { error: 'Unknown verse or variant.' })

            const response = await speech.fetch(new Request('http://localhost/api/openai-speech', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: speechSource(variant, verse), variant: variantId, voice }),
            }))
            if (!response.ok) return send(res, response.status, await response.json())
            const audio = Buffer.from(await response.arrayBuffer())
            const transcript = response.headers.get('X-Speech-Transcript')

            const clip = await changeManifest(async manifest => {
              const same = manifest.clips.filter(c => c.verseId === verseId && c.variantId === variantId && c.voice === voice)
              const take = Math.max(0, ...same.map(c => c.take)) + 1
              const id = `${verseId}__${variantId}__${voice}__${take}`
              const file = `${verseId}/${id}.mp3`
              await fs.mkdir(path.join(VOICE_LIBRARY, verseId), { recursive: true })
              await fs.writeFile(path.join(VOICE_LIBRARY, file), audio)
              const entry = {
                id, verseId, book: verse.book, variantId, accent: variant.accent, voice, take, file,
                model: response.headers.get('X-Speech-Model'),
                verseText: verse.text,
                input: speechInput(variant, speechSource(variant, verse)),
                instructions: speechInstructions(variant, speechSource(variant, verse)),
                ...(transcript !== null ? { transcript: decodeURIComponent(transcript) } : {}),
                bytes: audio.length,
                createdAt: new Date().toISOString(),
                rating: null,
                note: '',
              }
              manifest.clips.push(entry)
              return entry
            })
            return send(res, 200, clip)
          }

          const patch = url.pathname.match(/^\/clips\/([\w-]+)$/)
          if (req.method === 'PATCH' && patch) {
            const { rating, note } = await readJson(req)
            const clip = await changeManifest(manifest => {
              const entry = manifest.clips.find(c => c.id === patch[1])
              if (!entry) return null
              if (rating !== undefined) entry.rating = ['good', 'bad'].includes(rating) ? rating : null
              if (typeof note === 'string') entry.note = note
              return entry
            })
            return clip ? send(res, 200, clip) : send(res, 404, { error: 'No such take.' })
          }

          send(res, 404, { error: 'Not found.' })
        } catch (err) {
          server.config.logger.error(`[voice-library] ${req.url}: ${err.stack ?? err}`)
          send(res, 500, { error: err.message })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localApi(), voiceLibrary()],
  server: {
    // Bind explicitly to IPv4 — Vite 8 has been defaulting to IPv6-only on macOS,
    // which causes browsers to hang since they try 127.0.0.1 first.
    host: '127.0.0.1',
    watch: {
      // macOS FSEvents fires phantom change events when other processes (like
      // VS Code's tsserver) just *read* project files, causing endless HMR loops.
      // Polling ignores fsevent noise — slightly more CPU, but actually stable.
      usePolling: true,
      interval: 500,
      ignored: ['**/.env', '**/.env.local', '**/node_modules/**', '**/.git/**', '**/voice-library/**'],
    },
  },
  define: {
    // Azure Speech SDK references `global` which doesn't exist in browsers
    global: 'globalThis',
  },
})
