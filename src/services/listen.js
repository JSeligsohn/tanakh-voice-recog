// Listen: plays the recorded reading of a verse. The readings are made ahead of
// time (scripts/generate-listen-audio.mjs, listed in src/data/listenAudio.json),
// so listening costs nothing and every reading has been checked.

import listenAudio from '../data/listenAudio.json'

// The recording of a verse in a tradition, or null if there isn't one
export function listenUrl(pasukId, tradition) {
  const file = listenAudio[pasukId]?.[tradition]?.file
  return file ? import.meta.env.BASE_URL + file : null
}

// Plays a recording; returns a cancel function
export function playRecording(url, { onEnd, onError } = {}) {
  const audio = new Audio(url)
  let finished = false
  function finish(err) {
    if (finished) return
    finished = true
    audio.pause()
    if (err) onError?.(err)
    else onEnd?.()
  }
  audio.onended = () => finish()
  audio.onerror = () => finish('Audio playback failed.')
  audio.play().catch(e => finish(e.message))
  return function cancel() { finish() }
}
