import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'

// Returns a cancel function.
// We pass null as AudioConfig so the SDK does NOT auto-play — we control
// playback via our own Audio element, which gives us a reliable onended event.
export function speakHebrew(text, { onEnd, onError } = {}) {
  const key = import.meta.env.VITE_AZURE_SPEECH_KEY
  const region = import.meta.env.VITE_AZURE_SPEECH_REGION

  const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region)
  speechConfig.speechSynthesisVoiceName = 'he-IL-AvriNeural'

  const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, null)
  let audioEl = null
  let finished = false

  function finish(err) {
    if (finished) return
    finished = true
    if (audioEl) { audioEl.pause(); audioEl.src = '' }
    synthesizer.close()
    if (err) onError?.(err)
    else onEnd?.()
  }

  synthesizer.speakTextAsync(
    text,
    (result) => {
      if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted && result.audioData?.byteLength > 0) {
        const blob = new Blob([result.audioData], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        audioEl = new Audio(url)
        audioEl.onended = () => { URL.revokeObjectURL(url); finish() }
        audioEl.onerror = () => { URL.revokeObjectURL(url); finish('Audio playback failed.') }
        audioEl.play().catch(e => finish(e.message))
      } else {
        finish('Synthesis failed — try again.')
      }
    },
    (err) => finish(typeof err === 'string' ? err : 'Speech synthesis failed.')
  )

  return function cancel() { finish() }
}
