import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Server-only secrets read from .env for the local API (never VITE_-prefixed,
// so Vite never copies them into the browser bundle).
const SERVER_ENV = ['OPENAI_API_KEY', 'AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION']

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localApi()],
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
      ignored: ['**/.env', '**/.env.local', '**/node_modules/**', '**/.git/**'],
    },
  },
  define: {
    // Azure Speech SDK references `global` which doesn't exist in browsers
    global: 'globalThis',
  },
})
