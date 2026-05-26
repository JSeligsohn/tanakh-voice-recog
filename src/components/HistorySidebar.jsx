function scoreColor(score) {
  if (score >= 80) return '#16a34a'
  if (score >= 60) return '#d97706'
  return '#dc2626'
}

function HistoryEntry({ entry, attemptNumber, isSelected, onSelect }) {
  const color = scoreColor(entry.scores.pronunciation)

  return (
    <div
      className={`history-entry ${isSelected ? 'history-entry--selected' : ''}`}
      onClick={() => onSelect(entry)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(entry)}
    >
      <div className="history-entry-header">
        <span className="history-attempt-label">Attempt #{attemptNumber}</span>
        <span className="history-score-badge" style={{ background: color }}>
          {Math.round(entry.scores.pronunciation)}
        </span>
      </div>

      <div className="history-words" dir="rtl" lang="he">
        {entry.wordResults.map((w, i) => (
          <span key={i}>
            <span
              className="history-word"
              style={{ borderBottom: `2px solid ${scoreColor(w.score)}` }}
            >
              {w.word}
            </span>
            {i < entry.wordResults.length - 1 ? ' ' : null}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function HistorySidebar({ history, selectedId, onSelect, onClose }) {
  const total = history.length

  return (
    <aside className="history-sidebar">
      <div className="history-sidebar-header">
        <h2>Attempts</h2>
        <button className="history-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="history-list">
        {history.length === 0 ? (
          <p className="history-empty">No attempts yet for this verse.</p>
        ) : (
          history.map((entry, i) => (
            <HistoryEntry
              key={entry.id}
              entry={entry}
              attemptNumber={total - i}
              isSelected={selectedId === entry.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  )
}
