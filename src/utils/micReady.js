// Waits until a freshly opened microphone stream is delivering real audio.
//
// A recorder reports "started" as soon as the browser is ready, but many mics
// keep sending pure digital silence (exact zeros) for a while after opening —
// Bluetooth headsets switching into mic mode can take 0.5–2s. Anything said
// in that window is lost, so we only tell the reader to start once samples are
// non-zero. Even a quiet room produces tiny non-zero levels; a mic that isn't
// delivering yet produces exact zeros.
//
// Resolves { ready, ms }: ready=false means we gave up after timeoutMs (the
// caller should proceed anyway rather than block the reader).
//
// Browsers may keep an AudioContext suspended until a user gesture, and
// resume() then never settles. If it isn't running shortly we can't inspect
// the audio, so we fall back to the old fixed wait instead of hanging.
const FALLBACK_WAIT_MS = 250

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export async function waitForAudio(stream, { timeoutMs = 3000, pollMs = 25 } = {}) {
  const ctx = new AudioContext()
  try {
    if (ctx.state === 'suspended') {
      await Promise.race([ctx.resume().catch(() => {}), sleep(200)])
      if (ctx.state !== 'running') {
        await sleep(FALLBACK_WAIT_MS)
        return { ready: false, ms: 0, reason: 'audio inspection unavailable' }
      }
    }
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    ctx.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    const start = performance.now()
    while (performance.now() - start < timeoutMs) {
      analyser.getFloatTimeDomainData(samples)
      if (samples.some(v => v !== 0)) return { ready: true, ms: Math.round(performance.now() - start) }
      await sleep(pollMs)
    }
    return { ready: false, ms: timeoutMs, reason: 'still silent' }
  } finally {
    ctx.close()
  }
}
