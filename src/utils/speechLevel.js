// How loud the reader is against the room, for the live reader: from the
// loudness (RMS) of the audio in short pieces, the quiet end (the room: a
// fan, hiss, breathing) and the loud end (the voice). A piece counts as
// speech when it's above the room by `above` of the way up to the voice.
// Used by the server (a pause after the last word, through room noise: a
// tenth, which kept the bench's false reds where they were, where a fifth
// added two) and the browser (stopping on its own when the reader goes quiet:
// a fifth, so a fan doesn't keep it listening).

const KEEP = 3000
// The voice must reach this (about −40 dB) to count as speech at all:
// before anyone speaks, a quiet room's own ups and downs (a click, the mic's
// gain settling) are many times its quietest moments, and would pass
const MIN_VOICE = 0.01

export class SpeechLevel {
  constructor({ above = 0.2 } = {}) {
    this.above = above
    this.values = []
    this.cached = undefined
  }

  add(rms) {
    // exact silence: a mic that isn't delivering yet (utils/micReady.js), not the room
    if (!(rms > 0)) return
    this.values.push(rms)
    if (this.values.length > KEEP) this.values.splice(0, this.values.length - KEEP)
    this.cached = undefined
  }

  // The loudness above which a piece is speech, or null before any speech
  // (nothing yet well above the room)
  threshold() {
    if (this.cached !== undefined) return this.cached
    const n = this.values.length
    if (n < 5) return (this.cached = null)
    const sorted = this.values.slice().sort((a, b) => a - b)
    const room = Math.max(sorted[Math.floor(0.1 * (n - 1))], 1e-4)
    const voice = sorted[Math.floor(0.9 * (n - 1))]
    return (this.cached = voice < room * 4 || voice < MIN_VOICE ? null : room + this.above * (voice - room))
  }

  isSpeech(rms) {
    const t = this.threshold()
    return t !== null && rms > t
  }
}

export function rmsOf(samples, from = 0, to = samples.length) {
  let sum = 0
  for (let i = from; i < to; i++) sum += samples[i] * samples[i]
  return to > from ? Math.sqrt(sum / (to - from)) : 0
}
