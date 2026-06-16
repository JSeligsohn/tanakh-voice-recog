import { topIssueFor, trendFor } from '../data/progressDummy'

function TrendArrow({ trend }) {
  if (!trend) return <span className="roster-trend">—</span>
  return (
    <span className={`roster-trend trend-${trend.dir}`}>
      {trend.dir === 'up' && '↗'}
      {trend.dir === 'down' && '↘'}
      {trend.dir === 'flat' && '→'}
      <span style={{ marginLeft: '0.3rem' }}>{trend.pct}</span>
    </span>
  )
}

export default function TeacherRoster({ students, onSelect }) {
  return (
    <div className="roster-view">
      <div className="roster-head">
        <h2>My Students</h2>
        <button className="roster-add" disabled>+ Add Student</button>
      </div>
      <ul className="roster-list">
        {students.map(s => {
          const trend = trendFor(s)
          const issue = topIssueFor(s)
          const hasData = s.totalRecordings > 0
          return (
            <li key={s.id} className="roster-row" onClick={() => onSelect(s)}>
              <div className="roster-row-head">
                <span className="roster-row-name">{s.name}</span>
                <span className="roster-row-recs">
                  {hasData ? `${s.totalRecordings} recordings` : 'Hasn’t started'}
                </span>
              </div>
              <div className="roster-row-stats">
                {hasData ? (
                  <>
                    <span className="roster-row-avg">avg {s.avgScore}%</span>
                    <TrendArrow trend={trend} />
                    {issue && (
                      <span className="roster-row-issue">top issue: <strong>{issue}</strong></span>
                    )}
                  </>
                ) : (
                  <span className="roster-row-issue">No data yet</span>
                )}
                <span className="roster-row-last">Last: {s.lastActivity}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
