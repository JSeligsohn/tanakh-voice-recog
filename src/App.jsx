import { useState, useRef, useEffect } from 'react'
import { psukim } from './data/psukim'
import { startPronunciationAssessment } from './services/speechAssessment'
import { assessWithOpenAI } from './services/openaiAssessment'
import { assessWithOpenAIRules } from './services/openaiRulesAssessment'
import { assessManual } from './services/manualAssessment'
import { speakHebrew } from './services/tts'
import { splitHebrewToGroups, mapPhonemesToGroups, reconcileWords } from './utils/hebrew'
import HistorySidebar from './components/HistorySidebar'
import ProgressView from './components/ProgressView'
import TeacherRoster from './components/TeacherRoster'
import { dummyStudents } from './data/progressDummy'
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

function WordChip({ word, score, errorType, isSelected, onClick, showScore }) {
  const color = scoreColor(score, errorType)
  const isOmitted = errorType === 'Omission'

  return (
    <span
      className={`word-chip ${isSelected ? 'word-chip--selected' : ''} ${showScore ? 'word-chip--with-score' : ''}`}
      onClick={onClick}
      title="Click for phoneme breakdown"
    >
      {showScore && (
        <span className="word-chip-score" style={{ color }}>
          {isOmitted ? '—' : Math.round(score)}
        </span>
      )}
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

function PhonemePanel({ wordData, provider, onClose }) {
  const { word, score, errorType, phonemes, phoneticHeard } = wordData
  const color = scoreColor(score, errorType)
  const groups = splitHebrewToGroups(word)
  // OpenAI returns natural Hebrew syllables (consonant+vowel groupings) — display
  // those directly. Azure returns per-phoneme scores which we map onto letter groups.
  const breakdownItems = provider === 'openai' && phonemes?.length > 0
    ? phonemes.map(p => ({ chars: p.phoneme, score: p.accuracyScore ?? null }))
    : mapPhonemesToGroups(groups, phonemes)
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

      {phoneticHeard && errorType !== 'Omission' && (
        <div className="phoneme-heard">
          <span className="phoneme-heard-label">Heard:</span>
          <span className="phoneme-heard-text">{phoneticHeard}</span>
        </div>
      )}

      {breakdownItems.length > 0 ? (
        <>
          <div className="char-breakdown" dir="rtl">
            {breakdownItems.map((item, i) => {
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
          {errorType === 'Omission' ? (
            <p className="phoneme-note">
              Word not detected in your recording — press Listen to hear how it should sound.
            </p>
          ) : !isPerfect && provider === 'azure' ? (
            <p className="phoneme-note">
              Scores are approximate — {phonemes?.length ?? 0} phonemes for {groups.length} letter groups.
            </p>
          ) : null}

          {phonemes?.some(p => p.note) && (
            <div className="syllable-notes">
              {phonemes.filter(p => p.note).map((p, i) => (
                <div key={i} className="syllable-note-row">
                  <span className="syllable-note-glyph" dir="rtl" lang="he">{p.phoneme}</span>
                  <span className="syllable-note-text">{p.note}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="phoneme-empty">No breakdown available for this word.</p>
      )}
    </div>
  )
}

const SCORING_MODES = [
  { value: 'default',    label: 'Default',    note: 'Azure standard — Overall includes fluency and completeness.' },
  { value: 'no-fluency', label: 'No Fluency', note: 'Overall = Accuracy (75%) + Completeness (25%). Fluency excluded.' },
  { value: 'curved',     label: 'Curved',     note: 'Accuracy-only scoring with a gentle curve — more lenient for natural reading variation.' },
]

function applyScoringMode(scores, mode) {
  if (!scores) return null
  if (mode === 'default') return scores
  const overall = scores.accuracy * 0.75 + scores.completeness * 0.25
  if (mode === 'no-fluency') return { ...scores, pronunciation: Math.round(overall) }
  // curved: power curve maps ~60→74, ~70→82, ~80→89, ~90→95
  const curve = v => Math.round(Math.pow(Math.max(0, v) / 100, 0.65) * 100)
  return { ...scores, pronunciation: curve(overall), accuracy: curve(scores.accuracy) }
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
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tanakh-history') ?? '[]') } catch { return [] }
  })
  const [showHistory, setShowHistory] = useState(false)
  const [viewingHistoryEntry, setViewingHistoryEntry] = useState(null)
  const [historyPlayPhase, setHistoryPlayPhase] = useState('idle')
  const [currentAudioUrl, setCurrentAudioUrl] = useState(null)
  const [currentPlayPhase, setCurrentPlayPhase] = useState('idle')
  const [currentRawSegments, setCurrentRawSegments] = useState([])
  const [showDebug, setShowDebug] = useState(false)
  const [scoringMode, setScoringMode] = useState('default')
  const [provider, setProvider] = useState(() => {
    const stored = localStorage.getItem('tanakh-provider')
    if (stored === 'gemini') return 'openai' // migrate prior local value
    return stored ?? 'azure'
  })
  const [tradition, setTradition] = useState(() => localStorage.getItem('tanakh-tradition') ?? 'sephardic')
  const [shevaMode, setShevaMode] = useState(() => localStorage.getItem('tanakh-sheva-mode') ?? 'enforce')
  const [manualInput, setManualInput] = useState('')

  // Top-level tab navigation: 'practice' (recording UI) or 'progress' (dashboards)
  const [activeTab, setActiveTab] = useState('practice')
  // Dev role toggle for prototyping the progress views (will become real auth later)
  const [devRole, setDevRole] = useState('student')
  // Which student the "self" view shows when devRole === 'student'. Fixed for now.
  const studentSelfId = 's1'
  // Which student the teacher is currently drilling into (null = show roster)
  const [teacherViewingId, setTeacherViewingId] = useState(null)

  useEffect(() => { localStorage.setItem('tanakh-provider', provider) }, [provider])
  useEffect(() => { localStorage.setItem('tanakh-tradition', tradition) }, [tradition])
  useEffect(() => { localStorage.setItem('tanakh-sheva-mode', shevaMode) }, [shevaMode])

  const recognizerRef = useRef(null)
  const cancelTtsRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const sharedStreamRef = useRef(null)
  const audioChunksRef = useRef([])
  const blobPromiseRef = useRef(null) // resolves with Blob (or null) when recorder stops
  const prepareTimerRef = useRef(null)
  const historyAudioRef = useRef(null)
  const currentAudioRef = useRef(null)

  // Persist history to localStorage; strip audioUrl — blob URLs don't survive reload
  useEffect(() => {
    try {
      localStorage.setItem('tanakh-history',
        JSON.stringify(history.map(({ audioUrl: _, ...rest }) => rest))
      )
    } catch { /* storage full or unavailable */ }
  }, [history])

  const pasuk = psukim[pasukIdx]
  const verseHistory = history.filter(e => e.pasukIdx === pasukIdx)

  // When a history entry is selected, the main view shows its data instead of the current session
  const displayWords = viewingHistoryEntry?.wordResults ?? wordResults
  const displayScores = viewingHistoryEntry?.scores ?? scores
  const displayRawSegments = viewingHistoryEntry?.rawSegments ?? currentRawSegments

  // Apply scoring mode curve to per-word and per-phoneme scores for rendering
  const curveScore = v => Math.round(Math.pow(Math.max(0, v) / 100, 0.65) * 100)
  const modeWords = scoringMode === 'curved'
    ? displayWords.map(w => ({
        ...w,
        score: w.errorType === 'Omission' ? w.score : curveScore(w.score),
        phonemes: w.phonemes.map(p => ({ ...p, accuracyScore: curveScore(p.accuracyScore) })),
      }))
    : displayWords
  const viewingAttemptNumber = viewingHistoryEntry
    ? verseHistory.length - verseHistory.findIndex(e => e.id === viewingHistoryEntry.id)
    : null

  function handleSelectHistoryEntry(entry) {
    historyAudioRef.current?.pause()
    historyAudioRef.current = null
    setHistoryPlayPhase('idle')
    setViewingHistoryEntry(entry)
    setSelectedWordIdx(null)
  }

  function handleExitHistoryView() {
    historyAudioRef.current?.pause()
    historyAudioRef.current = null
    setHistoryPlayPhase('idle')
    setViewingHistoryEntry(null)
    setSelectedWordIdx(null)
  }

  function handleCurrentAudioPlay() {
    if (currentPlayPhase !== 'idle') {
      currentAudioRef.current?.pause()
      currentAudioRef.current = null
      setCurrentPlayPhase('idle')
      return
    }
    if (!currentAudioUrl) {
      console.warn('[playback] no currentAudioUrl set')
      return
    }
    console.log('[playback] starting:', currentAudioUrl)
    setCurrentPlayPhase('playing')
    const audio = new Audio(currentAudioUrl)
    audio.onended = () => { currentAudioRef.current = null; setCurrentPlayPhase('idle') }
    audio.onerror = (e) => {
      console.error('[playback] audio element error:', audio.error, e)
      currentAudioRef.current = null
      setCurrentPlayPhase('idle')
    }
    currentAudioRef.current = audio
    audio.play().catch(err => {
      console.error('[playback] play() rejected:', err)
      setCurrentPlayPhase('idle')
    })
  }

  function handleHistoryAudioPlay() {
    if (historyPlayPhase !== 'idle') {
      historyAudioRef.current?.pause()
      historyAudioRef.current = null
      setHistoryPlayPhase('idle')
      return
    }
    if (!viewingHistoryEntry?.audioUrl) return
    setHistoryPlayPhase('playing')
    const audio = new Audio(viewingHistoryEntry.audioUrl)
    audio.onended = () => { historyAudioRef.current = null; setHistoryPlayPhase('idle') }
    audio.onerror = () => { historyAudioRef.current = null; setHistoryPlayPhase('idle') }
    historyAudioRef.current = audio
    audio.play().catch(() => setHistoryPlayPhase('idle'))
  }

  // Opens one getUserMedia stream shared by both MediaRecorder (for playback) and Azure (for assessment).
  // Resolves only AFTER the recorder is actually capturing audio, so callers can flip
  // the UI to "ready" without losing the first word.
  async function startSharedStream() {
    audioChunksRef.current = []
    let resolveBlobPromise
    blobPromiseRef.current = new Promise(resolve => { resolveBlobPromise = resolve })

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    sharedStreamRef.current = stream

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
      .find(t => MediaRecorder.isTypeSupported(t)) || ''

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = audioChunksRef.current.length > 0
        ? new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
        : null
      resolveBlobPromise(blob)
      stream.getTracks().forEach(t => t.stop())
      sharedStreamRef.current = null
    }

    // Wait for the recorder to actually transition to "recording" state, then a
    // brief buffer for the audio pipeline to start producing samples. Without this,
    // the first ~100-300ms of speech can be lost depending on the browser.
    const recordingStarted = new Promise(resolve => { recorder.onstart = () => resolve() })
    recorder.start(250)
    mediaRecorderRef.current = recorder
    await recordingStarted
    await new Promise(resolve => setTimeout(resolve, 250))

    return stream
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
    // onstop was blanked so tracks won't be stopped there — do it explicitly
    sharedStreamRef.current?.getTracks().forEach(t => t.stop())
    sharedStreamRef.current = null
    blobPromiseRef.current = null
    audioChunksRef.current = []
  }

  function addToHistory(words, scores, audioUrl, rawSegments) {
    const entry = {
      id: Date.now(),
      timestamp: Date.now(),
      pasukIdx,
      pasukRef: pasuk.reference,
      scores,
      wordResults: words,
      audioUrl,
      rawSegments,
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

  async function handleRecord() {
    cancelTtsRef.current?.()
    setListenPhase('idle')
    setPhase('preparing')
    setWordResults([])
    setScores(null)
    setErrorMsg('')
    setSelectedWordIdx(null)
    setCurrentRawSegments([])

    let stream
    try {
      stream = await startSharedStream()
    } catch {
      setPhase('error')
      setErrorMsg('Microphone access denied. Please allow microphone access and try again.')
      return
    }

    // Fallback: show recording UI after 3s even if onReady hasn't fired
    prepareTimerRef.current = setTimeout(
      () => setPhase(p => p === 'preparing' ? 'recording' : p),
      3000
    )

    if (provider === 'openai' || provider === 'openai-rules') {
      // No live streaming for OpenAI — recorder runs alone, assessment happens after Done.
      clearTimeout(prepareTimerRef.current)
      setPhase('recording')
      return
    }

    const segmentsRef = []  // local accumulator — avoids stale closure on setCurrentRawSegments

    recognizerRef.current = startPronunciationAssessment(
      pasuk.text,
      ({ words, scores }) => {
        clearTimeout(prepareTimerRef.current)
        const reconciled = reconcileWords(pasuk.text, words)
        ;(blobPromiseRef.current ?? Promise.resolve(null)).then(blob => {
          const audioUrl = blob ? URL.createObjectURL(blob) : null
          setCurrentAudioUrl(audioUrl)
          addToHistory(reconciled, scores, audioUrl, segmentsRef)
          if (window.innerWidth > 640) setShowHistory(true)
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
      },
      stream,
      (json) => {
        segmentsRef.push(json)
        setCurrentRawSegments([...segmentsRef])
      }
    )
  }

  async function runOpenAIAssessment(useRulesEngine) {
    const blob = await (blobPromiseRef.current ?? Promise.resolve(null))
    if (!blob) {
      setPhase('error')
      setErrorMsg('No audio was recorded. Please try again.')
      return
    }
    try {
      const assess = useRulesEngine ? assessWithOpenAIRules : assessWithOpenAI
      const { words, scores, rawSegment } = await assess(blob, pasuk.text, { tradition, shevaMode })
      const reconciled = reconcileWords(pasuk.text, words)
      const audioUrl = URL.createObjectURL(blob)
      setCurrentAudioUrl(audioUrl)
      setCurrentRawSegments([rawSegment])
      addToHistory(reconciled, scores, audioUrl, [rawSegment])
      if (window.innerWidth > 640) setShowHistory(true)
      setPhase('done')
      setScores(scores)
      setWordResults(reconciled)
    } catch (err) {
      setPhase('error')
      setErrorMsg(err.message ?? 'OpenAI assessment failed. Please try again.')
    }
  }

  function handleDone() {
    setPhase('processing')
    stopMediaRecorder()
    if (provider === 'openai') {
      runOpenAIAssessment(false)
    } else if (provider === 'openai-rules') {
      runOpenAIAssessment(true)
    } else {
      recognizerRef.current?.stop()
    }
  }

  function handleManualGrade() {
    setListenPhase('idle')
    cancelTtsRef.current?.()
    const { words, scores, rawSegment } = assessManual(pasuk.text, manualInput, { tradition, shevaMode })
    const reconciled = reconcileWords(pasuk.text, words)
    setCurrentRawSegments([rawSegment])
    addToHistory(reconciled, scores, null, [rawSegment])
    setPhase('done')
    setScores(scores)
    setWordResults(reconciled)
    if (window.innerWidth > 640) setShowHistory(true)
  }

  function handleCancel() {
    clearTimeout(prepareTimerRef.current)
    discardMediaRecorder()
    recognizerRef.current?.cancel()
    setPhase('idle')
  }

  function handleReset() {
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    setCurrentPlayPhase('idle')
    setCurrentAudioUrl(null)
    setCurrentRawSegments([])
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

  const studentSelf = dummyStudents.find(s => s.id === studentSelfId) ?? dummyStudents[0]
  const teacherViewingStudent = dummyStudents.find(s => s.id === teacherViewingId)

  return (
    <div className={`app-shell ${showHistory ? 'app-shell--open' : ''}`}>
      <div className="app">
        <header className="app-header">
          <div className="app-header-content">
            <h1>תנ״ך Reading Practice</h1>
            <p>Record yourself reading the verse and receive word-by-word pronunciation feedback</p>
          </div>
          {activeTab === 'practice' && history.filter(e => e.pasukIdx === pasukIdx).length > 0 && (
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

        <nav className="main-nav">
          <div className="main-nav-tabs">
            <button
              className={`main-nav-tab ${activeTab === 'practice' ? 'main-nav-tab--active' : ''}`}
              onClick={() => setActiveTab('practice')}
            >
              Practice
            </button>
            <button
              className={`main-nav-tab ${activeTab === 'progress' ? 'main-nav-tab--active' : ''}`}
              onClick={() => setActiveTab('progress')}
            >
              Progress
            </button>
          </div>
          <div className="dev-role-toggle">
            <span className="dev-role-label">[dev]</span>
            <button
              className={`dev-role-btn ${devRole === 'student' ? 'dev-role-btn--active' : ''}`}
              onClick={() => setDevRole('student')}
            >
              Student
            </button>
            <button
              className={`dev-role-btn ${devRole === 'teacher' ? 'dev-role-btn--active' : ''}`}
              onClick={() => setDevRole('teacher')}
            >
              Teacher
            </button>
          </div>
        </nav>

        {activeTab === 'progress' && (
          <main className="app-main">
            {devRole === 'student' ? (
              <ProgressView student={studentSelf} viewer="student" />
            ) : teacherViewingStudent ? (
              <ProgressView
                student={teacherViewingStudent}
                viewer="teacher"
                onBack={() => setTeacherViewingId(null)}
              />
            ) : (
              <TeacherRoster students={dummyStudents} onSelect={s => setTeacherViewingId(s.id)} />
            )}
          </main>
        )}

        {activeTab === 'practice' && (
        <main className="app-main">
          <div className="pasuk-selector">
            <label htmlFor="pasuk-select">Verse</label>
            <select
              id="pasuk-select"
              value={pasukIdx}
              onChange={(e) => {
                setPasukIdx(Number(e.target.value))
                handleReset()
                handleExitHistoryView()
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

          <div className="provider-selector">
            <span className="provider-label">Engine</span>
            <div className="provider-seg">
              <button
                className={`provider-btn ${provider === 'azure' ? 'provider-btn--active' : ''}`}
                onClick={() => setProvider('azure')}
                disabled={phase === 'recording' || phase === 'preparing' || phase === 'processing'}
                title="Azure Cognitive Services — Modern Israeli phoneme model"
              >
                Azure
              </button>
              <button
                className={`provider-btn ${provider === 'openai' ? 'provider-btn--active' : ''}`}
                onClick={() => setProvider('openai')}
                disabled={phase === 'recording' || phase === 'preparing' || phase === 'processing'}
                title="OpenAI gpt-audio — LLM does transcription AND scoring"
              >
                OpenAI (LLM)
              </button>
              <button
                className={`provider-btn ${provider === 'openai-rules' ? 'provider-btn--active' : ''}`}
                onClick={() => setProvider('openai-rules')}
                disabled={phase === 'recording' || phase === 'preparing' || phase === 'processing'}
                title="OpenAI transcription + deterministic rules engine for scoring"
              >
                OpenAI (Rules)
              </button>
              <button
                className={`provider-btn ${provider === 'manual' ? 'provider-btn--active' : ''}`}
                onClick={() => setProvider('manual')}
                disabled={phase === 'recording' || phase === 'preparing' || phase === 'processing'}
                title="Type phonetic transcription directly — tests the rules engine without OpenAI"
              >
                Manual
              </button>
            </div>
          </div>

          {(provider === 'openai' || provider === 'openai-rules' || provider === 'manual') && (
            <div className="settings-group">
              <div className="provider-selector">
                <span className="provider-label">Tradition</span>
                <div className="provider-seg">
                  <button
                    className={`provider-btn ${tradition === 'sephardic' ? 'provider-btn--active' : ''}`}
                    onClick={() => setTradition('sephardic')}
                    disabled={phase === 'recording' || phase === 'preparing' || phase === 'processing'}
                    title="ת always 't'; standard Modern Israeli vowels"
                  >
                    Sephardic
                  </button>
                  <button
                    className={`provider-btn ${tradition === 'ashkenazic' ? 'provider-btn--active' : ''}`}
                    onClick={() => setTradition('ashkenazic')}
                    disabled={phase === 'recording' || phase === 'preparing' || phase === 'processing'}
                    title="ת with dagesh 't', without 's' (sav); Ashkenazic vowels"
                  >
                    Ashkenazic
                  </button>
                </div>
              </div>

              <div className="provider-selector">
                <span className="provider-label">Sheva</span>
                <div className="provider-seg">
                  <button
                    className={`provider-btn ${shevaMode === 'enforce' ? 'provider-btn--active' : ''}`}
                    onClick={() => setShevaMode('enforce')}
                    disabled={phase === 'recording' || phase === 'preparing' || phase === 'processing'}
                    title="Distinguish sheva na (vocal) from sheva nach (silent)"
                  >
                    Enforce
                  </button>
                  <button
                    className={`provider-btn ${shevaMode === 'ignore' ? 'provider-btn--active' : ''}`}
                    onClick={() => setShevaMode('ignore')}
                    disabled={phase === 'recording' || phase === 'preparing' || phase === 'processing'}
                    title="Ignore sheva na/nach distinction — easier for beginners"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="pasuk-card">
            <div className="hebrew-text" dir="rtl" lang="he">
              {(phase === 'done' || viewingHistoryEntry) && modeWords.length > 0
                ? modeWords.map((w, i) => (
                    <span key={i}>
                      <WordChip
                        {...w}
                        isSelected={selectedWordIdx === i}
                        onClick={() => handleWordClick(i)}
                        showScore
                      />
                      {i < modeWords.length - 1 ? ' ' : null}
                    </span>
                  ))
                : <span>{pasuk.text}</span>
              }
            </div>
            {(phase === 'done' || viewingHistoryEntry) && modeWords.length > 0 && (() => {
              const issues = modeWords
                .map((w, idx) => ({ word: w, idx }))
                .filter(({ word }) => word.errorType !== 'None' || word.phonemes?.some(p => p.note))
              if (issues.length === 0) {
                return <p className="click-hint">All words scored cleanly. Click any word to see the breakdown.</p>
              }
              return (
                <div className="word-issues">
                  <div className="word-issues-header">Issues to work on</div>
                  <ul className="word-issues-list">
                    {issues.map(({ word, idx }) => {
                      const notes = (word.phonemes ?? []).filter(p => p.note)
                      return (
                        <li key={idx} className="word-issues-item">
                          <div className="word-issues-head">
                            <button
                              className="word-issues-word"
                              dir="rtl"
                              lang="he"
                              onClick={() => handleWordClick(idx)}
                            >
                              {word.word}
                            </button>
                            {word.phoneticHeard && word.errorType !== 'Omission' && (
                              <span className="word-issues-heard">heard: <code>{word.phoneticHeard}</code></span>
                            )}
                          </div>
                          {word.errorType === 'Omission'
                            ? <span className="word-issues-omission">— skipped</span>
                            : word.errorType === 'Insertion'
                              ? <span className="word-issues-omission">— extra word</span>
                              : notes.length > 0
                                ? <ul className="word-issues-notes">
                                    {notes.map((n, j) => (
                                      <li key={j}>
                                        <span className="word-issues-syllable" dir="rtl" lang="he">{n.phoneme}</span>
                                        <span className="word-issues-note">{n.note}</span>
                                      </li>
                                    ))}
                                  </ul>
                                : <span className="word-issues-omission">— marked incorrect</span>
                          }
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })()}
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

          {selectedWordIdx !== null && modeWords[selectedWordIdx] && (
            <PhonemePanel
              wordData={modeWords[selectedWordIdx]}
              provider={displayRawSegments[0]?.provider ?? 'azure'}
              onClose={() => setSelectedWordIdx(null)}
            />
          )}

          <div className="controls">
            {viewingHistoryEntry ? (
              <div className="history-review-state">
                <p className="history-review-label">Viewing Attempt #{viewingAttemptNumber}</p>
                <div className="history-review-actions">
                  {viewingHistoryEntry.audioUrl && (
                    <button
                      className={`btn-listen ${historyPlayPhase !== 'idle' ? 'btn-listen--active' : ''}`}
                      onClick={handleHistoryAudioPlay}
                    >
                      <span className="listen-icon">{historyPlayPhase !== 'idle' ? '■' : '▶'}</span>
                      {historyPlayPhase !== 'idle' ? 'Stop' : 'Play Recording'}
                    </button>
                  )}
                  <button className="btn btn-reset" onClick={handleExitHistoryView}>← Back</button>
                  <button className="btn btn-record" onClick={() => { handleExitHistoryView(); handleReset(); }}>↺ Try Again</button>
                </div>
              </div>
            ) : (
              <>
                {phase === 'idle' && provider === 'manual' && (
                  <div className="manual-input-group">
                    <label className="manual-input-label">
                      Type the phonetic transcription (one word per space, matching the reference word count):
                    </label>
                    <textarea
                      className="manual-input"
                      value={manualInput}
                      onChange={e => setManualInput(e.target.value)}
                      placeholder={`e.g. vayomer hashem el-avram lech-lecha…`}
                      rows={2}
                    />
                    <button
                      className="btn btn-record"
                      onClick={handleManualGrade}
                      disabled={!manualInput.trim()}
                    >
                      Grade
                    </button>
                  </div>
                )}

                {phase === 'idle' && provider !== 'manual' && (
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
                  <div className="done-actions">
                    {currentAudioUrl && (
                      <button
                        className={`btn-listen ${currentPlayPhase !== 'idle' ? 'btn-listen--active' : ''}`}
                        onClick={handleCurrentAudioPlay}
                      >
                        <span className="listen-icon">{currentPlayPhase !== 'idle' ? '■' : '▶'}</span>
                        {currentPlayPhase !== 'idle' ? 'Stop' : 'Play Recording'}
                      </button>
                    )}
                    <button className="btn btn-reset" onClick={handleReset}>↺ Try Again</button>
                  </div>
                )}

                {phase === 'error' && (
                  <div className="error-state">
                    <p className="error-msg">{errorMsg}</p>
                    <button className="btn btn-reset" onClick={handleReset}>↺ Try Again</button>
                  </div>
                )}
              </>
            )}
          </div>

          {displayScores && (
            <div className="score-panel">
              <div className="scoring-mode-selector">
                <span className="scoring-mode-label">Scoring</span>
                <div className="scoring-mode-seg">
                  {SCORING_MODES.map(m => (
                    <button
                      key={m.value}
                      className={`scoring-mode-btn ${scoringMode === m.value ? 'scoring-mode-btn--active' : ''}`}
                      onClick={() => setScoringMode(m.value)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="score-rings">
                {(() => {
                  const s = applyScoringMode(displayScores, scoringMode)
                  return (
                    <>
                      <ScoreRing value={s.pronunciation} label="Overall" />
                      <ScoreRing value={s.accuracy} label="Accuracy" />
                      {scoringMode === 'default' && <ScoreRing value={s.fluency} label="Fluency" />}
                      <ScoreRing value={s.completeness} label="Complete" />
                    </>
                  )
                })()}
              </div>
              <p className="score-note">
                {SCORING_MODES.find(m => m.value === scoringMode).note}
              </p>

              {displayRawSegments[0]?.feedback && (
                <div className="feedback-banner">
                  <span className="feedback-label">Feedback</span>
                  <p className="feedback-text">{displayRawSegments[0].feedback}</p>
                </div>
              )}

              {displayRawSegments[0]?.transcription && (
                <div className="transcription-row">
                  <span className="transcription-label">Heard</span>
                  <span className="transcription-text">{displayRawSegments[0].transcription}</span>
                </div>
              )}
            </div>
          )}

          {displayRawSegments.length > 0 && (
            <div className="debug-panel">
              <button
                className="debug-toggle"
                onClick={() => setShowDebug(s => !s)}
              >
                <span className="debug-toggle-icon">{showDebug ? '▾' : '▸'}</span>
                Raw Engine Data
                <span className="debug-count">{displayRawSegments.length} segment{displayRawSegments.length !== 1 ? 's' : ''}</span>
              </button>
              {showDebug && (
                <div className="debug-body">
                  {displayRawSegments.map((seg, i) => (
                    <div key={i} className="debug-segment">
                      <div className="debug-segment-label">Segment {i + 1}</div>
                      <pre className="debug-pre">{JSON.stringify(seg, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
        )}
      </div>

      {activeTab === 'practice' && showHistory && (
        <>
          <button
            className="sidebar-backdrop"
            aria-label="Close sidebar"
            onClick={() => { handleExitHistoryView(); setShowHistory(false) }}
          />
          <HistorySidebar
            history={verseHistory}
            selectedId={viewingHistoryEntry?.id ?? null}
            onSelect={handleSelectHistoryEntry}
            onClose={() => { handleExitHistoryView(); setShowHistory(false) }}
          />
        </>
      )}
    </div>
  )
}
