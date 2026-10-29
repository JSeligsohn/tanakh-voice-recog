// AudioWorklet for the live reader: the microphone at the device's rate →
// 16 kHz mono 16-bit PCM (what the phoneme model listens at), posted about
// every 100 ms as { pcm: ArrayBuffer, rms } (rms: its loudness, 0–1). Each output sample is the average of the
// input it covers (a simple low-pass, as the server's to16k does), so a 44.1
// or 48 kHz mic works the same.

/* global AudioWorkletProcessor, sampleRate, registerProcessor */

const OUT_RATE = 16000
const CHUNK = 1600

class LiveCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.step = sampleRate / OUT_RATE
    this.pos = 0
    this.sum = 0
    this.n = 0
    this.out = new Int16Array(CHUNK)
    this.len = 0
    this.energy = 0
  }

  process(inputs) {
    const input = inputs[0]?.[0]
    if (!input) return true
    for (let i = 0; i < input.length; i++) {
      this.sum += input[i]
      this.n += 1
      this.pos += 1
      if (this.pos >= this.step) {
        this.pos -= this.step
        const v = Math.max(-1, Math.min(1, this.sum / this.n))
        this.sum = 0
        this.n = 0
        this.out[this.len++] = v < 0 ? v * 0x8000 : v * 0x7fff
        this.energy += v * v
        if (this.len === CHUNK) {
          this.port.postMessage({ pcm: this.out.buffer, rms: Math.sqrt(this.energy / CHUNK) }, [this.out.buffer])
          this.energy = 0
          this.out = new Int16Array(CHUNK)
          this.len = 0
        }
      }
    }
    return true
  }
}

registerProcessor('live-capture', LiveCapture)
