// Kaldi-style log mel filterbank features, as lhotse's Fbank computes them for
// ZIPA (80 filters, 25 ms window, 10 ms shift, no dither, snip_edges off).
// Samples are floats in [-1, 1] at 16 kHz. Returns { feats: Float32Array, T }
// with 80 values per frame.

const RATE = 16000, LEN = 400, SHIFT = 160, NFFT = 512, BINS = 80
const PREEMPH = 0.97, LOW = 20, EPS = 1.1920928955078125e-7

export const fbankConfig = { highFreq: -400 }

const mel = f => 1127 * Math.log(1 + f / 700)

let window, banks, banksFor
function setup(highFreq) {
  window = new Float64Array(LEN)
  for (let j = 0; j < LEN; j++) window[j] = Math.pow(0.5 - 0.5 * Math.cos((2 * Math.PI * j) / (LEN - 1)), 0.85)
  const nyquist = RATE / 2
  const high = highFreq <= 0 ? nyquist + highFreq : highFreq
  const mLow = mel(LOW), mHigh = mel(high), delta = (mHigh - mLow) / (BINS + 1)
  banks = []
  for (let m = 0; m < BINS; m++) {
    const left = mLow + m * delta, center = left + delta, right = center + delta
    const w = new Float64Array(NFFT / 2 + 1)
    for (let k = 0; k < NFFT / 2; k++) {
      const x = mel((k * RATE) / NFFT)
      if (x > left && x < right) w[k] = x <= center ? (x - left) / (center - left) : (right - x) / (right - center)
    }
    banks.push(w)
  }
  banksFor = highFreq
}

// In-place radix-2 FFT of a real frame; returns the power spectrum
function powerSpectrum(frame) {
  const re = Float64Array.from(frame), im = new Float64Array(NFFT)
  for (let i = 1, j = 0; i < NFFT; i++) {
    let bit = NFFT >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { [re[i], re[j]] = [re[j], re[i]] }
  }
  for (let size = 2; size <= NFFT; size <<= 1) {
    const half = size >> 1, step = (-2 * Math.PI) / size
    for (let start = 0; start < NFFT; start += size) {
      for (let k = 0; k < half; k++) {
        const c = Math.cos(step * k), s = Math.sin(step * k)
        const a = start + k, b = a + half
        const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c
        re[b] = re[a] - tr; im[b] = im[a] - ti
        re[a] += tr; im[a] += ti
      }
    }
  }
  const p = new Float64Array(NFFT / 2 + 1)
  for (let k = 0; k <= NFFT / 2; k++) p[k] = re[k] * re[k] + im[k] * im[k]
  return p
}

export function fbank(samples) {
  if (banksFor !== fbankConfig.highFreq) setup(fbankConfig.highFreq)
  const N = samples.length
  // snip_edges off: frames centred every 10 ms, the edges reflected
  const T = Math.floor((N + SHIFT / 2) / SHIFT)
  const at = s => (s < 0 ? samples[-s - 1] : s >= N ? samples[2 * N - 1 - s] : samples[s])
  const feats = new Float32Array(T * BINS)
  const frame = new Float64Array(NFFT)
  for (let t = 0; t < T; t++) {
    const start = t * SHIFT + SHIFT / 2 - LEN / 2
    let mean = 0
    for (let j = 0; j < LEN; j++) { frame[j] = at(start + j); mean += frame[j] }
    mean /= LEN
    for (let j = 0; j < LEN; j++) frame[j] -= mean
    for (let j = LEN - 1; j > 0; j--) frame[j] -= PREEMPH * frame[j - 1]
    frame[0] -= PREEMPH * frame[0]
    for (let j = 0; j < LEN; j++) frame[j] *= window[j]
    frame.fill(0, LEN)
    const p = powerSpectrum(frame)
    for (let m = 0; m < BINS; m++) {
      let e = 0
      const w = banks[m]
      for (let k = 0; k <= NFFT / 2; k++) e += w[k] * p[k]
      feats[t * BINS + m] = Math.log(Math.max(e, EPS))
    }
  }
  return { feats, T }
}
