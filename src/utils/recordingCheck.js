// Checks whether a recording's start was cut off. Cut-offs are intermittent,
// so instead of reproducing them we inspect every recording after it stops.
//
// A recording starts when the recorder starts. A mic that is still waking up
// delivers exact digital zeros first; then real audio arrives. In a normal
// take, real audio begins with a moment of quiet room noise before the first
// word, because the reader waits for the "read now" cue (shown at least
// ~150ms after audio is flowing). If speech is already loud within the first
// few ms of real audio, the reader was mid-word when sound began — the start
// was lost, whether the mic was slow or the reader started early.

const SOUND_EPSILON = 1e-6   // above this a sample is real audio, not digital silence
const FRAME_MS = 10
const CUT_OFF_LEAD_MS = 50   // less quiet than this before speech = start was cut

// Pure analysis of decoded samples. readyAtMs: when the "read now" cue was
// shown, in ms since the recorder started (optional).
export function analyzeRecordingStart(samples, sampleRate, { readyAtMs = null } = {}) {
  const toMs = n => Math.round((n / sampleRate) * 1000)
  let first = 0
  while (first < samples.length && Math.abs(samples[first]) <= SOUND_EPSILON) first++
  const silentLeadMs = toMs(first)

  // RMS per 10ms frame of real audio
  const frameLen = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000))
  const rms = []
  for (let i = first; i + frameLen <= samples.length; i += frameLen) {
    let sum = 0
    for (let j = i; j < i + frameLen; j++) sum += samples[j] * samples[j]
    rms.push(Math.sqrt(sum / frameLen))
  }
  const base = { silentLeadMs, readyAtMs, durationMs: toMs(samples.length) }
  if (rms.length === 0) return { ...base, speechDetected: false, cutOff: false }

  // Room noise vs. speech level, from the quiet and loud ends of the take
  const sorted = [...rms].sort((a, b) => a - b)
  const floor = sorted[Math.floor(sorted.length * 0.1)]
  const peak = sorted[Math.floor(sorted.length * 0.95)]
  const speechDetected = peak > Math.max(floor * 4, 0.01)
  if (!speechDetected) return { ...base, speechDetected, cutOff: false }

  const threshold = floor + 0.2 * (peak - floor)
  const onsetFrame = rms.findIndex(v => v > threshold)
  const quietBeforeSpeechMs = onsetFrame * FRAME_MS
  const speechOnsetMs = silentLeadMs + quietBeforeSpeechMs
  return {
    ...base,
    speechDetected,
    speechOnsetMs,
    quietBeforeSpeechMs,
    cutOff: quietBeforeSpeechMs < CUT_OFF_LEAD_MS,
    startedBeforeCue: readyAtMs != null && speechOnsetMs < readyAtMs,
  }
}

// Decode a recorded Blob and analyze its start. `mic` carries the timings
// logged when recording began (label, readyAtMs, ...) and is merged in.
export async function checkRecording(blob, mic = {}) {
  const ctx = new OfflineAudioContext(1, 1, 48000)
  const audio = await ctx.decodeAudioData(await blob.arrayBuffer())
  return { ...mic, ...analyzeRecordingStart(audio.getChannelData(0), audio.sampleRate, { readyAtMs: mic.readyAtMs }) }
}
