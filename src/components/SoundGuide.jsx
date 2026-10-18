// The sound key used in feedback ("ee" as in "see"), as a collapsible guide
// shown with the results. See utils/soundGuide.js.

import { SOUND_GUIDE } from '../utils/soundGuide'

function GuideRows({ items }) {
  return items.map(({ say, asIn }) => (
    <div key={say} className="sound-guide-row">
      <span className="sound-guide-say">{say}</span>
      <span className="sound-guide-as-in">{asIn}</span>
    </div>
  ))
}

export default function SoundGuide() {
  return (
    <details className="sound-guide">
      <summary>Sound guide — how the sounds in the feedback are spelled</summary>
      <div className="sound-guide-body">
        <div className="sound-guide-col">
          <h5 className="sound-guide-title">Vowels</h5>
          <GuideRows items={SOUND_GUIDE.vowels} />
        </div>
        <div className="sound-guide-col">
          <h5 className="sound-guide-title">Letters</h5>
          <GuideRows items={SOUND_GUIDE.consonants} />
        </div>
      </div>
    </details>
  )
}
