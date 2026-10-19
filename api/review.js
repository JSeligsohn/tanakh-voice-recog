// Testers' saved attempts, for the Review page (/?review). Every request needs
// the review password (REVIEW_KEY, set in Vercel) in the x-review-key header.
//
// GET                → { attempts: [details, newest first] }
// GET ?audio=<id>    → the recording (audio/wav)
// DELETE ?id=<id>    → { deleted: true }

import { createHash, timingSafeEqual } from 'node:crypto'
import { listAttempts, attemptAudio, deleteAttempt, storeConfigured } from '../src/server/attempts.js'

const fail = (status, error) => Response.json({ error }, { status })

const digest = text => createHash('sha256').update(String(text)).digest()
const keyMatches = (given, expected) => timingSafeEqual(digest(given), digest(expected))

export default {
  async fetch(request) {
    const expected = process.env.REVIEW_KEY
    if (!expected || !storeConfigured()) return fail(500, 'Review is not set up on the server (REVIEW_KEY and the Blob store).')
    if (!keyMatches(request.headers.get('x-review-key') ?? '', expected)) return fail(401, 'Wrong review password.')

    const url = new URL(request.url)
    if (request.method === 'GET' && url.searchParams.has('audio')) {
      const file = await attemptAudio(url.searchParams.get('audio'))
      if (!file) return fail(404, 'No recording for that attempt.')
      return new Response(file.stream, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-store' } })
    }
    if (request.method === 'GET') {
      return Response.json({ attempts: await listAttempts() }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (request.method === 'DELETE') {
      const deleted = await deleteAttempt(url.searchParams.get('id') ?? '')
      return deleted ? Response.json({ deleted: true }) : fail(400, 'Unknown attempt.')
    }
    return fail(405, 'Use GET or DELETE.')
  },
}
