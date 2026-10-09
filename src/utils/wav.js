// Recorded audio (webm/ogg/mp4 from MediaRecorder) → base64 mono 16-bit WAV
// at 24 kHz, the format sent to the OpenAI audio model. 24 kHz keeps speech
// clear while halving the size of a typical 48 kHz recording, so about a
// minute of audio fits under the server's 4.5 MB request limit.

const TARGET_RATE = 24000

export async function blobToWavBase64(blob) {
  // decodeAudioData resamples to the context's sample rate
  const ctx = new OfflineAudioContext(1, 1, TARGET_RATE)
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  return toBase64(encodeWav(decoded.getChannelData(0), decoded.sampleRate))
}

function encodeWav(samples, sampleRate) {
  const dataSize = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)) }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)            // fmt chunk size
  view.setUint16(20, 1, true)             // PCM
  view.setUint16(22, 1, true)             // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)             // block align
  view.setUint16(34, 16, true)            // bits per sample
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }
  return buffer
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
