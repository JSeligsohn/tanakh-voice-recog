// Review page (/?review): testers' saved attempts — listen to each recording,
// see what the transcriber wrote back (its raw reply), and how the rules
// engine grades it now. /?review=<id> is a tester's shared link to one attempt
// ("Share for review" in the app), opened straight away. Asks once for the
// review password (REVIEW_KEY on the server) and remembers it on this device.

import { useCallback, useEffect, useState } from 'react'
import { psukim } from '../data/psukim'
import { parseTranscription, gradeTranscription } from '../services/openaiRulesAssessment'
import { wordLabel } from '../utils/wordScore'
import SyllableProblems from './SyllableProblems'
import '../App.css'

const KEY_STORAGE = 'tanakh-review-key'
const readKey = () => { try { return localStorage.getItem(KEY_STORAGE) ?? '' } catch { return '' } }
const saveKey = key => { try { key ? localStorage.setItem(KEY_STORAGE, key) : localStorage.removeItem(KEY_STORAGE) } catch { /* private mode */ } }

async function review(key, { method = 'GET', query = '' } = {}) {
  const res = await fetch(`/api/review${query}`, { method, headers: { 'x-review-key': key } })
  if (res.status === 401) throw Object.assign(new Error('Wrong review password.'), { unauthorized: true })
  if (!res.ok) {
    let msg = `Server error (${res.status}).`
    try { msg = (await res.json()).error ?? msg } catch { /* not JSON */ }
    throw new Error(msg)
  }
  return res
}

const scoreColor = score => (score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626')

// The attempt graded by today's rules engine, as the app grades a reading
function regrade(attempt) {
  try {
    const transcription = parseTranscription(attempt.content)
    const { words, scores } = gradeTranscription(transcription, attempt.referenceText, attempt.settings)
    return { transcription, words, scores }
  } catch (err) {
    return { error: err.message }
  }
}

function AttemptAudio({ id, reviewKey }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    review(reviewKey, { query: `?audio=${encodeURIComponent(id)}` })
      .then(res => res.blob())
      .then(blob => { if (!cancelled) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) } })
      .catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [id, reviewKey])
  if (error) return <p className="review-error">Recording: {error}</p>
  if (!url) return <p className="review-muted">Loading recording…</p>
  return <audio className="review-audio" controls src={url} />
}

function AttemptDetails({ attempt, graded, reviewKey }) {
  const [showRaw, setShowRaw] = useState(false)
  return (
    <div className="review-details">
      <AttemptAudio id={attempt.id} reviewKey={reviewKey} />

      <div className="review-field">
        <span className="review-label">Transcription</span>
        <code className="review-transcription">{graded.transcription ?? '—'}</code>
      </div>

      {graded.error ? (
        <p className="review-error">Couldn't grade this reply: {graded.error}</p>
      ) : (
        <>
          <div className="review-words" dir="rtl" lang="he">
            {graded.words.map((w, i) => (
              <span key={i} className="review-word" title={`${wordLabel(w)} — heard "${w.phoneticHeard || '—'}"`}>
                <span className="review-word-score" style={{ color: w.errorType === 'Omission' ? '#9ca3af' : scoreColor(w.score) }}>
                  {w.errorType === 'Omission' ? '—' : w.score}
                </span>
                <span className="review-word-text" style={{ borderBottomColor: w.errorType === 'Omission' ? '#9ca3af' : scoreColor(w.score) }}>{w.word}</span>
              </span>
            ))}
          </div>
          <ul className="review-issues">
            {graded.words.filter(w => wordLabel(w) !== 'Correct').map((w, i) => (
              <li key={i} className="review-issue">
                <div className="review-issue-head">
                  <span className="review-issue-word" dir="rtl" lang="he">{w.word}</span>
                  <span className="review-issue-label">{w.score} · {wordLabel(w)}</span>
                  <span className="review-muted">heard <code>{w.phoneticHeard || '—'}</code></span>
                </div>
                {w.errorType !== 'Omission' && <SyllableProblems phonemes={w.phonemes} />}
              </li>
            ))}
          </ul>
        </>
      )}

      <button className="review-link" onClick={() => setShowRaw(s => !s)}>
        {showRaw ? '▾' : '▸'} Raw output
      </button>
      {showRaw && <pre className="review-raw">{JSON.stringify(attempt, null, 2)}</pre>}
    </div>
  )
}

function AttemptCard({ attempt, reviewKey, onDeleted, startOpen = false }) {
  const [open, setOpen] = useState(startOpen)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [graded] = useState(() => regrade(attempt))
  const verse = psukim.find(p => p.text === attempt.referenceText)
  const when = new Date(attempt.createdAt)

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    setDeleting(true)
    try {
      await review(reviewKey, { method: 'DELETE', query: `?id=${encodeURIComponent(attempt.id)}` })
      onDeleted(attempt.id)
    } catch (err) {
      setDeleting(false)
      setConfirming(false)
      setDeleteError(err.message)
    }
  }

  return (
    <li className={`review-card ${open ? 'review-card--open' : ''}`}>
      <button className="review-card-head" onClick={() => setOpen(o => !o)}>
        <span className="review-when">
          {when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
          {when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </span>
        <span className="review-tester">{attempt.tester}</span>
        <span className="review-verse">{verse?.book ?? attempt.referenceText.split(/\s+/).slice(0, 3).join(' ')}</span>
        <span className="review-settings">
          {attempt.settings?.tradition === 'ashkenazic' ? 'Ashkenazic' : 'Sephardic'}
          {attempt.settings?.shevaMode === 'ignore' ? ' · sheva ignored' : ''}
        </span>
        {graded.scores ? (
          <span className="review-score" style={{ color: scoreColor(graded.scores.pronunciation) }}>
            {graded.scores.pronunciation}
            <span className="review-muted"> · {graded.scores.wordsCorrect}/{graded.scores.wordsTotal} words</span>
          </span>
        ) : <span className="review-error">not graded</span>}
        <span className="review-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <AttemptDetails attempt={attempt} graded={graded} reviewKey={reviewKey} />
          <div className="review-card-foot">
            <span className="review-muted">
              App version {attempt.commit} · {attempt.model}
            </span>
            {deleteError && <span className="review-error">{deleteError}</span>}
            <button className={`review-delete ${confirming ? 'review-delete--confirm' : ''}`} onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : confirming ? 'Delete for good?' : 'Delete'}
            </button>
            {confirming && !deleting && <button className="review-link" onClick={() => setConfirming(false)}>Keep</button>}
          </div>
        </>
      )}
    </li>
  )
}

// The attempt a shared link points to (/?review=<id>), or null for the list
const sharedId = () => new URLSearchParams(window.location.search).get('review') || null

export default function ReviewPage() {
  const [sharedAttemptId] = useState(sharedId)
  const [reviewKey, setReviewKey] = useState(readKey)
  const [draftKey, setDraftKey] = useState('')
  const [attempts, setAttempts] = useState(null)
  const [error, setError] = useState('')
  const [tester, setTester] = useState('all')

  const load = useCallback(key => {
    review(key, { query: sharedAttemptId ? `?id=${encodeURIComponent(sharedAttemptId)}` : '' })
      .then(res => res.json())
      .then(data => { setError(''); setAttempts(data.attempts ?? [data.attempt]) })
      .catch(err => {
        if (err.unauthorized) { saveKey(''); setReviewKey('') }
        setError(err.message)
      })
  }, [sharedAttemptId])

  useEffect(() => { if (reviewKey) load(reviewKey) }, [reviewKey, load])

  function handleSignIn(e) {
    e.preventDefault()
    const key = draftKey.trim()
    if (!key) return
    saveKey(key)
    setReviewKey(key)
    setDraftKey('')
  }

  const testers = [...new Set((attempts ?? []).map(a => a.tester))].sort()
  const shown = (attempts ?? []).filter(a => tester === 'all' || a.tester === tester)

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-content">
          <h1>Review</h1>
          <p>Testers' recordings: listen, see what was transcribed, and how it grades</p>
        </div>
        {reviewKey && (
          <button className="btn-history-toggle" onClick={() => { saveKey(''); setReviewKey(''); setAttempts(null) }}>
            Sign out
          </button>
        )}
      </header>

      <main className="app-main review-main">
        {!reviewKey ? (
          <form className="review-signin" onSubmit={handleSignIn}>
            <label htmlFor="review-key">Review password</label>
            <input id="review-key" type="password" value={draftKey} onChange={e => setDraftKey(e.target.value)} autoFocus />
            <button className="btn btn-record" type="submit">Open</button>
            {error && <p className="review-error">{error}</p>}
          </form>
        ) : (
          <>
            {sharedAttemptId ? (
              <div className="review-toolbar">
                <span className="review-muted">A shared attempt.</span>
                <a className="review-link" href="/?review">All attempts →</a>
              </div>
            ) : (
            <div className="review-toolbar">
              <label>
                Tester{' '}
                <select value={tester} onChange={e => setTester(e.target.value)}>
                  <option value="all">All</option>
                  {testers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <button className="btn btn-reset" onClick={() => load(reviewKey)}>↻ Refresh</button>
              <span className="review-muted">
                Grades use today's rules. Testers join with a link like <code>/?tester=rafi</code>.
              </span>
            </div>
            )}
            {error && <p className="review-error">{error}</p>}
            {attempts === null && !error && <p className="review-muted">Loading…</p>}
            {attempts?.length === 0 && <p className="review-muted">No saved attempts yet.</p>}
            <ul className="review-list">
              {shown.map(a => (
                <AttemptCard
                  key={a.id}
                  attempt={a}
                  reviewKey={reviewKey}
                  onDeleted={id => setAttempts(list => list.filter(x => x.id !== id))}
                  startOpen={Boolean(sharedAttemptId)}
                />
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  )
}
