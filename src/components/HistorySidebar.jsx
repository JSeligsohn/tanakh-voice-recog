import { useState, useRef, useEffect } from 'react'

function scoreColor(score) {
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#d97706'
  return '#dc2626'
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function HistoryEntry({ entry, attemptNumber, totalAttempts, isPlaying, onPlay, onStop }) {
  const color = scoreColor(entry.scores.pronunciation)

  return (
    <div className="history-entry">
      <div className="history-entry-header">
        <span className="history-attempt-label">Attempt #{attemptNumber} of {totalAttempts}</span>
        <span className="history-entry-time">{timeAgo(entry.timestamp)}</span>
      </div>

      <div className="history-score-row">
        <span className="history-score-badge" style={{ background: color }}>
          {Math.round(entry.scores.pronunciation)}
        </span>
        <div className="history-sub-scores">
          {[
            ['Acc', entry.scores.accuracy],
            ['Flu', entry.scores.fluency],
            ['Cmp', entry.scores.completeness],
          ].map(([label, val]) => (
            <span key={label} className="history-sub-score">
              <span style={{ color: scoreColor(val) }}>{Math.round(val)}</span>
              <span className="history-sub-label">{label}</span>
            </span>
          ))}
        </div>
        {entry.audioUrl && (
          <button
            className={`btn-history-play ${isPlaying ? 'btn-history-play--active' : ''}`}
            onClick={isPlaying ? onStop : onPlay}
            title={isPlaying ? 'Stop' : 'Play back your recording'}
          >
            {isPlaying ? '■' : '▶'}
          </button>
        )}
      </div>

      <div className="history-words" dir="rtl" lang="he">
        {entry.wordResults.map((w, i) => (
          <span
            key={i}
            className="history-word"
            style={{ borderBottom: `2px solid ${scoreColor(w.score)}` }}
          >
            {w.word}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function HistorySidebar({ history, onClose }) {
  const [playingId, setPlayingId] = useState(null)
  const audioRef = useRef(null)

  function handlePlay(entry) {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setPlayingId(entry.id)
    const audio = new Audio(entry.audioUrl)
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    audioRef.current = audio
    audio.play().catch(() => setPlayingId(null))
  }

  function handleStop() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setPlayingId(null)
  }

  useEffect(() => () => handleStop(), [])

  // history arrives newest-first; display newest-first but number oldest as #1
  const total = history.length

  return (
    <aside className="history-sidebar">
      <div className="history-sidebar-header">
        <h2>Previous Attempts</h2>
        <button className="history-close" onClick={() => { handleStop(); onClose() }} aria-label="Close">✕</button>
      </div>

      <div className="history-list">
        {history.length === 0 ? (
          <p className="history-empty">No attempts yet for this verse.</p>
        ) : (
          history.map((entry, i) => (
            <HistoryEntry
              key={entry.id}
              entry={entry}
              attemptNumber={total - i}   // newest shown first, numbered highest
              totalAttempts={total}
              isPlaying={playingId === entry.id}
              onPlay={() => handlePlay(entry)}
              onStop={handleStop}
            />
          ))
        )}
      </div>
    </aside>
  )
}
