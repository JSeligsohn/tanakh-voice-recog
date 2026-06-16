import { SKILL_CATEGORIES, trendFor } from '../data/progressDummy'

const STRENGTH_THRESHOLD = 90

function MiniLineChart({ points }) {
  if (!points?.length) return null
  const W = 340, H = 140, PAD_L = 28, PAD_R = 8, PAD_T = 8, PAD_B = 22
  const min = 50, max = 100
  const xAt = (i) => PAD_L + (i * (W - PAD_L - PAD_R)) / Math.max(1, points.length - 1)
  const yAt = (score) => PAD_T + (1 - (score - min) / (max - min)) * (H - PAD_T - PAD_B)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.score).toFixed(1)}`).join(' ')

  // Y-axis tick labels
  const yTicks = [50, 75, 100]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="progress-chart" preserveAspectRatio="none">
      {/* y-axis tick lines + labels */}
      {yTicks.map((v, i) => (
        <g key={v}>
          <line
            x1={PAD_L} y1={yAt(v)} x2={W - PAD_R} y2={yAt(v)}
            stroke={v === 100 ? '#e7e5e4' : '#f5f0e8'} strokeDasharray={v === 100 ? '0' : '2 3'}
          />
          <text x={PAD_L - 4} y={yAt(v) + 3} fontSize="9" fill="#a8a29e" textAnchor="end">{v}</text>
        </g>
      ))}

      {/* x-axis baseline */}
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#d6d3d1" />

      <path d={d} fill="none" stroke="#7c1d1d" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xAt(i)} cy={yAt(p.score)} r="3.5" fill="#7c1d1d" />
        </g>
      ))}

      {/* x-axis date labels — first, middle, last */}
      {[0, Math.floor(points.length / 2), points.length - 1].map(i => (
        <text key={i} x={xAt(i)} y={H - 6} fontSize="9" fill="#78716c" textAnchor="middle">
          {points[i].date}
        </text>
      ))}
    </svg>
  )
}

function SkillRow({ skill }) {
  const cat = SKILL_CATEGORIES[skill.category] ?? { color: '#78716c', label: '' }
  const barColor = skill.accuracy >= STRENGTH_THRESHOLD
    ? '#16a34a'
    : skill.accuracy >= 75 ? '#d97706' : '#dc2626'
  return (
    <div className="skill-row">
      <div className="skill-row-head">
        <span className="skill-row-name">
          {skill.glyph && (
            <span className="skill-row-glyph" dir="rtl" lang="he">{skill.glyph}</span>
          )}
          {skill.name}
        </span>
        <span className="skill-row-pct" style={{ color: barColor }}>{skill.accuracy}%</span>
      </div>
      <div className="skill-row-bar">
        <div className="skill-row-bar-fill" style={{ width: `${skill.accuracy}%`, background: barColor }} />
      </div>
      <div className="skill-row-meta">
        <span className="skill-row-cat" style={{ color: cat.color }}>{cat.label}</span>
        <span>{skill.attempts} attempts</span>
      </div>
    </div>
  )
}

export default function ProgressView({ student, viewer = 'student', onBack }) {
  if (!student) return null
  const trend = trendFor(student)
  const strengths = student.skills.filter(s => s.accuracy >= STRENGTH_THRESHOLD).sort((a, b) => b.accuracy - a.accuracy)
  const needsWork = student.skills.filter(s => s.accuracy < STRENGTH_THRESHOLD).sort((a, b) => a.accuracy - b.accuracy)

  const isEmpty = student.totalRecordings === 0

  return (
    <div className="progress-view">
      {onBack && (
        <button className="progress-back" onClick={onBack}>← Back to roster</button>
      )}

      <div className="progress-hero">
        <h2 className="progress-hero-title">
          {viewer === 'student' ? `Hi ${student.name.split(' ')[0]}` : student.name}
        </h2>
        {!isEmpty && (
          <p className="progress-hero-stats">
            {student.totalRecordings} recordings · avg {student.avgScore}%
          </p>
        )}
        {isEmpty && (
          <p className="progress-hero-stats">No recordings yet.</p>
        )}
      </div>

      {!isEmpty && (
        <div className="progress-period">
          <div className="progress-period-label">This month</div>
          <div className="progress-period-row">
            <span className="progress-period-avg">{student.monthlyAvg}%</span>
            {trend && (
              <span className={`progress-period-trend trend-${trend.dir}`}>
                {trend.dir === 'up' && '↗ '}
                {trend.dir === 'down' && '↘ '}
                {trend.dir === 'flat' && '→ '}
                {trend.pct} vs last month
              </span>
            )}
          </div>
        </div>
      )}

      {!isEmpty && (
        <div className="progress-skills">
          <div className="progress-skills-col">
            <h3 className="progress-skills-title">Strengths</h3>
            {strengths.length === 0 ? (
              <p className="progress-skills-empty">No strengths above {STRENGTH_THRESHOLD}% yet — keep practicing!</p>
            ) : (
              strengths.map(s => <SkillRow key={s.name} skill={s} />)
            )}
          </div>
          <div className="progress-skills-col">
            <h3 className="progress-skills-title">Needs work</h3>
            {needsWork.length === 0 ? (
              <p className="progress-skills-empty">All skills above {STRENGTH_THRESHOLD}%. 🎉</p>
            ) : (
              needsWork.map(s => <SkillRow key={s.name} skill={s} />)
            )}
          </div>
        </div>
      )}

      {!isEmpty && (
        <div className="progress-chart-card">
          <h3 className="progress-skills-title">Overall score per recording</h3>
          <p className="progress-chart-sub">Last {student.scoreHistory.length} recordings, oldest to newest</p>
          <MiniLineChart points={student.scoreHistory} />
        </div>
      )}

      {!isEmpty && (
        <div className="progress-recent">
          <h3 className="progress-skills-title">Recent recordings</h3>
          <div className="progress-recent-headerrow">
            <span>When</span>
            <span>Verse</span>
            <span className="progress-recent-headerrow-score">Score</span>
            <span>Areas to work on</span>
          </div>
          <ul className="progress-recent-list">
            {student.recordings.slice(0, 10).map((r, i) => (
              <li key={i} className="progress-recent-row">
                <span className="progress-recent-date">{r.date}</span>
                <span className="progress-recent-verse">
                  <span className="progress-recent-verse-he" dir="rtl" lang="he">{r.verseHe}</span>
                  <span className="progress-recent-verse-en">{r.verseEn}</span>
                </span>
                <span className="progress-recent-score">{r.score}%</span>
                <span className="progress-recent-issues">
                  {r.issues.length === 0
                    ? <span className="progress-recent-issues-none">No issues</span>
                    : r.issues.join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isEmpty && (
        <p className="progress-empty">This student hasn't started recording yet.</p>
      )}
    </div>
  )
}
