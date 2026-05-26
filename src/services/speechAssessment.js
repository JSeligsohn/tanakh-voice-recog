import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'

// Wire a MediaStream into an Azure PushAudioInputStream so both the MediaRecorder
// and Azure share one physical mic connection. Returns { audioConfig, cleanup }.
function createAudioConfigFromStream(stream) {
  const format = SpeechSDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
  const pushStream = SpeechSDK.AudioInputStream.createPushStream(format)

  const audioCtx = new AudioContext()
  const source = audioCtx.createMediaStreamSource(stream)
  // ScriptProcessorNode is deprecated but has universal support; AudioWorklet would
  // require a separate worker file and complicates the build.
  const processor = audioCtx.createScriptProcessor(4096, 1, 1)

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0)
    const srcRate = audioCtx.sampleRate
    const dstRate = 16000

    // Downsample to 16 kHz if the hardware runs at a higher rate (44.1 / 48 kHz)
    let samples = input
    if (srcRate !== dstRate) {
      const ratio = srcRate / dstRate
      const outLen = Math.round(input.length / ratio)
      samples = new Float32Array(outLen)
      for (let i = 0; i < outLen; i++) {
        samples[i] = input[Math.min(Math.round(i * ratio), input.length - 1)]
      }
    }

    const pcm = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
      pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)))
    }
    pushStream.write(pcm.buffer)
  }

  source.connect(processor)
  processor.connect(audioCtx.destination)

  function cleanup() {
    processor.disconnect()
    source.disconnect()
    pushStream.close()
    audioCtx.close()
  }

  return { audioConfig: SpeechSDK.AudioConfig.fromStreamInput(pushStream), cleanup }
}

export function startPronunciationAssessment(referenceText, onResult, onError, onReady, stream, onSegment) {
  const key = import.meta.env.VITE_AZURE_SPEECH_KEY
  const region = import.meta.env.VITE_AZURE_SPEECH_REGION

  const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region)
  speechConfig.speechRecognitionLanguage = 'he-IL'

  const pronunciationConfig = new SpeechSDK.PronunciationAssessmentConfig(
    referenceText,
    SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
    SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
    true // enableMiscue: detect omissions and insertions vs reference text
  )

  let audioCleanup = null
  let audioConfig

  if (stream) {
    const result = createAudioConfigFromStream(stream)
    audioConfig = result.audioConfig
    audioCleanup = result.cleanup
  } else {
    audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput()
  }

  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig)
  pronunciationConfig.applyTo(recognizer)

  // Accumulate results across segments (user may pause mid-verse)
  const allWords = []
  const allSegmentScores = []

  recognizer.recognized = (s, e) => {
    if (e.result.reason !== SpeechSDK.ResultReason.RecognizedSpeech) return
    try {
      // Parse the raw JSON — more reliable than PronunciationAssessmentResult.words in the JS SDK
      const json = JSON.parse(e.result.json)
      onSegment?.(json)
      const nbest = json?.NBest?.[0]
      if (!nbest) return

      const segmentWords = nbest.Words ?? []
      for (const w of segmentWords) {
        allWords.push({
          word: w.Word,
          score: w.PronunciationAssessment?.AccuracyScore ?? 0,
          errorType: w.PronunciationAssessment?.ErrorType ?? 'None',
          phonemes: (w.Phonemes ?? []).map(p => ({
            phoneme: p.Phoneme,
            accuracyScore: p.PronunciationAssessment?.AccuracyScore ?? 0,
          })),
        })
      }

      if (nbest.PronunciationAssessment && segmentWords.length > 0) {
        const pa = nbest.PronunciationAssessment
        allSegmentScores.push({
          wordCount: segmentWords.length,
          pronunciation: pa.PronScore ?? pa.PronunciationScore ?? 0,
          accuracy: pa.AccuracyScore ?? 0,
          fluency: pa.FluencyScore ?? 0,
        })
      }
    } catch { /* malformed JSON — skip segment */ }
  }

  recognizer.startContinuousRecognitionAsync(
    () => { onReady?.() },
    (err) => {
      audioCleanup?.()
      onError(typeof err === 'string' ? err : 'Microphone access failed. Check your browser permissions.')
      recognizer.close()
    }
  )

  return {
    stop() {
      recognizer.stopContinuousRecognitionAsync(
        () => {
          audioCleanup?.()
          if (allWords.length > 0 && allSegmentScores.length > 0) {
            const totalWords = allSegmentScores.reduce((s, seg) => s + seg.wordCount, 0)
            const wavg = (key) => allSegmentScores.reduce((s, seg) => s + seg[key] * seg.wordCount, 0) / totalWords
            const refWordCount = referenceText.split(/\s+/).filter(Boolean).length
            const spokenCount = allWords.filter(w => w.errorType !== 'Omission').length
            const scores = {
              pronunciation: wavg('pronunciation'),
              accuracy: wavg('accuracy'),
              fluency: wavg('fluency'),
              completeness: refWordCount > 0 ? (spokenCount / refWordCount) * 100 : 0,
            }
            onResult({ words: allWords, scores })
          } else {
            onError('No speech was detected. Make sure your microphone is working and try again.')
          }
          recognizer.close()
        },
        (err) => {
          audioCleanup?.()
          onError(typeof err === 'string' ? err : 'Failed to stop recording.')
          recognizer.close()
        }
      )
    },
    cancel() {
      recognizer.stopContinuousRecognitionAsync(
        () => { audioCleanup?.(); recognizer.close() },
        () => { audioCleanup?.(); recognizer.close() }
      )
    },
  }
}
