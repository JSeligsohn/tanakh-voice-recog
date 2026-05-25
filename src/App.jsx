import { useState, useRef, useEffect } from 'react'
import { psukim } from './data/psukim'
import { startPronunciationAssessment } from './services/speechAssessment'
import { speakHebrew } from './services/tts'
import { splitHebrewToGroups, mapPhonemesToGroups, reconcileWords } from './utils/hebrew'
import HistorySidebar from './components/HistorySidebar'
import './App.css'

function scoreColor(score, errorType) {
  if (errorType === 'Omission') return '#9ca3af'
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#d97706'
  return '#dc2626'
}

function scoreLabel(score, errorType) {
  if (errorType === 'Omission') return 'Skipped'
  if (errorType === 'Insertion') return 'Extra word'
  if (errorType === 'Mispronunciation') return 'Mispronounced'
  if (score >= 80) return 'Good'
  if (score >= 60) return 'Needs work'
  return 'Incorrect'
}

function WordChip({ word, score, errorType, isSelected, onClick }) {
  const color = scoreColor(score, errorType)
  const isOmitted = errorType === 'Omission'

  return (
    <span
      className={`word-chip ${isSelected ? 'word-chip--selected' : ''}`}
      onClick={onClick}
      title="Click for phoneme breakdown"
    >
      <span
        className="word-text"
        style={{
          color: isOmitted ? '#9ca3af' : 'inherit',
          textDecoration: isOmitted ? 'line-through' : 'none',
          borderBottom: `3px solid ${color}`,
          background: isSelected ? `${color}18` : 'transparent',
          borderRadius: '3px',
          padding: '0 2px',
        }}
      >
        {word}
      </span>
    </span>
  )
}

function PhonemePanel({ wordData, onClose }) {
  const { word, score, errorType, phonemes } = wordData
  const color = scoreColor(score, errorType)
  const groups = splitHebrewToGroups(word)
  const mapped = mapPhonemesToGroups(groups, phonemes)
  const isPerfect = groups.length === (phonemes?.length ?? 0)

  const [isPlaying, setIsPlaying] = useState(false)
  const cancelRef = useRef(null)

  // Stop audio when the selected word changes or the panel unmounts
  useEffect(() => {
    setIsPlaying(false)
    cancelRef.current?.()
    return () => cancelRef.current?.()
  }, [word])

  function handleListen() {
    if (isPlaying) {
      cancelRef.current?.()
      setIsPlaying(false)
      return
    }
    setIsPlaying(true)
    cancelRef.current = speakHebrew(word, {
      onEnd:   () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    })
  }

  return (
    <div className="phoneme-panel">
      <div className="phoneme-panel-header">
        <span className="phoneme-panel-badge" style={{ background: color }}>
          {Math.round(score)}/100 — {scoreLabel(score, errorType)}
        </span>
        <button
          className={`btn-listen btn-word-listen ${isPlaying ? 'btn-listen--active' : ''}`}
          onClick={handleListen}
          title={isPlaying ? 'Stop' : 'Hear Azure pronounce this word'}
        >
          <span className="listen-icon">{isPlaying ? '■' : '▶'}</span>
          {isPlaying ? 'Stop' : 'Listen'}
        </button>
        <span className="phoneme-panel-word" dir="rtl" lang="he">{word}</span>
        <button className="phoneme-panel-close" onClick={() => { cancelRef.current?.(); onClose() }} aria-label="Close">✕</button>
      </div>

      {mapped.length > 0 ? (
        <>
          <div className="char-breakdown" dir="rtl">
            {mapped.map((item, i) => {
              const cColor = item.score !== null ? scoreColor(item.score, 'None') : '#d6d3d1'
              return (
                <div key={i} className="char-item">
                  <span className="char-glyph" style={{ color: cColor }} lang="he">
                    {item.chars}
                  </span>
                  {item.score !== null && (
                    <span className="char-score" style={{ color: cColor }}>
                      {Math.round(item.score)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          {!isPerfect && (
            <p className="phoneme-note">
              Scores are approximate — Azure returned {phonemes?.length ?? 0} phonemes for {groups.length} letter groups.
            </p>
          )}
        </>
      ) : (
        <p className="phoneme-empty">No breakdown available for this word.</p>
      )}
    </div>
  )
}

function ScoreRing({ value, label }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const color = value >= 80 ? '#16a34a' : value >= 60 ? '#d97706' : '#dc2626'

  return (
    <div className="score-ring">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={radius} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="41" textAnchor="middle" fontSize="14" fontWeight="600" fill={color}>
          {Math.round(value)}
        </text>
      </svg>
      <span className="score-ring-label">{label}</span>
    </div>
  )
}

export default function App() {
  const [pasukIdx, setPasukIdx] = useState(0)
  const [phase, setPhase] = useState('idle')
  const [wordResults, setWordResults] = useState([])
  const [scores, setScores] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedWordIdx, setSelectedWordIdx] = useState(null)
  const [listenPhase, setListenPhase] = useState('idle')
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  const recognizerRef = useRef(null)
  const cancelTtsRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const blobPromiseRef = useRef(null) // resolves with Blob (or null) when recorder stops
  const prepareTimerRef = useRef(null)

  const pasuk = psukim[pasukIdx]

  function startMediaRecorder() {
    audioChunksRef.current = []
    // Create a promise that resolves with the blob once recorder.onstop fires.
    // onResult awaits this so we never race ahead of the recorder.
    let resolveBlobPromise
    blobPromiseRef.current = new Promise(resolve => { resolveBlobPromise = resolve })

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
      .find(t => MediaRecorder.isTypeSupported(t)) || ''

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
        recorder.onstop = () => {
          const blob = audioChunksRef.current.length > 0
            ? new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
            : null
          resolveBlobPromise(blob)
          stream.getTracks().forEach(t => t.stop())
        }
        recorder.start(250)
        mediaRecorderRef.current = recorder
      })
      .catch(() => resolveBlobPromise(null))
  }

  function stopMediaRecorder() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  function discardMediaRecorder() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.onstop = () => {}  // discard blob
      mediaRecorderRef.current.stop()
    }
    blobPromiseRef.current = null
    audioChunksRef.current = []
  }

  function addToHistory(words, scores, audioUrl) {
    const entry = {
      id: Date.now(),
      timestamp: Date.now(),
      pasukIdx,
      pasukRef: pasuk.reference,
      scores,
      wordResults: words,
      audioUrl,
    }
    // Store up to 3 per verse; revoke dropped URL to free memory
    setHistory(prev => {
      const verseEntries = prev.filter(e => e.pasukIdx === pasukIdx)
      const others = prev.filter(e => e.pasukIdx !== pasukIdx)
      if (verseEntries.length >= 3 && verseEntries[2]?.audioUrl) {
        URL.revokeObjectURL(verseEntries[2].audioUrl)
      }
      return [entry, ...verseEntries.slice(0, 2), ...others]
    })
  }

  function handleRecord() {
    cancelTtsRef.current?.()
    setListenPhase('idle')
    setPhase('preparing')
    setWordResults([])
    setScores(null)
    setErrorMsg('')
    setSelectedWordIdx(null)
    startMediaRecorder()

    // Fallback: show recording UI after 3s even if onReady hasn't fired
    prepareTimerRef.current = setTimeout(
      () => setPhase(p => p === 'preparing' ? 'recording' : p),
      3000
    )

    recognizerRef.current = startPronunciationAssessment(
      pasuk.text,
      ({ words, scores }) => {
        clearTimeout(prepareTimerRef.current)
        const reconciled = reconcileWords(pasuk.text, words)
        ;(blobPromiseRef.current ?? Promise.resolve(null)).then(blob => {
          const audioUrl = blob ? URL.createObjectURL(blob) : null
          addToHistory(reconciled, scores, audioUrl)
          setShowHistory(true)
        })
        setPhase('done')
        setScores(scores)
        setWordResults(reconciled)
      },
      (err) => {
        clearTimeout(prepareTimerRef.current)
        discardMediaRecorder()
        setPhase('error')
        setErrorMsg(typeof err === 'string' ? err : 'Something went wrong. Please try again.')
      },
      () => {
        clearTimeout(prepareTimerRef.current)
        setPhase(p => p === 'preparing' ? 'recording' : p)
      }
    )
  }

  function handleDone() {
    setPhase('processing')
    stopMediaRecorder()
    recognizerRef.current?.stop()
  }

  function handleCancel() {
    clearTimeout(prepareTimerRef.current)
    discardMediaRecorder()
    recognizerRef.current?.cancel()
    setPhase('idle')
  }

  function handleReset() {
    setPhase('idle')
    setWordResults([])
    setScores(null)
    setErrorMsg('')
    setSelectedWordIdx(null)
  }

  function handleWordClick(idx) {
    setSelectedWordIdx(prev => prev === idx ? null : idx)
  }

  function handleListen() {
    if (listenPhase === 'playing') {
      cancelTtsRef.current?.()
      setListenPhase('idle')
      return
    }
    setListenPhase('playing')
    cancelTtsRef.current = speakHebrew(pasuk.text, {
      onEnd:   () => setListenPhase('idle'),
      onError: () => setListenPhase('idle'),
    })
  }

  return (
    <div className={`app-shell ${showHistory ? 'app-shell--open' : ''}`}>
      <div className="app">
        <header className="app-header">
          <div className="app-header-content">
            <h1>תנ״ך Reading Practice</h1>
            <p>Record yourself reading the verse and receive word-by-word pronunciation feedback</p>
          </div>
          {history.filter(e => e.pasukIdx === pasukIdx).length > 0 && (
            <button
              className={`btn-history-toggle ${showHistory ? 'btn-history-toggle--active' : ''}`}
              onClick={() => setShowHistory(s => !s)}
            >
              <span className="history-toggle-icon">🕐</span>
              Attempts
              <span className="history-count">{history.filter(e => e.pasukIdx === pasukIdx).length}</span>
            </button>
          )}
        </header>

        <main className="app-main">
          <div className="pasuk-selector">
            <label htmlFor="pasuk-select">Verse</label>
            <select
              id="pasuk-select"
              value={pasukIdx}
              onChange={(e) => {
                setPasukIdx(Number(e.target.value))
                handleReset()
                cancelTtsRef.current?.()
                setListenPhase('idle')
              }}
              disabled={phase === 'recording'}
            >
              {psukim.map((p, i) => (
                <option key={i} value={i}>{p.book}</option>
              ))}
            </select>
          </div>

          <div className="pasuk-card">
            <div className="hebrew-text" dir="rtl" lang="he">
              {phase === 'done' && wordResults.length > 0
                ? wordResults.map((w, i) => (
                    <WordChip
                      key={i}
                      {...w}
                      isSelected={selectedWordIdx === i}
                      onClick={() => handleWordClick(i)}
                    />
                  ))
                : <span>{pasuk.text}</span>
              }
            </div>
            {phase === 'done' && wordResults.length > 0 && (
              <p className="click-hint">Click any highlighted word to see phoneme breakdown</p>
            )}
            <div className="pasuk-meta">
              <div className="pasuk-meta-top">
                <span className="pasuk-ref">{pasuk.reference}</span>
                <button
                  className={`btn-listen ${listenPhase !== 'idle' ? 'btn-listen--active' : ''}`}
                  onClick={handleListen}
                  disabled={phase === 'recording' || phase === 'processing'}
                  title={listenPhase === 'idle' ? 'Hear Azure read this verse' : 'Stop'}
                >
                  {listenPhase === 'playing' && <span className="listen-icon">■</span>}
                  {listenPhase === 'idle'    && <span className="listen-icon">▶</span>}
                  {listenPhase === 'playing' ? 'Stop' : 'Listen'}
                </button>
              </div>
              <span className="pasuk-translation">{pasuk.translation}</span>
            </div>
          </div>

          {selectedWordIdx !== null && wordResults[selectedWordIdx] && (
            <PhonemePanel
              wordData={wordResults[selectedWordIdx]}
              onClose={() => setSelectedWordIdx(null)}
            />
          )}

          <div className="controls">
            {phase === 'idle' && (
              <button
                className="btn btn-record"
                onClick={handleRecord}
                disabled={listenPhase !== 'idle'}
              >
                <span className="record-dot" /> Start Recording
              </button>
            )}

            {phase === 'preparing' && (
              <div className="preparing-state">
                <div className="spinner" />
                <p>Starting microphone…</p>
                <button className="btn btn-cancel" onClick={handleCancel}>Cancel</button>
              </div>
            )}

            {phase === 'recording' && (
              <div className="recording-state">
                <div className="recording-indicator">
                  <span className="pulse-ring" />
                  <span className="record-dot active" />
                </div>
                <p>Read the verse aloud</p>
                <div className="recording-actions">
                  <button className="btn btn-done" onClick={handleDone}>Done Reading</button>
                  <button className="btn btn-cancel" onClick={handleCancel}>Cancel</button>
                </div>
              </div>
            )}

            {phase === 'processing' && (
              <div className="processing-state">
                <div className="spinner" />
                <p>Analyzing pronunciation…</p>
              </div>
            )}

            {phase === 'done' && (
              <button className="btn btn-reset" onClick={handleReset}>↺ Try Again</button>
            )}

            {phase === 'error' && (
              <div className="error-state">
                <p className="error-msg">{errorMsg}</p>
                <button className="btn btn-reset" onClick={handleReset}>↺ Try Again</button>
              </div>
            )}
          </div>

          {scores && (
            <div className="score-panel">
              <div className="score-rings">
                <ScoreRing value={scores.pronunciation} label="Overall" />
                <ScoreRing value={scores.accuracy} label="Accuracy" />
                <ScoreRing value={scores.fluency} label="Fluency" />
                <ScoreRing value={scores.completeness} label="Complete" />
              </div>
              <p className="score-note">
                Scored against <strong>Modern Israeli (Sephardic)</strong> pronunciation — Biblical/Ashkenazi readers may score lower on some phonemes.
              </p>
            </div>
          )}
        </main>
      </div>

      {showHistory && (
        <HistorySidebar
          history={history.filter(e => e.pasukIdx === pasukIdx)}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}
