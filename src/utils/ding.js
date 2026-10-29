// The live reader's sounds (Web Audio, no files): a soft two-note chime for
// the "about to stop" popup, and a rising one for a verse read all right.
// Each returns how long it lasts, in ms.

let ctx = null

// Call on a click (Start): browsers only let a page make sound from an audio
// context opened by one, and the popup comes up on its own later
export function prepareDing() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  } catch {
    // no sound available
  }
}

export function playDing() {
  // two notes a fifth apart, each fading out like a bell
  play([[880, 0, 0.35], [1320, 0.12, 0.35]], 0.18)
  return 550
}

// C, E, G, then the C above, ringing on
export function playSuccess() {
  play([[523.25, 0, 0.3], [659.25, 0.09, 0.3], [783.99, 0.18, 0.3], [1046.5, 0.27, 0.8]], 0.15)
  return 1100
}

// notes: [frequency, start (s), length (s)]
function play(notes, peak) {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const start = ctx.currentTime + 0.02
    for (const [freq, delay, length] of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = start + delay
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + length + 0.05)
    }
  } catch {
    // no sound available: the popup still shows
  }
}
