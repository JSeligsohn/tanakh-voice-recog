// Alphabetical (aleph-bet) roll-up of a single reading. Walks every graded
// syllable's breakdown ({ consonant, vowel }) and aggregates how many times each
// consonant letter and each vowel was read correctly vs. incorrectly.

// Hebrew aleph-bet order. Final forms fold onto their base letter so e.g. ך and
// כ share one row.
const ALEPH_BET = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י','כ','ל','מ','נ','ס','ע','פ','צ','ק','ר','ש','ת']
const FINAL_FORMS = { 'ך':'כ', 'ם':'מ', 'ן':'נ', 'ף':'פ', 'ץ':'צ' }
const baseLetter = (l) => FINAL_FORMS[l] ?? l
const alephBetIndex = (l) => {
  const idx = ALEPH_BET.indexOf(baseLetter(l))
  return idx === -1 ? ALEPH_BET.length : idx
}

// Display order + labels for vowels, roughly by openness.
const VOWEL_ORDER = ['patah','qamats','hataf-patah','hataf-qamats','segol','tzere','hataf-segol','hiriq','holam','qubuts','shuruk','sheva']
const VOWEL_LABEL = {
  'patah':'Patach', 'qamats':'Kamatz', 'hataf-patah':'Hataf patach', 'hataf-qamats':'Hataf kamatz',
  'segol':'Segol', 'tzere':'Tzere', 'hataf-segol':'Hataf segol', 'hiriq':'Chirik',
  'holam':'Cholam', 'qubuts':'Kubutz', 'shuruk':'Shuruk', 'sheva':'Sheva',
}
// Combining nikud marks, displayed on a dotted-circle carrier (U+25CC) so the
// vowel sign is visible on its own. Shuruk/holam-male are shown on their vav.
const VOWEL_MARK = {
  'sheva':'ְ', 'hataf-segol':'ֱ', 'hataf-patah':'ֲ', 'hataf-qamats':'ֳ',
  'hiriq':'ִ', 'tzere':'ֵ', 'segol':'ֶ', 'patah':'ַ', 'qamats':'ָ',
  'holam':'ֹ', 'qubuts':'ֻ',
}
function vowelGlyph(name) {
  if (name === 'shuruk') return 'וּ'      // וּ
  const mark = VOWEL_MARK[name]
  return mark ? '◌' + mark : ''                 // ◌ + nikud
}
const vowelOrderIndex = (name) => {
  const idx = VOWEL_ORDER.indexOf(name)
  return idx === -1 ? VOWEL_ORDER.length : idx
}

// Tally an array of { key, sound, correct } into Map<key, { sound, correct, total }>.
// One row can cover several sounds (בּ "b" and ב "v", שׁ "sh" and שׂ "s"), so
// `sound` lists each distinct one in order of first appearance, e.g. "v/b".
function tally(items) {
  const map = new Map()
  for (const it of items) {
    const cur = map.get(it.key) ?? { sounds: new Set(), correct: 0, total: 0 }
    if (it.sound) cur.sounds.add(it.sound)
    cur.total += 1
    if (it.correct) cur.correct += 1
    map.set(it.key, cur)
  }
  return new Map([...map].map(([key, { sounds, ...v }]) => [key, { sound: [...sounds].join('/'), ...v }]))
}

// A syllable scores "correct" for the fallback view when its accuracy clears the
// same green threshold used elsewhere in the UI.
const CORRECT_THRESHOLD = 80
// First Hebrew letter char in a syllable display glyph, for alphabetical sorting.
const firstHebrewLetter = (s) => [...(s ?? '')].find(ch => /[א-ת]/.test(ch)) ?? ''

function aggregate(wordResults) {
  const consonants = []
  const vowels = []
  const syllables = []   // fallback when no consonant/vowel breakdown is available
  for (const w of wordResults ?? []) {
    if (w.errorType === 'Omission' || w.errorType === 'Insertion') continue
    for (const syl of w.phonemes ?? []) {
      const b = syl.breakdown
      if (b) {
        // Rules/Manual engine: per-letter breakdown. Silent letters (final ה,
        // silent א/ע, sheva nach) carry a breakdown with no consonant AND no
        // vowel — they make no audible sound, so they're skipped, not counted.
        if (b.consonant) {
          consonants.push({ key: baseLetter(b.consonant.letter), sound: b.consonant.sound, correct: b.consonant.correct })
        }
        if (b.vowel) {
          vowels.push({ key: b.vowel.name, sound: b.vowel.sound, correct: b.vowel.correct })
        }
      } else if (syl.phoneme) {
        // Azure / OpenAI (LLM): no per-letter breakdown — fall back to whole
        // syllables, marked correct by score.
        syllables.push({ key: syl.phoneme, sound: '', correct: (syl.accuracyScore ?? 0) >= CORRECT_THRESHOLD })
      }
    }
  }
  const consonantRows = [...tally(consonants).entries()]
    .map(([letter, v]) => ({ letter, ...v }))
    .sort((a, b) => alephBetIndex(a.letter) - alephBetIndex(b.letter) || a.letter.localeCompare(b.letter))
  const vowelRows = [...tally(vowels).entries()]
    .map(([name, v]) => ({ name, label: VOWEL_LABEL[name] ?? name, ...v }))
    .sort((a, b) => vowelOrderIndex(a.name) - vowelOrderIndex(b.name))
  const syllableRows = [...tally(syllables).entries()]
    .map(([glyph, v]) => ({ glyph, ...v }))
    .sort((a, b) => alephBetIndex(firstHebrewLetter(a.glyph)) - alephBetIndex(firstHebrewLetter(b.glyph))
                 || a.glyph.localeCompare(b.glyph))
  return { consonantRows, vowelRows, syllableRows }
}

function Dots({ correct, total }) {
  return (
    <span className="lb-dots" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`lb-dot ${i < correct ? 'lb-dot--ok' : 'lb-dot--bad'}`} />
      ))}
    </span>
  )
}

function Row({ glyph, glyphClass = '', label, sound, correct, total }) {
  const allCorrect = correct === total
  const pctColor = allCorrect ? '#16a34a' : correct >= Math.ceil(total / 2) ? '#d97706' : '#dc2626'
  return (
    <div className="lb-row">
      {glyph && <span className={`lb-glyph ${glyphClass}`} lang="he">{glyph}</span>}
      {(label || sound) && (
        <span className="lb-label">
          {label}
          {sound && <span className="lb-sound">{sound}</span>}
        </span>
      )}
      <Dots correct={correct} total={total} />
      <span className="lb-count" style={{ color: pctColor }}>{correct}/{total}</span>
    </div>
  )
}

export default function LetterBreakdown({ wordResults }) {
  const { consonantRows, vowelRows, syllableRows } = aggregate(wordResults)

  if (consonantRows.length === 0 && vowelRows.length === 0 && syllableRows.length === 0) {
    return <p className="lb-empty">No per-letter data available for this reading.</p>
  }

  const allRows = [...consonantRows, ...vowelRows, ...syllableRows]
  const totalCorrect = allRows.reduce((s, r) => s + r.correct, 0)
  const totalSounds = allRows.reduce((s, r) => s + r.total, 0)
  const pct = totalSounds ? Math.round((totalCorrect / totalSounds) * 100) : 0
  const pctColor = pct >= 90 ? '#16a34a' : pct >= 75 ? '#d97706' : '#dc2626'

  return (
    <div className="letter-breakdown">
      <div className="lb-summary">
        <span className="lb-summary-score" style={{ color: pctColor }}>
          {totalCorrect}<span className="lb-summary-slash">/{totalSounds}</span>
        </span>
        <span className="lb-summary-label">
          sounds correct <span className="lb-summary-pct" style={{ color: pctColor }}>({pct}%)</span>
        </span>
      </div>

      <p className="lb-legend">
        <span className="lb-dot lb-dot--ok" /> correct
        <span className="lb-dot lb-dot--bad" /> incorrect
        <span className="lb-legend-note">— each dot is one occurrence in this reading</span>
      </p>

      {consonantRows.length > 0 && (
        <div className="lb-section">
          <h4 className="lb-section-title">Letters (aleph-bet order)</h4>
          <div className="lb-grid">
            {consonantRows.map(r => (
              <Row key={r.letter} glyph={r.letter} label="" sound={r.sound}
                   correct={r.correct} total={r.total} />
            ))}
          </div>
        </div>
      )}

      {vowelRows.length > 0 && (
        <div className="lb-section">
          <h4 className="lb-section-title">Vowels</h4>
          <div className="lb-grid">
            {vowelRows.map(r => (
              <Row key={r.name} glyph={vowelGlyph(r.name)} glyphClass="lb-glyph--vowel"
                   label={r.label} sound={r.sound}
                   correct={r.correct} total={r.total} />
            ))}
          </div>
        </div>
      )}

      {syllableRows.length > 0 && (
        <div className="lb-section">
          <h4 className="lb-section-title">Syllables (aleph-bet order)</h4>
          <div className="lb-grid">
            {syllableRows.map(r => (
              <Row key={r.glyph} glyph={r.glyph} label="" sound={r.sound}
                   correct={r.correct} total={r.total} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
