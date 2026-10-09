// Dev-only page for checking the audio model's transcriptions. Each item is a
// word to say a stated way (correct or a deliberate mistake) with the
// transcription we expect. Recordings are kept in IndexedDB so the whole set
// can be re-transcribed after a prompt or model change without re-recording.

import { useEffect, useRef, useState } from 'react'
import { checkItems } from '../data/transcriptionCheck'
import { transcribeAudio } from '../services/openaiRulesAssessment'
import { normalizeStudent, scoreWordAgainstTranscription } from '../utils/hebrewScoring'
import { saveRecording, loadAllRecordings } from '../utils/recordingStore'

const RESULTS_KEY = 'tanakh-transcription-check-results'
const RUN_ALL_CONCURRENCY = 3

function loadResults() {
  try { return JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '{}') } catch { return {} }
}

const compact = s => normalizeStudent(s).replace(/\s+/g, '')

// Compare a transcription with the item's expectations: does the text match,
// and does the grading engine treat it the way the reading intended?
function evaluate(item, heard) {
  const transcriptOk = [item.expect, ...(item.accept ?? [])].map(compact).includes(compact(heard))
  const graded = scoreWordAgainstTranscription(item.word, heard, { tradition: item.trad })
  const notes = graded.syllables.map(s => s.note).filter(Boolean)
  const gradeOk = item.intent === 'correct' ? notes.length === 0 : notes.length > 0
  return { transcriptOk, gradeOk, notes }
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
      const { transcription, cost } = await transcribeAudio(blob, item.word)
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
      // Wait for the recorder to really start, plus a short buffer, so the
      // first syllable isn't clipped (same reason as the practice recorder).
      const started = new Promise(resolve => { recorder.onstart = resolve })
      recorder.start()
      await started
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
    const queue = checkItems.filter(item => recordings[item.id])
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
  const recordedCount = checkItems.filter(item => recordings[item.id]).length
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
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setError(`Couldn't copy: ${e.message}`)
    }
  }

  const groups = [...new Set(checkItems.map(i => i.group))]

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
          <span><strong>{recordedCount}</strong>/{checkItems.length} recorded</span>
          <span><strong>{transcriptMatches}</strong>/{evaluated.length} transcripts match</span>
          <span><strong>{gradeMatches}</strong>/{evaluated.length} graded as intended</span>
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
          <button className="dev-role-btn" onClick={copyResults} disabled={evaluated.length === 0}>
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
            const isRecording = recordingId === item.id
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
                      <span className="tc-muted">{item.trad === 'ashkenazic' ? 'Ashkenazic' : 'Sephardic'}</span>
                      <span className="tc-muted">expect <code>{item.expect}</code></span>
                    </div>
                  </div>
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
    </div>
  )
}
