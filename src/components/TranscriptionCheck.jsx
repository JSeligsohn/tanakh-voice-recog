// Dev-only page for checking the audio model's transcriptions. Each item is a
// word to say a stated way (correct or a deliberate mistake) with the
// transcription we expect. Recordings are kept in IndexedDB so the whole set
// can be re-transcribed after a prompt or model change without re-recording.

import { useEffect, useRef, useState } from 'react'
import { checkItems, verseItems } from '../data/transcriptionCheck'
import { psukim } from '../data/psukim'
import { transcribeAudio } from '../services/openaiRulesAssessment'
import { assessManual } from '../services/manualAssessment'
import { normalizeStudent, scoreWordAgainstTranscription } from '../utils/hebrewScoring'
import { saveRecording, loadAllRecordings } from '../utils/recordingStore'
import { waitForAudio } from '../utils/micReady'

const RESULTS_KEY = 'tanakh-transcription-check-results'
const RUN_ALL_CONCURRENCY = 3

function loadResults() {
  try { return JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '{}') } catch { return {} }
}

const compact = s => normalizeStudent(s).replace(/\s+/g, '')
const tradLabel = trad => (trad === 'ashkenazic' ? 'Ashkenazic' : 'Sephardic')
// Reference text sent with the recording: the word, or the whole verse
const referenceText = item => item.word ?? psukim[item.pasukIdx].text
const allItems = [...checkItems, ...verseItems]

// Compare a transcription with the item's expectations: does the text match,
// and does the grading engine treat it the way the reading intended?
function evaluate(item, heard) {
  const transcriptOk = [item.expect, ...(item.accept ?? [])].map(compact).includes(compact(heard))
  const graded = scoreWordAgainstTranscription(item.word, heard, { tradition: item.trad })
  const notes = graded.syllables.map(s => s.note).filter(Boolean)
  const gradeOk = item.intent === 'correct' ? notes.length === 0 : notes.length > 0
  return { transcriptOk, gradeOk, notes }
}

// Grade a verse transcription the way OpenAI (Rules) mode does after
// transcribing (assessManual runs the same word alignment and scoring), then
// mark each word: planted mistake caught/missed, or clean word ok/false flag.
function evaluateVerse(item, heard) {
  const { words } = assessManual(referenceText(item), heard, { tradition: item.trad })
  const planted = new Set(item.plants.map(p => p.index))
  const marked = words.map((w, i) => {
    const flagged = w.errorType !== 'None'
    const status = planted.has(i) ? (flagged ? 'caught' : 'missed') : (flagged ? 'false-flag' : 'ok')
    return { word: w.word, heard: w.phoneticHeard, status, notes: w.phonemes.map(p => p.note).filter(Boolean) }
  })
  return {
    words: marked,
    caught: marked.filter(w => w.status === 'caught').length,
    planted: planted.size,
    falseFlags: marked.filter(w => w.status === 'false-flag').length,
    clean: marked.length - planted.size,
  }
}

export default function TranscriptionCheck() {
  const [recordings, setRecordings] = useState({})
  const [results, setResults] = useState(loadResults)
  const [recordingId, setRecordingId] = useState(null)   // currently recording
  const [startingId, setStartingId] = useState(null)     // waiting for the mic
  const [busy, setBusy] = useState({})                   // { [id]: true } while transcribing
  const [runAll, setRunAll] = useState(null)             // { done, total, cost } during/after a run
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const recorderRef = useRef(null)

  useEffect(() => {
    loadAllRecordings().then(setRecordings).catch(e => setError(`Couldn't load saved recordings: ${e.message}`))
  }, [])

  useEffect(() => {
    try { localStorage.setItem(RESULTS_KEY, JSON.stringify(results)) } catch { /* storage unavailable */ }
  }, [results])

  async function transcribe(item, blob) {
    setBusy(b => ({ ...b, [item.id]: true }))
    try {
      const { transcription, cost } = await transcribeAudio(blob, referenceText(item))
      setResults(r => ({ ...r, [item.id]: { heard: transcription, cost, at: Date.now() } }))
      return cost
    } catch (e) {
      setResults(r => ({ ...r, [item.id]: { error: e.message, at: Date.now() } }))
      return 0
    } finally {
      setBusy(b => { const rest = { ...b }; delete rest[item.id]; return rest })
    }
  }

  async function startRecording(item) {
    setError('')
    setStartingId(item.id)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) || ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setRecordingId(null)
        if (chunks.length === 0) return
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
        setRecordings(r => ({ ...r, [item.id]: blob }))
        saveRecording(item.id, blob).catch(e => setError(`Couldn't save recording: ${e.message}`))
        await transcribe(item, blob)
      }
      // Wait for the recorder to start and the mic to deliver real audio, plus
      // a short buffer, so the first syllable isn't clipped (same as practice).
      const started = new Promise(resolve => { recorder.onstart = resolve })
      recorder.start()
      await started
      await waitForAudio(stream)
      await new Promise(resolve => setTimeout(resolve, 150))
      recorderRef.current = recorder
      setRecordingId(item.id)
    } catch (e) {
      setError(`Microphone error: ${e.message}`)
    } finally {
      setStartingId(null)
    }
  }

  function stopRecording() {
    recorderRef.current?.stop()
    recorderRef.current = null
  }

  function play(id) {
    const url = URL.createObjectURL(recordings[id])
    const audio = new Audio(url)
    audio.onended = () => URL.revokeObjectURL(url)
    audio.play()
  }

  async function reTranscribeAll() {
    const queue = allItems.filter(item => recordings[item.id])
    const total = queue.length
    let done = 0, cost = 0
    setRunAll({ done, total, cost })
    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift()
        cost += await transcribe(item, recordings[item.id])
        done++
        setRunAll({ done, total, cost })
      }
    }
    await Promise.all(Array.from({ length: RUN_ALL_CONCURRENCY }, worker))
  }

  // Summary over items that have a transcription
  const evaluated = checkItems
    .filter(item => results[item.id]?.heard !== undefined)
    .map(item => ({ item, ...evaluate(item, results[item.id].heard) }))
  const recordedCount = allItems.filter(item => recordings[item.id]).length
  const versesEvaluated = verseItems
    .filter(item => results[item.id]?.heard !== undefined)
    .map(item => evaluateVerse(item, results[item.id].heard))
  const verseTotals = versesEvaluated.reduce(
    (t, v) => ({ caught: t.caught + v.caught, planted: t.planted + v.planted, falseFlags: t.falseFlags + v.falseFlags, clean: t.clean + v.clean }),
    { caught: 0, planted: 0, falseFlags: 0, clean: 0 },
  )
  const transcriptMatches = evaluated.filter(e => e.transcriptOk).length
  const gradeMatches = evaluated.filter(e => e.gradeOk).length
  const anyBusy = Object.keys(busy).length > 0

  async function copyResults() {
    const lines = ['id\tword\tsay as\tintent\texpected\theard\ttranscript\tgrade\tnotes']
    for (const item of checkItems) {
      const r = results[item.id]
      if (!r) continue
      if (r.error) { lines.push(`${item.id}\t${item.word}\t${item.sayAs}\t${item.intent}\t${item.expect}\tERROR: ${r.error}`); continue }
      const e = evaluate(item, r.heard)
      lines.push([item.id, item.word, item.sayAs, item.intent, item.expect, r.heard,
        e.transcriptOk ? 'match' : 'MISMATCH', e.gradeOk ? 'as intended' : 'WRONG', e.notes.join(' ')].join('\t'))
    }
    lines.push('', `Transcript matches: ${transcriptMatches}/${evaluated.length} · Grading as intended: ${gradeMatches}/${evaluated.length}`)
    lines.push('', 'Full verses', 'id\tverse\ttradition\tcaught\tfalse flags\theard\tproblems')
    for (const item of verseItems) {
      const r = results[item.id]
      if (!r) continue
      const p = psukim[item.pasukIdx]
      if (r.error) { lines.push(`${item.id}\t${p.book}\t${item.trad}\tERROR: ${r.error}`); continue }
      const v = evaluateVerse(item, r.heard)
      const problems = v.words
        .filter(w => w.status === 'missed' || w.status === 'false-flag')
        .map(w => `${w.status === 'missed' ? 'MISSED' : 'FALSE FLAG'} ${w.word} (heard "${w.heard}")${w.notes.length ? ': ' + w.notes.join(' ') : ''}`)
      lines.push([item.id, p.book, item.trad, `${v.caught}/${v.planted}`, v.falseFlags, r.heard, problems.join(' | ')].join('\t'))
    }
    lines.push('', `Verses — mistakes caught: ${verseTotals.caught}/${verseTotals.planted} · false flags: ${verseTotals.falseFlags}/${verseTotals.clean} clean words`)
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError(`Couldn't copy: ${e.message}`)
    }
  }

  const groups = [...new Set(checkItems.map(i => i.group))]

  function controls(item) {
    const isRecording = recordingId === item.id
    return (
      <div className="tc-controls">
        {recordings[item.id] && !isRecording && (
          <button className="dev-role-btn" onClick={() => play(item.id)}>▶</button>
        )}
        {isRecording ? (
          <button className="dev-role-btn tc-rec tc-rec--on" onClick={stopRecording}>■ Stop</button>
        ) : (
          <button
            className="dev-role-btn tc-rec"
            onClick={() => startRecording(item)}
            disabled={!!recordingId || !!startingId || busy[item.id]}
          >
            {startingId === item.id ? '…' : recordings[item.id] ? '● Re-record' : '● Record'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="tc">
      <div className="tc-intro">
        <h2 className="tc-title">Transcription check</h2>
        <p className="tc-text">
          Record each item exactly as described — including the deliberate mistakes — and compare
          what the OpenAI (Rules) model writes against what we expect. Recordings are saved in this
          browser, so after a prompt or model change you can re-transcribe them all without
          re-recording. Each transcription costs about $0.002 — a full run is around 10¢.
        </p>
      </div>

      <div className="tc-summary">
        <div className="tc-stats">
          <span><strong>{recordedCount}</strong>/{allItems.length} recorded</span>
          <span>Words: <strong>{transcriptMatches}</strong>/{evaluated.length} transcripts match · <strong>{gradeMatches}</strong>/{evaluated.length} graded as intended</span>
          <span>Verses: <strong>{verseTotals.caught}</strong>/{verseTotals.planted} mistakes caught · <strong>{verseTotals.falseFlags}</strong>/{verseTotals.clean} false flags</span>
          {runAll && (
            <span className="tc-muted">
              {runAll.done < runAll.total ? `Transcribing ${runAll.done}/${runAll.total}…` : `Last run: ${runAll.total} items`}
              {' '}· ≈ ${runAll.cost.toFixed(3)}
            </span>
          )}
        </div>
        <div className="tc-actions">
          <button className="dev-role-btn" onClick={reTranscribeAll} disabled={recordedCount === 0 || anyBusy || !!recordingId}>
            Re-transcribe all ({recordedCount})
          </button>
          <button className="dev-role-btn" onClick={copyResults} disabled={evaluated.length + versesEvaluated.length === 0}>
            {copied ? 'Copied ✓' : 'Copy results'}
          </button>
        </div>
      </div>

      {error && <p className="tc-error">{error}</p>}

      {groups.map(group => (
        <section key={group} className="tc-group">
          <h3 className="tc-group-title">{group}</h3>
          {checkItems.filter(i => i.group === group).map(item => {
            const r = results[item.id]
            const e = r?.heard !== undefined ? evaluate(item, r.heard) : null
            return (
              <div key={item.id} className="tc-item">
                <div className="tc-item-main">
                  <span className="tc-word" dir="rtl" lang="he">{item.word}</span>
                  <div className="tc-item-text">
                    <div className="tc-say">{item.sayAs}</div>
                    <div className="tc-meta">
                      <span className={`tc-badge ${item.intent === 'error' ? 'tc-badge--error' : ''}`}>
                        {item.intent === 'error' ? 'Deliberate mistake' : 'Correct reading'}
                      </span>
                      <span className="tc-muted">{tradLabel(item.trad)}</span>
                      <span className="tc-muted">expect <code>{item.expect}</code></span>
                    </div>
                  </div>
                  {controls(item)}
                </div>
                {(busy[item.id] || r) && (
                  <div className="tc-result">
                    {busy[item.id] ? (
                      <span className="tc-muted">Transcribing…</span>
                    ) : r.error ? (
                      <span className="tc-bad">Error: {r.error}</span>
                    ) : (
                      <>
                        <span>heard <code>{r.heard || '(nothing)'}</code></span>
                        <span className={e.transcriptOk ? 'tc-good' : 'tc-bad'}>
                          {e.transcriptOk ? '✓ transcript' : '✗ transcript'}
                        </span>
                        <span className={e.gradeOk ? 'tc-good' : 'tc-bad'}>
                          {e.gradeOk ? '✓' : '✗'} {e.notes.length === 0 ? 'graded clean' : 'flagged'}
                        </span>
                        {e.notes.length > 0 && <span className="tc-notes">{e.notes.join(' ')}</span>}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}

      <section className="tc-group">
        <h3 className="tc-group-title">Full verses</h3>
        <p className="tc-text">
          Read each whole verse at a natural pace, the way a student would. In the mistake versions,
          read everything else correctly and slip in only the listed mistakes.
        </p>
        {verseItems.map(item => {
          const r = results[item.id]
          const v = r?.heard !== undefined ? evaluateVerse(item, r.heard) : null
          const p = psukim[item.pasukIdx]
          const words = p.text.split(/\s+/).filter(Boolean)
          return (
            <div key={item.id} className="tc-item">
              <div className="tc-item-main">
                <div className="tc-item-text">
                  <div className="tc-say">
                    {p.book} · {tradLabel(item.trad)} —{' '}
                    {item.plants.length === 0 ? 'read it all correctly' : 'read correctly except:'}
                  </div>
                  <div className="tc-verse" dir="rtl" lang="he">{p.text.replaceAll('־', '־\u2060')}</div>
                  {item.plants.length > 0 && (
                    <ul className="tc-plants">
                      {item.plants.map(pl => (
                        <li key={pl.index}>
                          <span dir="rtl" lang="he" className="tc-plant-word">{words[pl.index]}</span>
                          {' '}say <strong>{pl.sayAs}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {controls(item)}
              </div>
              {(busy[item.id] || r) && (
                <div className="tc-result">
                  {busy[item.id] ? (
                    <span className="tc-muted">Transcribing…</span>
                  ) : r.error ? (
                    <span className="tc-bad">Error: {r.error}</span>
                  ) : (
                    <>
                      <span>heard <code>{r.heard || '(nothing)'}</code></span>
                      {v.planted > 0 && (
                        <span className={v.caught === v.planted ? 'tc-good' : 'tc-bad'}>
                          {v.caught}/{v.planted} mistakes caught
                        </span>
                      )}
                      <span className={v.falseFlags === 0 ? 'tc-good' : 'tc-bad'}>
                        {v.falseFlags} false flag{v.falseFlags === 1 ? '' : 's'}
                      </span>
                      <div className="tc-verse-words" dir="rtl">
                        {v.words.map((w, i) => (
                          <span key={i} className={`tc-vw tc-vw--${w.status}`} title={w.notes.join(' ')}>
                            <span lang="he">{w.word}</span>
                            <code dir="ltr">{w.heard || '—'}</code>
                          </span>
                        ))}
                      </div>
                      {v.words.filter(w => w.status === 'missed' || w.status === 'false-flag').map((w, i) => (
                        <span key={i} className="tc-notes">
                          {w.status === 'missed' ? 'Missed' : 'False flag'} on <span lang="he">{w.word}</span>
                          {w.notes.length > 0 ? `: ${w.notes.join(' ')}` : ` (heard "${w.heard}")`}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
