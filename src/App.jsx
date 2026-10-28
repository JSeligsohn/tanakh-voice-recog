import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { psukim } from './data/psukim'
import { startPronunciationAssessment } from './services/speechAssessment'
import { assessWithOpenAI } from './services/openaiAssessment'
import { assessWithOpenAIRules } from './services/openaiRulesAssessment'
import { assessManual } from './services/manualAssessment'
import { assessWithPhonemes } from './services/phonemeAssessment'
import { speakHebrew } from './services/tts'
import { listenUrl, elevenLabsUrl, playRecording } from './services/listen'
import { isSpeechAvailable } from './services/azureAuth'
import { splitHebrewToGroups, mapPhonemesToGroups, reconcileWords } from './utils/hebrew'
import { splitVerseWords } from './utils/hebrewRules'
import { syllableMark, wordLabel } from './utils/wordScore'
import { currentTester } from './utils/tester'
import HistorySidebar from './components/HistorySidebar'
import TranscriptionCheck from './components/TranscriptionCheck'
import VoiceLab from './components/VoiceLab'
import { waitForAudio, MIC_CONSTRAINTS, RECORDER_OPTIONS } from './utils/micReady'
import { checkRecording } from './utils/recordingCheck'
import { entrySettings, settingsDiff } from './utils/historySettings'
import LetterBreakdown from './components/LetterBreakdown'
import SoundGuide from './components/SoundGuide'
import SyllableProblems from './components/SyllableProblems'
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

// A syllable's mark in the word popover: right, partly heard, wrong
const MARK_COLORS = { right: '#16a34a', partly: '#d97706', wrong: '#dc2626' }
const MARK_SIGNS = { right: '✓', partly: '~', wrong: '✗' }

function scoreLabel(score, errorType) {
  if (errorType === 'Omission') return 'Skipped'
  if (errorType === 'Insertion') return 'Extra word'
  if (errorType === 'OutOfOrder') return 'Out of order'
  if (errorType === 'Mispronunciation') return 'Mispronounced'
  if (score >= 80) return 'Good'
  if (score >= 60) return 'Needs work'
  return 'Incorrect'
}

// A verse with each maqef part as its own word, as the rules engine grades it
const gradedWordsText = text => splitVerseWords(text).join(' ')

function WordChip({ word, score, errorType, isSelected, onClick, showScore, chipRef }) {
  const color = scoreColor(score, errorType)
  const isOmitted = errorType === 'Omission'

  return (
    <span
      ref={chipRef}
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

// Where the word popover goes: centered over its word (kept inside the verse
// card), above the word when it fits on screen, otherwise below it
function placePopover(anchor, container, pop) {
  const GAP = 10, EDGE = 8, ARROW_INSET = 16
  const c = container.getBoundingClientRect()
  const a = anchor.getBoundingClientRect()
  const w = pop.offsetWidth
  const h = pop.offsetHeight
  const originX = c.left + container.clientLeft
  const originY = c.top + container.clientTop
  const centerX = a.left + a.width / 2 - originX
  const left = Math.max(EDGE, Math.min(centerX - w / 2, container.clientWidth - w - EDGE))
  const fitsAbove = a.top - GAP - h >= EDGE
  const fitsBelow = a.bottom + GAP + h <= window.innerHeight - EDGE
  const placement = fitsAbove || (!fitsBelow && a.top > window.innerHeight - a.bottom) ? 'above' : 'below'
  return {
    placement,
    left,
    top: placement === 'above' ? a.top - originY - GAP - h : a.bottom - originY + GAP,
    arrowX: Math.max(ARROW_INSET, Math.min(centerX - left, w - ARROW_INSET)),
  }
}

// A clicked word's score and breakdown, in a popover on the word
function WordPopover({ chipRefs, index, containerRef, onClose, ...panelProps }) {
  const popRef = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    const pop = popRef.current
    const anchor = chipRefs.current[index]
    const container = containerRef.current
    if (!anchor || !container || !pop) return
    // A word picked from the issues list may be scrolled away: bring it into view
    const a = anchor.getBoundingClientRect()
    if (a.top < 0 || a.bottom > window.innerHeight) anchor.scrollIntoView({ block: 'center' })
    const place = () => setPos(placePopover(anchor, container, pop))
    place()
    // Re-place when the verse re-wraps or the popover's content changes size
    const observer = new ResizeObserver(place)
    observer.observe(container)
    observer.observe(pop)
    window.addEventListener('resize', place)
    return () => { observer.disconnect(); window.removeEventListener('resize', place) }
  }, [chipRefs, index, containerRef])

  // Close on Escape or a press outside the popover (pressing a word is
  // handled by the word itself: it switches words or closes this one)
  useEffect(() => {
    function onPointerDown(e) {
      if (popRef.current?.contains(e.target) || e.target.closest?.('.word-chip')) return
      onClose()
    }
    function onKeyDown(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div
      ref={popRef}
      className={`word-popover ${pos ? `word-popover--${pos.placement}` : ''}`}
      style={pos ? { left: pos.left, top: pos.top, '--arrow-x': `${pos.arrowX}px` } : { visibility: 'hidden' }}
      role="dialog"
      aria-label="Word score"
    >
      <PhonemePanel {...panelProps} onClose={onClose} />
    </div>
  )
}

function PhonemePanel({ wordData, provider, onClose, speechAvailable }) {
  const { word, score, errorType, phonemes, phoneticHeard } = wordData
  const color = scoreColor(score, errorType)
  const groups = splitHebrewToGroups(word)
  // The rules engine grades each syllable right, partly heard or wrong (a skipped word's
  // syllables are left unmarked). OpenAI (LLM) scores natural Hebrew syllables,
  // shown directly; Azure's per-phoneme scores are mapped onto letter groups.
  const breakdownItems = phonemes?.some(p => p.breakdown)
    ? phonemes.map(p => ({ chars: p.phoneme, score: null, mark: errorType === 'Omission' ? null : syllableMark(p) }))
    : provider === 'openai' && phonemes?.length > 0
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
          {Math.round(score)}/100 — {phonemes?.some(p => p.breakdown) ? wordLabel(wordData) : scoreLabel(score, errorType)}
        </span>
        {speechAvailable && (
          <button
            className={`btn-listen btn-word-listen ${isPlaying ? 'btn-listen--active' : ''}`}
            onClick={handleListen}
            title={isPlaying ? 'Stop' : 'Hear Azure pronounce this word'}
          >
            <span className="listen-icon">{isPlaying ? '■' : '▶'}</span>
            {isPlaying ? 'Stop' : 'Listen'}
          </button>
        )}
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
              const cColor = item.mark
                ? MARK_COLORS[item.mark]
                : item.score != null ? scoreColor(item.score, 'None') : '#d6d3d1'
              return (
                <div key={i} className="char-item">
                  <span className="char-glyph" style={{ color: cColor }} lang="he">
                    {item.chars}
                  </span>
                  {item.mark ? (
                    <span className="char-mark" style={{ color: cColor }} aria-label={item.mark === 'partly' ? 'partly heard' : item.mark}>
                      {MARK_SIGNS[item.mark]}
                    </span>
                  ) : item.score != null && (
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
              Word not detected in your recording{speechAvailable ? ' — press Listen to hear how it should sound' : ''}.
            </p>
          ) : !isPerfect && provider === 'azure' ? (
            <p className="phoneme-note">
              Scores are approximate — {phonemes?.length ?? 0} phonemes for {groups.length} letter groups.
            </p>
          ) : null}

          {phonemes && <SyllableProblems phonemes={phonemes} className="syllable-problems--popover" />}
        </>
      ) : (
        <p className="phoneme-empty">No breakdown available for this word.</p>
      )}
    </div>
  )
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// A number that eases from where it was to `target`: from 0 when first shown,
// so a new grade's rings fill up (after `delay` ms, while the results open)
function useCountUp(target, { delay = 0, duration = 900 } = {}) {
  const [shown, setShown] = useState(0)
  const shownRef = useRef(0)
  useEffect(() => {
    const from = shownRef.current
    const ms = prefersReducedMotion() ? 0 : duration
    let raf
    let start = null
    function step(now) {
      start ??= now
      const t = ms ? Math.min(1, (now - start) / ms) : 1
      shownRef.current = from + (target - from) * (1 - (1 - t) ** 3)
      setShown(shownRef.current)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    const timer = setTimeout(() => { raf = requestAnimationFrame(step) }, ms ? delay : 0)
    return () => { clearTimeout(timer); cancelAnimationFrame(raf) }
  }, [target, delay, duration])
  return shown
}

// A tester's attempt is saved on the server (utils/tester.js): a link to it
// on the Review page, to send to the team — through the phone's share sheet,
// or copied. If neither works, the link is shown to copy by hand.
function ShareReviewButton({ attemptId }) {
  const [status, setStatus] = useState('idle') // idle | copied | manual
  const url = `${window.location.origin}/?review=${attemptId}`

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Reading for review', url })
        return
      } catch (err) {
        if (err.name === 'AbortError') return // closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setStatus('copied')
    } catch {
      setStatus('manual')
    }
  }

  return (
    <div className="share-review">
      <button className="btn-listen" onClick={handleShare}>🔗 Share for review</button>
      {status === 'copied' && <span className="share-review-note">Link copied — paste it to the team</span>}
      {status === 'manual' && <input className="share-review-link" readOnly value={url} onFocus={e => e.target.select()} />}
    </div>
  )
}

function ScoreRing({ value, label, format = v => Math.round(v), delay = 300 }) {
  const shown = useCountUp(value, { delay })
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (shown / 100) * circumference
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
          {format(shown)}
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
  // The word-by-word Listen (Azure text-to-speech) is shown only when Azure is set up on the server
  const [speechAvailable, setSpeechAvailable] = useState(false)
  useEffect(() => { isSpeechAvailable().then(setSpeechAvailable) }, [])
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
  // Start-of-recording check for the current attempt (see utils/recordingCheck)
  const [recordingCheck, setRecordingCheck] = useState(null)
  // Results display: word-by-word verse vs. alphabetical letter breakdown
  const [resultsView, setResultsView] = useState('score')
  // A tester's recordings are saved for review (utils/tester.js)
  const [tester] = useState(currentTester)
  const [provider, setProvider] = useState(() => {
    // In production the engine choice is dev-only: testers are graded by the
    // phoneme scorer, everyone else by OpenAI (Rules)
    if (!import.meta.env.DEV) return tester ? 'phonemes' : 'openai-rules'
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
  const pasukCardRef = useRef(null)
  const chipRefs = useRef([]) // the verse's word chips, for placing the word popover
  const mediaRecorderRef = useRef(null)
  const sharedStreamRef = useRef(null)
  const audioChunksRef = useRef([])
  const blobPromiseRef = useRef(null) // resolves with Blob (or null) when recorder stops
  const micRef = useRef(null)         // mic name and start-up timings for the current recording
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
  const displayRecordingCheck = viewingHistoryEntry ? viewingHistoryEntry.recordingCheck : recordingCheck

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

    const t0 = performance.now()
    const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
    const tStream = performance.now()
    sharedStreamRef.current = stream

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
      .find(t => MediaRecorder.isTypeSupported(t)) || ''

    const recorder = new MediaRecorder(stream, { ...RECORDER_OPTIONS, ...(mimeType ? { mimeType } : {}) })
    recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = audioChunksRef.current.length > 0
        ? new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })
        : null
      resolveBlobPromise(blob)
      stream.getTracks().forEach(t => t.stop())
      sharedStreamRef.current = null
    }

    // Wait for the recorder to actually transition to "recording" state, then
    // for the mic to deliver real audio (see waitForAudio — Bluetooth mics can
    // send silence for up to ~2s), plus a short buffer. Without this, the first
    // word can be lost.
    const recordingStarted = new Promise(resolve => { recorder.onstart = () => resolve() })
    recorder.start(250)
    mediaRecorderRef.current = recorder
    await recordingStarted
    const tStarted = performance.now()
    const audio = await waitForAudio(stream)
    await new Promise(resolve => setTimeout(resolve, 150))

    const track = stream.getAudioTracks()[0]
    micRef.current = {
      mic: track?.label || 'microphone',
      micOpenMs: Math.round(tStream - t0),
      audioConfirmed: audio.ready,
      readyAtMs: Math.round(performance.now() - tStarted), // cue shown, ms into the recording
    }
    console.log(
      `[mic] ${track?.label || 'microphone'} │ stream ${Math.round(tStream - t0)}ms │ ` +
      `recorder ${Math.round(tStarted - t0)}ms │ audio ${audio.ready ? `flowing after +${audio.ms}ms` : `not confirmed (${audio.reason})`} │ ` +
      `ready at ${Math.round(performance.now() - t0)}ms`
    )

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

  // Analyze how the recording starts; never fails the attempt if it can't.
  async function runRecordingCheck(blob) {
    if (!blob) return null
    try {
      const check = await checkRecording(blob, micRef.current ?? {})
      console.log('[recording check]', check)
      return check
    } catch (err) {
      console.warn('[recording check] failed:', err)
      return null
    }
  }

  function addToHistory(words, scores, audioUrl, rawSegments, check = null) {
    const entry = {
      id: Date.now(),
      timestamp: Date.now(),
      pasukIdx,
      pasukRef: pasuk.reference,
      scores,
      wordResults: words,
      audioUrl,
      rawSegments,
      settings: { tradition, shevaMode },
      recordingCheck: check,
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
    setRecordingCheck(null)

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

    if (provider === 'openai' || provider === 'openai-rules' || provider === 'phonemes') {
      // No live streaming for OpenAI or the phoneme scorer — recorder runs alone, assessment happens after Done.
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
        ;(blobPromiseRef.current ?? Promise.resolve(null)).then(async blob => {
          const audioUrl = blob ? URL.createObjectURL(blob) : null
          setCurrentAudioUrl(audioUrl)
          const check = await runRecordingCheck(blob)
          setRecordingCheck(check)
          addToHistory(reconciled, scores, audioUrl, segmentsRef, check)
          if (window.innerWidth > 640) setShowHistory(true)
        })
        setPhase('done')
        setResultsView('score')
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

  // OpenAI (LLM), OpenAI (Rules) or the phoneme scorer: the recording is
  // graded after Done. The rules engine and the phoneme scorer grade each
  // maqef part as its own word.
  async function runOpenAIAssessment(useRulesEngine, assess = useRulesEngine ? assessWithOpenAIRules : assessWithOpenAI) {
    const blob = await (blobPromiseRef.current ?? Promise.resolve(null))
    if (!blob) {
      setPhase('error')
      setErrorMsg('No audio was recorded. Please try again.')
      return
    }
    try {
      const checkPromise = runRecordingCheck(blob) // runs alongside the API call
      const { words, scores, rawSegment } = await assess(blob, pasuk.text, { tradition, shevaMode })
      // The rules engine grades each maqef part as its own word
      const reconciled = reconcileWords(useRulesEngine ? gradedWordsText(pasuk.text) : pasuk.text, words)
      const audioUrl = URL.createObjectURL(blob)
      const check = await checkPromise
      setRecordingCheck(check)
      setCurrentAudioUrl(audioUrl)
      setCurrentRawSegments([rawSegment])
      addToHistory(reconciled, scores, audioUrl, [rawSegment], check)
      if (window.innerWidth > 640) setShowHistory(true)
      setPhase('done')
      setResultsView('score')
      setScores(scores)
      setWordResults(reconciled)
    } catch (err) {
      setPhase('error')
      setErrorMsg(err.message ?? 'Grading failed. Please try again.')
    }
  }

  function handleDone() {
    setPhase('processing')
    stopMediaRecorder()
    if (provider === 'openai') {
      runOpenAIAssessment(false)
    } else if (provider === 'openai-rules') {
      runOpenAIAssessment(true)
    } else if (provider === 'phonemes') {
      runOpenAIAssessment(true, assessWithPhonemes)
    } else {
      recognizerRef.current?.stop()
    }
  }

  function handleManualGrade() {
    setListenPhase('idle')
    cancelTtsRef.current?.()
    const { words, scores, rawSegment } = assessManual(pasuk.text, manualInput, { tradition, shevaMode })
    const reconciled = reconcileWords(gradedWordsText(pasuk.text), words)
    setCurrentRawSegments([rawSegment])
    addToHistory(reconciled, scores, null, [rawSegment])
    setPhase('done')
    setResultsView('score')
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
    setRecordingCheck(null)
    setPhase('idle')
    setWordResults([])
    setScores(null)
    setErrorMsg('')
    setSelectedWordIdx(null)
  }

  function handleWordClick(idx) {
    setSelectedWordIdx(prev => prev === idx ? null : idx)
  }

  // Listen: the recorded reading of this verse in the chosen tradition
  // (testers hear ElevenLabs, falling back to the recording if it fails)
  const verseRecording = listenUrl(pasuk.id, tradition)
  const verseReading = tester ? elevenLabsUrl(pasuk.id, tradition) : null

  function handleListen() {
    if (listenPhase !== 'idle') {
      cancelTtsRef.current?.()
      setListenPhase('idle')
      return
    }
    const play = (url, fallback) => {
      setListenPhase('loading')
      cancelTtsRef.current = playRecording(url, {
        onStart: () => setListenPhase('playing'),
        onEnd:   () => setListenPhase('idle'),
        onError: () => fallback ? play(fallback) : setListenPhase('idle'),
      })
    }
    play(verseReading ?? verseRecording, verseReading && verseRecording)
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
            {import.meta.env.DEV && (
              <button
                className={`main-nav-tab ${activeTab === 'transcription' ? 'main-nav-tab--active' : ''}`}
                onClick={() => setActiveTab('transcription')}
              >
                Transcription check
              </button>
            )}
            {import.meta.env.DEV && (
              <button
                className={`main-nav-tab ${activeTab === 'voices' ? 'main-nav-tab--active' : ''}`}
                onClick={() => setActiveTab('voices')}
              >
                Voice lab
              </button>
            )}
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

        {import.meta.env.DEV && activeTab === 'transcription' && (
          <main className="app-main">
            <TranscriptionCheck />
          </main>
        )}

        {import.meta.env.DEV && activeTab === 'voices' && (
          <main className="app-main">
            <VoiceLab />
          </main>
        )}

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
        <main className="app-main app-main--practice">
          {tester && (
            <p className="tester-note">
              Testing as <strong>{tester}</strong> — your recordings are saved so the team can listen to them.
            </p>
          )}
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

          {import.meta.env.DEV && (
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
                <button
                  className={`provider-btn ${provider === 'phonemes' ? 'provider-btn--active' : ''}`}
                  onClick={() => setProvider('phonemes')}
                  disabled={phase === 'recording' || phase === 'preparing' || phase === 'processing'}
                  title="Our phoneme scorer (ZIPA, api/phonemes.js) — checks each sound against the recording, no OpenAI"
                >
                  Phonemes
                </button>
              </div>
            </div>
          )}

          {(provider === 'openai' || provider === 'openai-rules' || provider === 'manual' || provider === 'phonemes') && (
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

          <div className="practice-layout">
          <div className="practice-main">
          <div className="pasuk-card" ref={pasukCardRef}>
            {(phase === 'done' || viewingHistoryEntry) && displayRecordingCheck?.cutOff && (
              <p className="recording-warning">
                The start of this recording may have been cut off — you were already speaking when the
                microphone began picking up sound, so the first word may be missing or marked wrong.
                Try again, and start reading once the red recording dot appears.
              </p>
            )}
            <div className="hebrew-text" dir="rtl" lang="he">
              {(phase === 'done' || viewingHistoryEntry) && displayWords.length > 0
                ? displayWords.map((w, i) => (
                    <span key={i}>
                      <WordChip
                        {...w}
                        isSelected={selectedWordIdx === i}
                        onClick={() => handleWordClick(i)}
                        chipRef={el => { chipRefs.current[i] = el }}
                        showScore
                      />
                      {/* A maqef part stays joined to the next word, as in the verse */}
                      {i < displayWords.length - 1 && !w.word.endsWith('־') ? ' ' : null}
                    </span>
                  ))
                // Word joiner after each maqef so a joined phrase never wraps mid-way
                : <span>{pasuk.text.replaceAll('־', '־\u2060')}</span>
              }
            </div>
            <div className="pasuk-meta">
              <div className="pasuk-meta-top">
                <span className="pasuk-ref">{pasuk.reference}</span>
                {(verseReading || verseRecording) && (
                  <button
                    className={`btn-listen ${listenPhase !== 'idle' ? 'btn-listen--active' : ''}`}
                    onClick={handleListen}
                    disabled={phase === 'recording' || phase === 'processing'}
                    title={listenPhase === 'idle' ? `Hear this verse read (${tradition === 'ashkenazic' ? 'Ashkenazic' : 'Sephardic'})` : 'Stop'}
                  >
                    {listenPhase !== 'idle' && <span className="listen-icon">■</span>}
                    {listenPhase === 'idle' && <span className="listen-icon">▶</span>}
                    {listenPhase === 'loading' ? 'Loading…' : listenPhase === 'playing' ? 'Stop' : 'Listen'}
                  </button>
                )}
              </div>
            </div>
            {(phase === 'done' || viewingHistoryEntry) && displayWords.length > 0 && (
              // The grade of the verse above, opening below it
              <section className="results-section">
                <div className="results-section-body">
                  <div className="results-view-toggle">
                    <button
                      className={`results-view-btn ${resultsView === 'score' ? 'results-view-btn--active' : ''}`}
                      onClick={() => setResultsView('score')}
                    >
                      Score
                    </button>
                    <button
                      className={`results-view-btn ${resultsView === 'words' ? 'results-view-btn--active' : ''}`}
                      onClick={() => setResultsView('words')}
                    >
                      Words
                    </button>
                    <button
                      className={`results-view-btn ${resultsView === 'letters' ? 'results-view-btn--active' : ''}`}
                      onClick={() => setResultsView('letters')}
                    >
                      By letter
                    </button>
                  </div>
                  {/* Kept mounted so its rings animate once per grade, not on every tab switch */}
                  {displayScores && (
                    <div className="score-view" hidden={resultsView !== 'score'}>
                      {displayScores.wordsTotal != null ? (
                        // Rules-engine modes: the word-based score and how many words were read correctly
                        <>
                          <div className="score-rings">
                            <ScoreRing value={displayScores.pronunciation} label="Score" />
                            <ScoreRing
                              delay={450}
                              value={(100 * displayScores.wordsCorrect) / displayScores.wordsTotal}
                              format={v => `${Math.round((v * displayScores.wordsTotal) / 100)}/${displayScores.wordsTotal}`}
                              label="Words correct"
                            />
                          </div>
                          <p className="score-note">
                            {displayScores.soundsRight} of {displayScores.soundsTotal} sounds right in the words read.
                            Every word counts equally: a word is 100 when all its sounds are right,
                            at most 80 with any mistake, and 0 if skipped.
                          </p>
                        </>
                      ) : (() => {
                        // Azure, OpenAI (LLM), and attempts saved before the word-based score.
                        // Fluency is only measured by Azure, so its circle is shown for Azure only.
                        const isAzure = (displayRawSegments[0]?.provider ?? 'azure') === 'azure'
                        return (
                          <>
                            <div className="score-rings">
                              <ScoreRing value={displayScores.pronunciation} label="Overall" />
                              <ScoreRing value={displayScores.accuracy} label="Accuracy" />
                              {isAzure && <ScoreRing value={displayScores.fluency} label="Fluency" />}
                              <ScoreRing value={displayScores.completeness} label="Complete" />
                            </div>
                            <p className="score-note">
                              {isAzure
                                ? 'Scored by Azure: Overall combines accuracy, fluency and completeness.'
                                : 'Overall = Accuracy (75%) + Completeness (25%).'}
                            </p>
                          </>
                        )
                      })()}

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
                  {resultsView === 'letters' && (
                    <LetterBreakdown wordResults={displayWords} />
                  )}
                  {resultsView === 'words' && (() => {
                    const issues = displayWords
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
                                      ? <SyllableProblems phonemes={word.phonemes} />
                                      : <span className="word-issues-omission">— marked incorrect</span>
                                }
                              </li>
                            )
                          })}
                        </ul>
                        {/* Rules-engine notes spell sounds with the sound key */}
                        {displayWords.some(w => w.phonemes?.some(p => p.breakdown)) && <SoundGuide />}
                      </div>
                    )
                  })()}
                </div>
              </section>
            )}
            {selectedWordIdx !== null && displayWords[selectedWordIdx] && (
              <WordPopover
                key={selectedWordIdx}
                chipRefs={chipRefs}
                index={selectedWordIdx}
                containerRef={pasukCardRef}
                wordData={displayWords[selectedWordIdx]}
                provider={displayRawSegments[0]?.provider ?? 'azure'}
                onClose={() => setSelectedWordIdx(null)}
                speechAvailable={speechAvailable}
              />
            )}
          </div>
          </div>

          {/* Beside the verse (under it, pinned to the screen's bottom, on narrow screens) */}
          <aside className="controls">
            {viewingHistoryEntry ? (
              <div className="history-review-state">
                <p className="history-review-label">Viewing Attempt #{viewingAttemptNumber}</p>
                {(() => {
                  const diff = settingsDiff(entrySettings(viewingHistoryEntry), { tradition, shevaMode })
                  return diff.length > 0 && (
                    <p className="history-settings-warning">
                      Graded with different settings ({diff.join(', ')}) — scores reflect those rules, not your current ones.
                    </p>
                  )
                })()}
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
                {displayRawSegments[0]?.attemptId && <ShareReviewButton attemptId={displayRawSegments[0].attemptId} />}
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
                      rows={4}
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
                    {displayRawSegments[0]?.attemptId && <ShareReviewButton attemptId={displayRawSegments[0].attemptId} />}
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
          </aside>
          </div>

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
                  {displayRecordingCheck && (
                    <div className="debug-segment">
                      <div className="debug-segment-label">Recording check</div>
                      <pre className="debug-pre">{JSON.stringify(displayRecordingCheck, null, 2)}</pre>
                    </div>
                  )}
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
            currentSettings={{ tradition, shevaMode }}
          />
        </>
      )}
    </div>
  )
}
