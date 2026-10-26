// Listen: plays the recorded reading of a verse. The readings are made ahead of
// time (scripts/generate-listen-audio.mjs, listed in src/data/listenAudio.json),
// so listening costs nothing and every reading has been checked.

import listenAudio from '../data/listenAudio.json'

// The recording of a verse in a tradition, or null if there isn't one
export function listenUrl(pasukId, tradition) {
  const file = listenAudio[pasukId]?.[tradition]?.file
  return file ? import.meta.env.BASE_URL + file : null
}

// The ElevenLabs reading of a verse (api/listen.js), made the first time it's
// asked for. Testers only for now: the ElevenLabs free plan isn't licensed for
// students, so everyone else hears the recordings above.
export const elevenLabsUrl = (pasukId, tradition) =>
  `/api/listen?pasuk=${encodeURIComponent(pasukId)}&tradition=${tradition}`

// Plays a recording; returns a cancel function. onStart: the sound begins
// (a reading made on request can take a few seconds to arrive).
export function playRecording(url, { onStart, onEnd, onError } = {}) {
  const audio = new Audio(url)
  let finished = false
  function finish(err) {
    if (finished) return
    finished = true
    audio.pause()
    if (err) onError?.(err)
    else onEnd?.()
  }
  audio.onplaying = () => { if (!finished) onStart?.() }
  audio.onended = () => finish()
  audio.onerror = () => finish('Audio playback failed.')
  audio.play().catch(e => finish(e.message))
  return function cancel() { finish() }
}
