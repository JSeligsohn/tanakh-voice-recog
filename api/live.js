// The live reader (Vercel Function, WebSocket; also served by the Vite dev
// server — see vite.config.js): the browser streams the microphone here while
// the student reads, and each word is graded as soon as they're done with it
// (src/server/liveSocket.js has the messages, src/server/phonemes/live.js the
// tracking). Like api/phonemes.js, nothing leaves the server.
//
// A connection lasts at most the function's maximum duration (300 s); a
// reading is capped well under that (src/server/liveSocket.js).

import http from 'node:http'
import { WebSocketServer } from 'ws'
import { handleLiveSocket } from '../src/server/liveSocket.js'

const server = http.createServer((req, res) => {
  res.statusCode = 426
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: 'Connect with a WebSocket.' }))
})
// ~100 ms of 16-bit audio is 3.2 KB; nothing larger is expected
const wss = new WebSocketServer({ server, maxPayload: 256 * 1024 })
wss.on('connection', handleLiveSocket)

export default server
