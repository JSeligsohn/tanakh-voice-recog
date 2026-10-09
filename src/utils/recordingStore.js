// Tiny IndexedDB key-value store for audio Blobs (localStorage can't hold
// them). Used by the dev Transcription check page to keep recordings across
// reloads so they can be re-transcribed after prompt or model changes.

const DB_NAME = 'tanakh-transcription-check'
const STORE = 'recordings'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(req?.result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export const saveRecording = (id, blob) => run('readwrite', s => s.put(blob, id))
export const deleteRecording = id => run('readwrite', s => s.delete(id))

// Returns { [id]: Blob } for every saved recording
export async function loadAllRecordings() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const out = {}
    const req = db.transaction(STORE).objectStore(STORE).openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) { db.close(); resolve(out); return }
      out[cursor.key] = cursor.value
      cursor.continue()
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}
