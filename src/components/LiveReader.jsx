import { useState, useRef, useEffect } from 'react'
import { startLiveReading } from '../services/liveReader'
import { splitVerseWords } from '../utils/hebrewRules'
import { gradeWordFromFindings } from '../utils/hebrewScoring'
import { SpeechLevel } from '../utils/speechLevel'
import { playDing, playSuccess, prepareDing } from '../utils/ding'

// When it stops on its own, in seconds. Quiet (nothing louder than the room):
// once the last word is graded with a red word left, time for another try;
// any other time, a reader who has gone quiet. And with no word read (a
// noisy room the loudness check takes for speech): since starting, and since
// the last word graded.
const END_WAIT = 5
const QUIET_STOP = 8
const START_WAIT = 15
const STUCK_STOP = 20
// a countdown popup shows for the last few seconds of the wait (after the
// last word: 2 s of quiet first, so it isn't there the moment they finish)
const COUNTDOWN = 3
// with the popup up, it takes steady speech (in ~100 ms pieces) to close it,
// not a breath or an "um"
const POPUP_SPEECH = 5

// The live reader: the microphone stays open while the student reads, and
// each word lights up as soon as they're done with it: green when it's right,
// red when it isn't (it stays red until it's read right). Tapping a word
// shows what was heard; tapping a red one while listening goes back to it.
// It stops on its own when every word is right, or when the reader goes
// quiet (END_WAIT, QUIET_STOP). When the reading ends, the whole recording is
// scored as usual: onFinished gets that full report and the recording (for
// the Attempts list), and onReport opens it. A verse read all right offers
// the next step, the whole verse for a score (onWholeVerse).
export default function LiveReader({ pasuk, settings, onFinished, onReport, onWholeVerse }) {
  const words = splitVerseWords(pasuk.text)
  const [phase, setPhase] = useState('idle') // idle | connecting | listening | finishing | done | error
  const [states, setStates] = useState(() => words.map(blankState))
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(null)
  const [follow, setFollow] = useState(true)
  const [report, setReport] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const sessionRef = useRef(null)
  // each reading's number: messages from one cancelled before are ignored
  const readingRef = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  // how loud the reader is against the room, and when they last spoke
  const levelRef = useRef(null)
  const spokeAtRef = useRef(0)
  const spokenRef = useRef(false)
  const speechRunRef = useRef(0)
  const countingRef = useRef(false)
  const [quietFor, setQuietFor] = useState(0)
  // when the reading last moved on: started, a word graded, a tap
  const movedAtRef = useRef(0)
  const [stuckFor, setStuckFor] = useState(0)
  // every word right: a moment of celebration ({ perfect, retried }), then it hides
  const [celebrate, setCelebrate] = useState(null)

  // a new verse, or leaving: drop the reading
  useEffect(() => {
    reset()
    return () => sessionRef.current?.cancel()
  }, [pasuk.text]) // eslint-disable-line react-hooks/exhaustive-deps

  // the microphone doesn't stay open in a hidden tab
  useEffect(() => {
    const onHide = () => { if (document.hidden && phaseRef.current === 'listening') handleDone() }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  // how long it's been quiet, while listening
  useEffect(() => {
    if (phase !== 'listening') return
    const timer = setInterval(() => {
      const now = performance.now()
      setQuietFor((now - spokeAtRef.current) / 1000)
      setStuckFor((now - movedAtRef.current) / 1000)
    }, 250)
    return () => clearInterval(timer)
  }, [phase])

  // Stopping on its own: every word read right, or quiet (or stuck) for long
  // enough. `left`: seconds until it stops.
  const allRight = states.every(s => s.status === 'correct')
  const ended = states.at(-1).status !== 'waiting'
  const anyRead = states.some(s => s.status !== 'waiting')
  const left = Math.min(
    (ended ? END_WAIT : spokenRef.current ? QUIET_STOP : START_WAIT) - quietFor,
    (anyRead ? STUCK_STOP : START_WAIT) - stuckFor,
  )
  // (separate effects: the quiet clock ticks every 250 ms, and would restart
  // the 600 ms wait each time if they were one)
  // (the microphone closes first: it would record the chime, and the full
  // report could take it for a vowel added after the last word)
  const retried = states.filter(s => s.wrongTries > 0).length
  useEffect(() => {
    if (phase !== 'listening' || !(ended && allRight)) return
    const timer = setTimeout(() => {
      if (phaseRef.current !== 'listening') return
      handleDone()
      playSuccess()
      setCelebrate({ perfect: retried === 0, retried })
    }, 600)
    return () => clearTimeout(timer)
  }, [phase, ended, allRight, retried])
  useEffect(() => {
    if (!celebrate) return
    const timer = setTimeout(() => setCelebrate(null), 3000)
    return () => clearTimeout(timer)
  }, [celebrate])
  useEffect(() => {
    if (phase === 'listening' && !(ended && allRight) && left <= 0) handleDone()
  }, [phase, ended, allRight, left])

  function reset() {
    readingRef.current += 1
    sessionRef.current?.cancel()
    sessionRef.current = null
    setPhase('idle')
    setStates(words.map(blankState))
    setCurrent(0)
    setSelected(null)
    setReport(null)
    setErrorMsg('')
    setQuietFor(0)
    setStuckFor(0)
    setCelebrate(null)
  }

  // the microphone's loudness, about every 100 ms
  function onLevel(reading, rms) {
    if (reading !== readingRef.current) return
    levelRef.current.add(rms)
    if (levelRef.current.isSpeech(rms)) {
      speechRunRef.current += 1
      if (!countingRef.current || speechRunRef.current >= POPUP_SPEECH) {
        spokeAtRef.current = performance.now()
        spokenRef.current = true
      }
    } else {
      speechRunRef.current = 0
    }
  }

  // the reader did something: the waits start over
  function restartWait() {
    spokeAtRef.current = movedAtRef.current = performance.now()
    setQuietFor(0)
    setStuckFor(0)
  }

  function onEvent(reading, msg) {
    if (reading !== readingRef.current) return
    if (msg.type === 'ready') {
      restartWait()
      setPhase('listening')
    }
    else if (msg.type === 'current') setCurrent(msg.wi)
    else if (msg.type === 'word') {
      movedAtRef.current = performance.now()
      setStates(prev => prev.map((s, i) => (i === msg.wi ? { status: msg.status, wrongTries: msg.wrongTries, flags: msg.flags } : s)))
    } else if (msg.type === 'final') {
      const audioUrl = URL.createObjectURL(msg.audio)
      setReport({ ...msg.report, audioUrl })
      // The full report has the last word: each word now shows its verdict, so
      // the verse and the report agree (live, a word is graded on a short
      // stretch of audio, and a close call can come out the other way)
      setStates(prev => prev.map((s, wi) => {
        const flags = msg.flags.filter(f => f.wi === wi)
        const real = flags.filter(f => !(f.kind === 'sheva-na' && f.partner === 'short'))
        const skipped = real.some(f => f.kind === 'word' && f.test === 'skipped')
        const status = skipped && s.status !== 'wrong' ? 'skipped' : real.length ? 'wrong' : 'correct'
        return { ...s, status, flags }
      }))
      setPhase('done')
      onFinished?.(msg.report, audioUrl)
    } else if (msg.type === 'error') {
      setErrorMsg(msg.error)
      setPhase('error')
    } else if (msg.type === 'closed' && !msg.finished) {
      setPhase(p => (p === 'error' || p === 'idle' ? p : 'error'))
      setErrorMsg(m => m || 'The connection to the reader closed.')
    }
  }

  async function handleStart() {
    prepareDing()
    reset()
    setPhase('connecting')
    const reading = readingRef.current
    levelRef.current = new SpeechLevel()
    spokenRef.current = false
    try {
      const session = await startLiveReading({
        referenceText: pasuk.text, settings, follow,
        onEvent: msg => onEvent(reading, msg), onLevel: rms => onLevel(reading, rms),
      })
      if (reading === readingRef.current) sessionRef.current = session
      else session.cancel()
    } catch (err) {
      if (reading !== readingRef.current) return
      setErrorMsg(err.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow it in the browser and try again.' : err.message)
      setPhase('error')
    }
  }

  function handleDone() {
    if (phaseRef.current !== 'listening') return
    setPhase('finishing')
    sessionRef.current?.stop()
  }

  function handleWordClick(wi) {
    restartWait()
    setSelected(s => (s === wi ? null : wi))
  }

  function handleTryAgain(wi) {
    restartWait()
    sessionRef.current?.goTo(wi)
    setCurrent(wi)
    setSelected(null)
  }

  const listening = phase === 'listening'
  const stoppingIn = Math.max(1, Math.ceil(left))
  const counting = listening && !(ended && allRight) && left <= COUNTDOWN
  countingRef.current = counting

  // a ding when the popup shows, with the microphone muted meanwhile (it
  // would hear the ding, and take it for the reader)
  useEffect(() => {
    if (!counting) return
    sessionRef.current?.mute(playDing())
  }, [counting])
  const sel = selected !== null ? states[selected] : null
  const notes = sel && sel.status === 'wrong'
    ? gradeWordFromFindings(words[selected], sel.flags, settings).syllables.map(s => s.note).filter(Boolean)
    : []
  const firstTry = states.filter(s => s.status === 'correct' && s.wrongTries === 0).length
  const afterRetry = states.filter(s => s.status === 'correct' && s.wrongTries > 0).length
  const notYet = states.filter(s => s.status === 'wrong' || s.status === 'skipped').length
  const toWorkOn = report?.words.filter(w => w.errorType !== 'None').length ?? 0

  return (
    <div className="live-reader">
      {/* About to stop on its own: at the top of the screen, where the reader
          is looking (not beside the verse, so a red word can still be tapped) */}
      {celebrate && (
        <div className="live-countdown-pop live-celebrate-pop" role="status" onClick={() => setCelebrate(null)}>
          <span className="live-countdown-num live-celebrate-mark" aria-hidden="true">{celebrate.perfect ? '★' : '✓'}</span>
          <div className="live-countdown-text">
            <strong>{celebrate.perfect ? 'Perfect!' : 'Well done!'}</strong>
            <span>
              {celebrate.perfect
                ? 'Every word right the first time.'
                : `Every word right — ${celebrate.retried} after another try.`}
            </span>
          </div>
        </div>
      )}
      {counting && (
        <div className="live-countdown-pop" role="alert">
          <span className="live-countdown-num" aria-label={`Stopping in ${stoppingIn} seconds`}>{stoppingIn}</span>
          <div className="live-countdown-text">
            <strong>{ended ? 'Want to fix a red word?' : 'Still there?'}</strong>
            <span>{ended ? 'Tap it to read it again. Stopping soon…' : 'Keep reading, or this reading will stop.'}</span>
          </div>
          <div className="live-countdown-actions">
            <button className="btn btn-done" onClick={restartWait}>Keep listening</button>
            <button className="btn btn-cancel" onClick={handleDone}>Stop now</button>
          </div>
        </div>
      )}
      <div className="pasuk-card">
        <div className="hebrew-text live-text" dir="rtl" lang="he">
          {words.map((w, wi) => {
            const s = states[wi]
            const cls = [
              'live-word',
              `live-word--${s.status}`,
              s.status === 'correct' && s.wrongTries > 0 && 'live-word--corrected',
              (listening || phase === 'connecting') && wi === current && 'live-word--current',
              selected === wi && 'live-word--selected',
            ].filter(Boolean).join(' ')
            return (
              <span key={wi}>
                <span
                  className={cls}
                  onClick={() => s.status !== 'waiting' && handleWordClick(wi)}
                  title={s.status === 'correct' && s.wrongTries > 0 ? `Right after ${s.wrongTries + 1} tries` : undefined}
                >
                  {w}
                </span>
                {/* A maqef part stays joined to the next word, as in the verse */}
                {wi < words.length - 1 && !w.endsWith('־') ? ' ' : '⁠'}
              </span>
            )
          })}
        </div>
        <div className="pasuk-meta">
          <span className="pasuk-ref">{pasuk.reference}</span>
        </div>

        {sel && (
          <div className="live-detail">
            <div className="live-detail-head">
              <span className="live-detail-word" dir="rtl" lang="he">{words[selected]}</span>
              <span className={`live-detail-status live-detail-status--${sel.status}`}>
                {sel.status === 'correct' ? (sel.wrongTries ? `Right after ${sel.wrongTries + 1} tries` : 'Right') : sel.status === 'skipped' ? 'Not read' : 'Not right yet'}
              </span>
              <button className="phoneme-panel-close" onClick={() => setSelected(null)} aria-label="Close">✕</button>
            </div>
            {notes.length > 0 && <ul className="live-detail-notes">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            {listening && sel.status !== 'correct' && (
              <button className="btn btn-reset" onClick={() => handleTryAgain(selected)}>↺ Read this word again</button>
            )}
          </div>
        )}
      </div>

      <div className="live-controls">
        {(phase === 'idle' || phase === 'error') && (
          <>
            <div className="provider-selector">
              <span className="provider-label">A wrong word</span>
              <div className="provider-seg">
                <button className={`provider-btn ${follow ? 'provider-btn--active' : ''}`} onClick={() => setFollow(true)}
                  title="Stays red, and the reader can go on (tap it to come back)">Can go on</button>
                <button className={`provider-btn ${!follow ? 'provider-btn--active' : ''}`} onClick={() => setFollow(false)}
                  title="Must be read right before the next word counts">Must be fixed first</button>
              </div>
            </div>
            {phase === 'error' && <p className="error-msg">{errorMsg}</p>}
            <button className="btn btn-record" onClick={handleStart}>
              <span className="record-dot" /> Start reading
            </button>
          </>
        )}

        {phase === 'connecting' && (
          <div className="preparing-state">
            <div className="spinner" />
            <p>Starting the microphone…</p>
            <button className="btn btn-cancel" onClick={reset}>Cancel</button>
          </div>
        )}

        {listening && (
          <div className="recording-state">
            <div className="recording-indicator">
              <span className="pulse-ring" />
              <span className="record-dot active" />
            </div>
            <p>
              {ended && allRight ? 'Well done!'
                : ended ? 'Tap a red word to read it again, or press Done'
                : 'Listening — read the verse aloud'}
            </p>
            <div className="recording-actions">
              <button className="btn btn-done" onClick={handleDone}>Done</button>
              <button className="btn btn-cancel" onClick={reset}>Cancel</button>
            </div>
          </div>
        )}

        {phase === 'finishing' && (
          <div className="processing-state">
            <div className="spinner" />
            <p>Checking the whole reading…</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="live-summary">
            <p>
              <strong>{firstTry}</strong> of {words.length} words right the first time
              {afterRetry > 0 && <>, <strong>{afterRetry}</strong> after another try</>}
              {notYet > 0 && <>, <strong>{notYet}</strong> not yet</>}.
            </p>
            {report && (
              <p className="live-summary-full">
                {toWorkOn === 0 ? 'The full check found nothing to work on.' : `The full check found ${toWorkOn} word${toWorkOn === 1 ? '' : 's'} to work on.`}
              </p>
            )}
            {allRight && (
              <div className="live-next">
                <p>Ready? Read the whole verse for a score.</p>
                <button className="btn btn-record" onClick={onWholeVerse}>
                  <span className="record-dot" /> Read the whole verse
                </button>
              </div>
            )}
            <div className="done-actions">
              {report && <button className={`btn ${allRight ? 'btn-reset' : 'btn-done'}`} onClick={() => onReport(report)}>See full report</button>}
              <button className="btn btn-reset" onClick={handleStart}>↺ Read again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const blankState = () => ({ status: 'waiting', wrongTries: 0, flags: [] })
