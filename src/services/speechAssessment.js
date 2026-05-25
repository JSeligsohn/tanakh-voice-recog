import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk'

export function startPronunciationAssessment(referenceText, onResult, onError, onReady) {
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

  const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput()
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig)
  pronunciationConfig.applyTo(recognizer)

  // Accumulate results across segments (user may pause mid-verse)
  const allWords = []
  let latestScores = null

  recognizer.recognized = (s, e) => {
    if (e.result.reason !== SpeechSDK.ResultReason.RecognizedSpeech) return
    try {
      // Parse the raw JSON — more reliable than PronunciationAssessmentResult.words in the JS SDK
      const json = JSON.parse(e.result.json)
      const nbest = json?.NBest?.[0]
      if (!nbest) return

      for (const w of (nbest.Words ?? [])) {
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

      if (nbest.PronunciationAssessment) {
        const pa = nbest.PronunciationAssessment
        latestScores = {
          pronunciation: pa.PronScore ?? pa.PronunciationScore ?? 0,
          accuracy: pa.AccuracyScore ?? 0,
          fluency: pa.FluencyScore ?? 0,
          completeness: pa.CompletenessScore ?? 0,
        }
      }
    } catch { /* malformed JSON — skip segment */ }
  }

  recognizer.startContinuousRecognitionAsync(
    () => { onReady?.() },
    (err) => {
      onError(typeof err === 'string' ? err : 'Microphone access failed. Check your browser permissions.')
      recognizer.close()
    }
  )

  return {
    stop() {
      recognizer.stopContinuousRecognitionAsync(
        () => {
          if (allWords.length > 0 && latestScores) {
            onResult({ words: allWords, scores: latestScores })
          } else {
            onError('No speech was detected. Make sure your microphone is working and try again.')
          }
          recognizer.close()
        },
        (err) => {
          onError(typeof err === 'string' ? err : 'Failed to stop recording.')
          recognizer.close()
        }
      )
    },
    cancel() {
      recognizer.stopContinuousRecognitionAsync(
        () => recognizer.close(),
        () => recognizer.close()
      )
    },
  }
}
