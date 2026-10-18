// Dev-only page comparing ways of having OpenAI read a verse aloud: Sephardi
// and Ashkenazi, different instructions, respelled text, two models, several
// voices. Every reading is saved by the dev server under voice-library/ (see
// vite.config.js) with your rating and note, so nothing is generated twice and
// the good takes become the start of the app's audio library.

import { useEffect, useRef, useState } from 'react'
import { voiceLabVerses } from '../data/voiceLab'
import { SPEECH_VARIANTS, SPEECH_VOICES, speechInput, speechSource } from '../services/prompts/speechPrompts'

const SETTINGS_KEY = 'tanakh-voice-lab-settings'
const CONCURRENCY = 3
// Rough cost per minute of audio, and about one second per word at a teacher's pace
const COST_PER_MIN = { tts: 0.015, chat: 0.08 }
const ACCENTS = [
  { id: 'sephardi', label: 'Sephardi' },
  { id: 'ashkenazi', label: 'Ashkenazi' },
]

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    return { accents: saved.accents ?? ['sephardi', 'ashkenazi'], voices: saved.voices ?? ['ash', 'cedar'] }
  } catch {
    return { accents: ['sephardi', 'ashkenazi'], voices: ['ash', 'cedar'] }
  }
}

const cellKey = (verseId, variantId, voice) => `${verseId}|${variantId}|${voice}`

function estimateCost(verse, variant) {
  const words = verse.text.split(/\s+/).length
  const seconds = words * (variant.id === 'seph-slow' ? 1.6 : 1)
  return (seconds / 60) * COST_PER_MIN[variant.engine]
}

async function request(url, options) {
  const response = await fetch(url, options)
  let data = null
  try { data = await response.json() } catch { /* non-JSON error page */ }
  if (!response.ok) throw new Error(data?.error ?? `Server error (${response.status}).`)
  return data
}

export default function VoiceLab() {
  const [clips, setClips] = useState([])
  const [settings, setSettings] = useState(loadSettings)
  const [busy, setBusy] = useState({})            // { [cellKey]: true } while generating
  const [run, setRun] = useState(null)            // { done, total, failed } for Generate missing
  const [selected, setSelected] = useState({})    // { [cellKey]: clip id } take shown with its rating
  const [playingId, setPlayingId] = useState(null)
  const [openText, setOpenText] = useState({})    // { [verseId|variantId]: true } shows the text sent
  const [error, setError] = useState('')
  const audioRef = useRef(null)

  useEffect(() => {
    request('/dev/voice-library')
      .then(m => setClips(m.clips))
      .catch(e => setError(`Couldn't load the voice library: ${e.message}`))
    return () => audioRef.current?.pause()
  }, [])

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* storage unavailable */ }
  }, [settings])

  const variants = SPEECH_VARIANTS.filter(v => settings.accents.includes(v.accent))
  const voices = SPEECH_VOICES.filter(v => settings.voices.includes(v))

  const takesFor = (verseId, variantId, voice) =>
    clips.filter(c => c.verseId === verseId && c.variantId === variantId && c.voice === voice).sort((a, b) => a.take - b.take)

  function toggle(list, item) {
    return list.includes(item) ? list.filter(x => x !== item) : [...list, item]
  }

  async function generate(verse, variant, voice) {
    const key = cellKey(verse.id, variant.id, voice)
    setBusy(b => ({ ...b, [key]: true }))
    try {
      const clip = await request('/dev/voice-library/clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verseId: verse.id, variantId: variant.id, voice }),
      })
      setClips(cs => [...cs, clip])
      setSelected(s => ({ ...s, [key]: clip.id }))
      return clip
    } finally {
      setBusy(b => { const rest = { ...b }; delete rest[key]; return rest })
    }
  }

  const missing = voiceLabVerses.flatMap(verse => variants.flatMap(variant => voices
    .filter(voice => takesFor(verse.id, variant.id, voice).length === 0)
    .map(voice => ({ verse, variant, voice }))))
  const missingCost = missing.reduce((sum, m) => sum + estimateCost(m.verse, m.variant), 0)

  async function generateMissing() {
    setError('')
    const queue = [...missing]
    const total = queue.length
    let done = 0, failed = 0, lastError = ''
    setRun({ done, total, failed })
    const worker = async () => {
      while (queue.length > 0) {
        const { verse, variant, voice } = queue.shift()
        try { await generate(verse, variant, voice) } catch (e) { failed++; lastError = e.message }
        done++
        setRun({ done, total, failed })
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    if (lastError) setError(`${failed} reading${failed === 1 ? '' : 's'} failed. Last error: ${lastError}`)
  }

  async function generateOne(verse, variant, voice) {
    setError('')
    try { await generate(verse, variant, voice) } catch (e) { setError(e.message) }
  }

  function play(clip) {
    audioRef.current?.pause()
    if (playingId === clip.id) { setPlayingId(null); return }
    const audio = new Audio(`/dev/voice-library/files/${clip.file}`)
    audio.onended = () => setPlayingId(id => (id === clip.id ? null : id))
    audio.onerror = () => { setPlayingId(null); setError(`Couldn't play ${clip.file}.`) }
    audioRef.current = audio
    setPlayingId(clip.id)
    setSelected(s => ({ ...s, [cellKey(clip.verseId, clip.variantId, clip.voice)]: clip.id }))
    audio.play().catch(e => { setPlayingId(null); setError(e.message) })
  }

  async function updateClip(clip, change) {
    setClips(cs => cs.map(c => (c.id === clip.id ? { ...c, ...change } : c)))
    try {
      await request(`/dev/voice-library/clips/${clip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(change),
      })
    } catch (e) {
      setError(`Couldn't save: ${e.message}`)
    }
  }

  // Scoreboard: ratings per variant and voice, over every take
  function tally(variantId, voice) {
    const rated = clips.filter(c => c.variantId === variantId && (!voice || c.voice === voice))
    return { good: rated.filter(c => c.rating === 'good').length, bad: rated.filter(c => c.rating === 'bad').length, takes: rated.length }
  }
  const generating = run && run.done < run.total

  function cell(verse, variant, voice) {
    const key = cellKey(verse.id, variant.id, voice)
    const takes = takesFor(verse.id, variant.id, voice)
    const current = takes.find(t => t.id === selected[key]) ?? takes[takes.length - 1]
    return (
      <div key={voice} className="vl-cell">
        <span className="vl-voice">{voice}</span>
        <div className="vl-takes">
          {takes.map(t => (
            <button
              key={t.id}
              className={`dev-role-btn vl-take ${t.id === current?.id ? 'vl-take--current' : ''} ${t.rating ? `vl-take--${t.rating}` : ''}`}
              onClick={() => play(t)}
              title={`Take ${t.take}${t.note ? ` — ${t.note}` : ''}`}
            >
              {playingId === t.id ? '■' : '▶'} {t.take}
            </button>
          ))}
          <button
            className="dev-role-btn"
            onClick={() => generateOne(verse, variant, voice)}
            disabled={busy[key]}
            title={takes.length ? 'Generate another take' : 'Generate this reading'}
          >
            {busy[key] ? '…' : takes.length ? '+' : 'Generate'}
          </button>
        </div>
        {current && (
          <div className="vl-rate">
            <button
              className={`dev-role-btn ${current.rating === 'good' ? 'vl-rate--good' : ''}`}
              onClick={() => updateClip(current, { rating: current.rating === 'good' ? null : 'good' })}
              title="Good reading"
            >
              👍
            </button>
            <button
              className={`dev-role-btn ${current.rating === 'bad' ? 'vl-rate--bad' : ''}`}
              onClick={() => updateClip(current, { rating: current.rating === 'bad' ? null : 'bad' })}
              title="Has mistakes"
            >
              👎
            </button>
            <input
              key={current.id}
              className="vl-note"
              defaultValue={current.note}
              placeholder={`Note on take ${current.take}`}
              onBlur={e => { if (e.target.value !== current.note) updateClip(current, { note: e.target.value }) }}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="tc vl">
      <div className="tc-intro">
        <h2 className="tc-title">Voice lab</h2>
        <p className="tc-text">
          Compare ways of having OpenAI read a verse aloud. Each reading is generated once and saved in{' '}
          <code>voice-library/</code> in the project, so playing it again costs nothing. Rate each take 👍 or 👎
          and add a note about anything wrong. Ratings are saved with the audio, and the scoreboard adds them up.
          The respelled variants send altered text; press <em>text sent</em> to see it.
        </p>
      </div>

      <div className="tc-summary">
        <div className="vl-filters">
          <span className="tc-muted">Accent</span>
          {ACCENTS.map(a => (
            <button
              key={a.id}
              className={`dev-role-btn ${settings.accents.includes(a.id) ? 'dev-role-btn--active' : ''}`}
              onClick={() => setSettings(s => ({ ...s, accents: toggle(s.accents, a.id) }))}
            >
              {a.label}
            </button>
          ))}
          <span className="tc-muted vl-filter-gap">Voices</span>
          {SPEECH_VOICES.map(v => (
            <button
              key={v}
              className={`dev-role-btn ${settings.voices.includes(v) ? 'dev-role-btn--active' : ''}`}
              onClick={() => setSettings(s => ({ ...s, voices: toggle(s.voices, v) }))}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="tc-actions">
          {run && (
            <span className="tc-muted vl-run">
              {generating ? `Generating ${run.done}/${run.total}…` : `Generated ${run.total - run.failed}/${run.total}`}
            </span>
          )}
          <button className="dev-role-btn" onClick={generateMissing} disabled={missing.length === 0 || generating}>
            Generate missing ({missing.length}, ≈ ${missingCost.toFixed(2)})
          </button>
        </div>
      </div>

      {error && <p className="tc-error">{error}</p>}

      <section className="tc-group">
        <h3 className="tc-group-title">Scoreboard</h3>
        <div className="tc-item">
          <table className="vl-score">
            <thead>
              <tr>
                <th>Variant</th>
                {voices.map(v => <th key={v}>{v}</th>)}
                <th>All</th>
              </tr>
            </thead>
            <tbody>
              {variants.map(variant => (
                <tr key={variant.id}>
                  <td>
                    <span className="vl-accent">{variant.accent === 'sephardi' ? 'S' : 'A'}</span> {variant.label}
                    <div className="vl-about">{variant.about}</div>
                  </td>
                  {[...voices, null].map(voice => {
                    const t = tally(variant.id, voice)
                    return (
                      <td key={voice ?? 'all'} className="vl-tally">
                        {t.takes === 0 ? <span className="tc-muted">—</span> : (
                          <>
                            <span className="tc-good">{t.good}👍</span> <span className="tc-bad">{t.bad}👎</span>
                            <span className="tc-muted"> /{t.takes}</span>
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {voiceLabVerses.map(verse => (
        <section key={verse.id} className="tc-group">
          <h3 className="tc-group-title">{verse.book}</h3>
          <div className="tc-item">
            <div className="tc-verse" dir="rtl" lang="he">{verse.text.replaceAll('־', '־\u2060')}</div>
            <div className="tc-notes">Covers: {verse.covers}</div>
            {ACCENTS.filter(a => settings.accents.includes(a.id)).map(accent => (
              <div key={accent.id} className="vl-accent-group">
                <div className="vl-accent-title">{accent.label}</div>
                {variants.filter(v => v.accent === accent.id).map(variant => {
                  const textKey = `${verse.id}|${variant.id}`
                  return (
                    <div key={variant.id} className="vl-row">
                      <div className="vl-row-label">
                        <span title={variant.about}>{variant.label}</span>
                        {(variant.respell || variant.romanize || variant.guide) && (
                          <button className="vl-link" onClick={() => setOpenText(o => ({ ...o, [textKey]: !o[textKey] }))}>
                            text sent
                          </button>
                        )}
                      </div>
                      <div className="vl-cells">{voices.map(voice => cell(verse, variant, voice))}</div>
                      {openText[textKey] && (
                        variant.romanize ? (
                          <div className="vl-sent">{speechInput(variant, speechSource(variant, verse))}</div>
                        ) : (
                          <div className="tc-verse vl-sent" dir="rtl" lang="he">
                            {speechInput(variant, speechSource(variant, verse)).replaceAll('־', '־\u2060')}
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
