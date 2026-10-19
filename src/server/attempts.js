// Testers' saved attempts (server only): each is the recording as sent to the
// transcriber and what came back, kept in Vercel Blob as private files —
// attempts/<id>.wav and attempts/<id>.json — readable only with the store's
// token (BLOB_READ_WRITE_TOKEN), so only through api/review.js. Ids start with
// the time, so they sort newest-last by name.

import { put, list, get, del } from '@vercel/blob'
import { cleanTesterName } from '../utils/tester.js'

const PREFIX = 'attempts/'
const ID = /^[\w-]{10,80}$/

export const storeConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN)

const newId = () =>
  new Date().toISOString().replace(/[:.]/g, '-') + '-' + Math.random().toString(36).slice(2, 8)

// Save one attempt: the WAV audio (base64, as the browser sent it) and its
// details. Returns the id.
export async function saveAttempt({ tester, audioBase64, ...details }) {
  const id = newId()
  const meta = {
    id,
    tester: cleanTesterName(tester),
    createdAt: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    ...details,
  }
  await Promise.all([
    put(`${PREFIX}${id}.wav`, Buffer.from(audioBase64, 'base64'), { access: 'private', contentType: 'audio/wav' }),
    put(`${PREFIX}${id}.json`, JSON.stringify(meta), { access: 'private', contentType: 'application/json' }),
  ])
  return id
}

// The newest attempts' details (up to `limit`)
export async function listAttempts(limit = 100) {
  const pathnames = []
  let cursor
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 })
    pathnames.push(...page.blobs.map(b => b.pathname).filter(p => p.endsWith('.json')))
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  const newest = pathnames.sort().reverse().slice(0, limit)
  const metas = await Promise.all(newest.map(async pathname => {
    try {
      const file = await get(pathname, { access: 'private' })
      return file?.stream ? JSON.parse(await new Response(file.stream).text()) : null
    } catch {
      return null
    }
  }))
  return metas.filter(Boolean)
}

// One attempt's recording: { stream, size } or null
export async function attemptAudio(id) {
  if (!ID.test(id)) return null
  const file = await get(`${PREFIX}${id}.wav`, { access: 'private' })
  return file?.stream ? file : null
}

export async function deleteAttempt(id) {
  if (!ID.test(id)) return false
  await del([`${PREFIX}${id}.wav`, `${PREFIX}${id}.json`])
  return true
}
