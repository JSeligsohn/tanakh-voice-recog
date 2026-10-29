// The live reader's tracker: follows a reader through the verse as the audio
// comes in, and grades each word once the reader is done with it. No network
// code, so it can move into the browser later; src/server/liveSocket.js feeds
// it from a WebSocket.
//
// Every check (about four a second) runs the phoneme model on the audio from
// a little before the current word (the window: the last two words read, as
// anchors, then the current word) and lines it up two ways:
//   A  the words before · the current word
//   B  the same · the start of the next word
// with junk between words. The current word is done when B fits better than
// A (the reader has started the next word), or when nothing has been heard
// for a moment (a pause after it). It's then graded with the scorer's usual
// checks, on the same alignment. The words before keep it from drifting: on
// its own, a word lined up in a fast reader's run-on audio lost its start.
//
// A word read wrong (or run together with the next, read fast) can hide the
// next word's start, so the reader goes on without the tracker; at the next
// pause, every word heard since is graded together (gradeHeard).
//
// A wrong word stays current: a pause, then another try, is graded again over
// the same window, so the best try counts and a word sounded out in pieces
// ("be-re… shit") can still come out right. With `follow` (the default), a
// reader who goes on to the next word leaves the wrong one red and is
// followed; without it, the reader has to get the word right first.
//
// experiments/phonemes/live-sim.mjs plays the bench's takes through it, and
// live-boundaries.mjs measures the move-on signal.

import { frameLogProbs, align, expectedUnits, junkUnit, scoreContrasts, isFlagged, soundFrames, FLAG_BELOW } from './scorer.js'
import { splitVerseWords } from '../../utils/hebrewRules.js'
import { SpeechLevel, rmsOf } from '../../utils/speechLevel.js'

const RATE = 16000

export const LIVE = {
  // seconds of new audio between checks
  every: 0.25,
  // seconds of audio kept before the window's first word, for its first sound
  lead: 0.25,
  // seconds of silence put before each window: a window that starts on the
  // first sound loses an opening b, k or p (as scoreRecording does)
  pad: 0.4,
  // seconds with nothing heard that end a try
  pause: 0.45,
  // how much better B must fit than A to say the reader is on the next word
  // (bench verses: before the next word starts, 1–4% of checks pass this;
  // 0.2 s into it 48%, 0.3 s 63%, 0.6 s 79%)
  moveOn: 1,
  // seconds on one word after which a pause grades every word heard since
  // (gradeHeard): the reader likely went on without the tracker
  stuck: 1,
  // words already read lined up before the current one
  context: 2,
  // the longest window, in seconds: past it, the words before are dropped
  maxWindow: 8,
  // seconds with nothing heard after which the current word's start moves up
  idle: 1.5,
}

// Checks that don't make a word red live: a sheva na that was only slightly
// heard is the grader's least sure call (half a mistake in the full report);
// and a sound scored within LIVE_MARGIN of its cutoff (0.5: on the bench, 32
// false reds → 25, 28 mistakes missed live → 39; 1: 20 and 47). Live, a word is graded
// on a short stretch of audio, and a call that close goes either way with
// the stretch (a tester's הַשֵּׁם: "s" at −1.86 live, a pass in the full
// report); the full report, the whole reading at once, still makes it.
const LIVE_MARGIN = +(process.env.LIVE_MARGIN ?? 0.5)
const MARGINAL = new Set(['consonant', 'letter', 'letter-any', 'letter-missing', 'swapped', 'vowel', 'vowel-ou', 'vowel-missing', 'sheva-nach', 'order', 'ending'])
const LIVE_LENIENT = f => (f.kind === 'sheva-na' && f.partner === 'short') ||
  (MARGINAL.has(f.kind) && f.llr >= (f.coda ? FLAG_BELOW.vetCoda : FLAG_BELOW[f.kind]) - LIVE_MARGIN)

const junk = () => junkUnit(2)

export class LiveTracker {
  constructor(referenceText, settings = {}, { follow = true } = {}) {
    this.settings = settings
    this.follow = follow
    this.words = splitVerseWords(referenceText)
    this.units = expectedUnits(referenceText, { ...settings, junk: false })
    this.audio = new Float32Array(RATE * 30)
    this.length = 0
    this.current = 0
    // per word: where its audio starts (samples), once known
    this.starts = this.words.map((_, wi) => (wi === 0 ? 0 : null))
    // per word: 'waiting' | 'correct' | 'wrong' | 'skipped', how many tries
    // were wrong, the last grading's flags
    this.state = this.words.map(() => ({ status: 'waiting', wrongTries: 0, flags: [] }))
    // how loud the reader is against the room: a sound much quieter than the
    // voice (a fan, breathing) doesn't keep a pause from counting
    this.level = new SpeechLevel({ above: 0.1 })
    this.checkedTo = 0
    // the last sound already graded, so a pause isn't graded twice; and the
    // last one looked past for words read since (gradeHeard)
    this.gradedTo = 0
    this.heardTo = 0
  }

  get done() { return this.current >= this.words.length }

  get due() { return !this.done && this.length - this.checkedTo >= LIVE.every * RATE }

  // 16 kHz samples in [-1, 1]
  push(samples) {
    if (this.length + samples.length > this.audio.length) {
      const grown = new Float32Array(Math.max(this.audio.length * 2, this.length + samples.length))
      grown.set(this.audio.subarray(0, this.length))
      this.audio = grown
    }
    this.audio.set(samples, this.length)
    this.length += samples.length
    this.level.add(rmsOf(samples))
  }

  recording() { return this.audio.subarray(0, this.length) }

  wordUnits(wi) { return this.units.filter(u => u.wi === wi) }

  // the next word's start, through its first vowel; the rest optional. (A
  // longer start, through the letter after, is slower to fit: on the bench's
  // verses 0.3 s into the next word it fit 18% of the time, against 63%.) But
  // a word starting with a vowel (אֱלֹהֵינוּ, אֶחָד, עַל) goes on to its next
  // letter: a lone "e" fit the "e" of הַשֵּׁם before it, mid-word.
  onsetUnits(wi) {
    const units = this.wordUnits(wi)
    const firstVowel = units.findIndex(u => u.kind === 'v' && !u.optional)
    const firstLetter = units.findIndex(u => u.kind === 'c' && !u.optional)
    const last = firstVowel < 0 ? units.length - 1
      : firstLetter >= 0 && firstLetter < firstVowel ? firstVowel
      : Math.max(firstVowel, units.findIndex((u, k) => k > firstVowel && u.kind === 'c'))
    return units.map((u, k) => (last >= 0 && k > last ? { ...u, optional: true } : u))
  }

  // junk · word · junk · word · … · junk
  lineUp(words, tail = []) {
    const units = [junk()]
    for (const wi of words) units.push(...this.wordUnits(wi), junk())
    if (tail.length) units.push(...tail, junk())
    return units
  }

  // Check the audio so far. Returns events: { type: 'word', wi, status,
  // flags, wrongTries } for a word graded, { type: 'current', wi } when the
  // reader moves on. With `final` (the reader stopped), every word left is
  // graded, as the full scorer grades a verse (a word never read comes out
  // skipped).
  async check({ final = false } = {}) {
    this.checkedTo = this.length
    if (this.done) return []
    const end = this.length
    // the words before, as anchors: the last few read (a skipped one has no audio)
    let before = []
    for (let wi = this.current - 1; wi >= 0 && before.length < LIVE.context; wi--) {
      if (this.state[wi].status !== 'skipped' && this.starts[wi] !== null) before.unshift(wi)
    }
    let from = Math.max(0, (this.starts[before[0] ?? this.current] ?? 0) - LIVE.lead * RATE)
    // a long window (the reader stuck on a word, or lost): the last part only.
    // Not at the end, where the words left are graded over all their audio.
    if (!final && end - from > LIVE.maxWindow * RATE) {
      before = []
      from = Math.max(0, Math.max(this.starts[this.current], end - LIVE.maxWindow * RATE) - LIVE.lead * RATE)
    }
    if (end - from < 0.3 * RATE) return final ? this.skipRest() : []

    const pad = Math.round(LIVE.pad * RATE)
    const window = new Float32Array(pad + end - from)
    window.set(this.audio.subarray(from, end), pad)
    const post = await frameLogProbs(window)
    // what the model hears, less what's no louder than the room
    const heard = soundFrames(post)
    const quiet = this.level.threshold()
    if (quiet !== null) {
      const per = post.frameSeconds * RATE
      for (let t = 0; t < post.T; t++) {
        if (heard[t] && rmsOf(window, Math.round(t * per), Math.min(window.length, Math.round((t + 1) * per))) <= quiet) heard[t] = 0
      }
    }
    const w = {
      post, end, heard,
      toSample: frame => from + Math.round(frame * post.frameSeconds * RATE) - pad,
      toFrame: sample => Math.min(post.T, Math.max(0, Math.round((sample - from + pad) / RATE / post.frameSeconds))),
    }
    // A fast reader can be several words on by now: grade each word they're
    // done with, each after the ones before it
    const events = []
    for (;;) {
      const at = this.current
      events.push(...this.step(w, before, final))
      if (this.done || this.current === at) break
      if (this.state[at].status !== 'skipped') before = [...before, at]
    }
    if (final && !this.done) events.push(...this.gradeRest(w, before))
    return events
  }

  // Is the reader done with the current word? If so grade it (and move on if
  // it's right, or they've gone on). Returns its events.
  step(w, before, final) {
    const { post } = w
    const wi = this.current
    const next = wi + 1 < this.words.length ? wi + 1 : null
    // anything heard since the word began?
    const startFrame = w.toFrame(this.starts[wi] ?? 0)
    let lastSound = -1
    for (let t = post.T - 1; t >= startFrame; t--) if (w.heard[t]) { lastSound = t; break }
    if (lastSound < 0) {
      if (w.end - (this.starts[wi] ?? 0) > LIVE.idle * RATE) this.starts[wi] = w.end - Math.round(LIVE.lead * RATE)
      return []
    }
    const silentFor = (post.T - 1 - lastSound) * post.frameSeconds

    const A = this.lineUp([...before, wi])
    const a = align(post, A)
    // (holding a wrong word, going on doesn't end a try: only a pause does)
    const holding = !this.follow && this.state[wi].status === 'wrong'
    let B = null, b = null, movedOn = false
    if (next !== null && !holding) {
      B = this.lineUp([...before, wi], this.onsetUnits(next))
      b = align(post, B)
      movedOn = b.score - a.score >= LIVE.moveOn
    }
    const paused = silentFor >= LIVE.pause && w.toSample(lastSound) > this.gradedTo
    if (process.env.LIVE_DEBUG) console.log(`    [${(w.end / RATE).toFixed(2)}s] w${wi} after ${before.length}  B−A ${b ? (b.score - a.score).toFixed(1) : '-'}  silent ${silentFor.toFixed(2)}${movedOn ? '  MOVED' : ''}${paused ? '  PAUSED' : ''}`)
    // A pause after a long time on this word, following: grade every word
    // heard since it, together (once per pause, even if this word was graded
    // when the pause began)
    const stuck = silentFor >= LIVE.pause && w.end - (this.starts[wi] ?? 0) > LIVE.stuck * RATE
    if (!movedOn && !final && this.follow && next !== null && stuck && w.toSample(lastSound) > this.heardTo) {
      this.heardTo = w.toSample(lastSound)
      return this.gradeHeard(w, before, lastSound)
    }
    // (at the end, a word not gone on from is graded by gradeRest)
    if (!movedOn && (!paused || final)) return []

    // The try is over: grade the word
    const [units, used] = movedOn ? [B, b] : [A, a]
    const flags = scoreContrasts(post, units, used, { lone: before.length === 0 && !movedOn })
      .filter(f => f.wi === wi && isFlagged(f))
    this.gradedTo = w.toSample(lastSound)
    // a pause before the word was started (after the one before it) isn't a
    // try: only going on past it, or stopping, leaves it out
    if (!movedOn && flags.some(f => f.kind === 'word' && f.test === 'skipped')) return []
    const events = [this.grade(wi, flags)]
    const spansOf = k => units.map((u, i) => (u.wi === k && u.kind !== 'j' ? used.spans[i] : null)).filter(Boolean)
    const mine = spansOf(wi)
    if (mine.length) this.starts[wi] = w.toSample(mine[0][0])

    if (this.state[wi].status === 'correct' || (movedOn && this.follow)) {
      this.current += 1
      if (next !== null) {
        // the next word starts where its first sound was lined up (B), or
        // after this word's last (A)
        const theirs = movedOn ? spansOf(next) : []
        this.starts[next] = theirs.length ? w.toSample(theirs[0][0]) : mine.length ? w.toSample(mine.at(-1)[1]) : w.end
        // its start is already heard: a pause after it grades it
        if (movedOn) this.gradedTo = this.starts[next]
      }
      events.push({ type: 'current', wi: this.current })
    }
    return events
  }

  // At a pause: the reader may be several words on. A fast reader's mistake
  // (or words run together) never shows the next word's start, so the
  // current word was waiting, while the reader went on. The words from here
  // to the end are lined up together, as the full scorer does a verse; those
  // heard are graded, and the reader is followed to the last one heard: past
  // it if it's right, or on it, for another try, if it isn't. Heard: lined up
  // before the last sound. A word not read yet is squeezed into the silence
  // after it (or left out); grading those too made 181 bench words red.
  gradeHeard(w, before, lastSound) {
    const { post } = w
    const wi = this.current
    const rest = this.words.map((_, k) => k).slice(wi)
    const units = this.lineUp([...before, ...rest])
    const flags = scoreContrasts(post, units, undefined, { lone: before.length === 0 && rest.length === 1 }).filter(isFlagged)
    const leftOut = k => flags.some(f => f.wi === k && f.kind === 'word' && f.test === 'skipped')
    this.gradedTo = w.toSample(lastSound)
    // where each word was heard, lined up without the ones left out
    const kept = units.filter(u => u.kind === 'j' || !leftOut(u.wi))
    const { spans } = align(post, kept)
    const spansOf = k => kept.map((u, i) => (u.wi === k && u.kind !== 'j' ? spans[i] : null)).filter(Boolean)
    // (the current word counts if it was started; one after it must be heard
    // whole: before the last sound, and not too unclear to have been said)
    const nothing = k => flags.some(f => f.wi === k && f.kind === 'word' && f.test === 'unclear')
    const heard = rest.filter(k => {
      const sp = spansOf(k)
      if (leftOut(k) || !sp.length) return false
      return k === wi ? sp[0][0] <= lastSound : sp.at(-1)[1] <= lastSound + 1 && !nothing(k)
    })
    // nothing of it heard (a pause before the word was started): not a try
    if (!heard.length) return []
    // the words heard in a row from here (a gap: not read yet, or lost)
    let last = heard[0]
    while (heard.includes(last + 1)) last++
    if (heard[0] !== wi) return []
    const events = []
    for (let k = wi; k <= last; k++) {
      events.push(this.grade(k, flags.filter(f => f.wi === k)))
      const sp = spansOf(k)
      if (sp.length) this.starts[k] = w.toSample(sp[0][0])
    }
    const right = this.state[last].status === 'correct'
    const to = right ? last + 1 : last
    if (to !== this.current) {
      this.current = to
      if (right && to < this.words.length) {
        const sp = spansOf(last)
        this.starts[to] = sp.length ? w.toSample(sp.at(-1)[1]) : w.end
      }
      events.push({ type: 'current', wi: to })
    }
    return events
  }

  // At the end: the words left, lined up together after the words before, as
  // the full scorer does a verse
  gradeRest(w, before) {
    const rest = this.words.map((_, wi) => wi).slice(this.current)
    const units = this.lineUp([...before, ...rest])
    const flags = scoreContrasts(w.post, units, undefined, { lone: before.length === 0 && rest.length === 1 }).filter(isFlagged)
    const events = rest.map(wi => this.grade(wi, flags.filter(f => f.wi === wi)))
    this.current = this.words.length
    events.push({ type: 'current', wi: this.current })
    return events
  }

  // No audio left to grade: the rest wasn't read
  skipRest() {
    const events = this.words.map((_, wi) => wi).slice(this.current)
      .map(wi => this.grade(wi, [{ wi, word: this.words[wi], letter: '', kind: 'word', test: 'skipped', expected: 'said', partner: 'left out', llr: 0 }]))
    this.current = this.words.length
    events.push({ type: 'current', wi: this.current })
    return events
  }

  // The reader goes back to a word (tapping a red one, to read it again):
  // it's current from here on, and the words after it are graded again
  goTo(wi) {
    if (!(wi >= 0 && wi < this.words.length)) return []
    this.current = wi
    this.starts[wi] = this.length
    this.gradedTo = this.length
    return [{ type: 'current', wi }]
  }

  grade(wi, flags) {
    const state = this.state[wi]
    state.flags = flags.map(slimFlag)
    if (flags.some(f => !LIVE_LENIENT(f))) {
      // a word never tried, left out: skipped (a try that came out wrong stays wrong)
      state.status = flags.some(f => f.kind === 'word' && f.test === 'skipped') && state.wrongTries === 0 ? 'skipped' : 'wrong'
      state.wrongTries += 1
    } else {
      state.status = 'correct'
    }
    return { type: 'word', wi, status: state.status, wrongTries: state.wrongTries, flags: state.flags }
  }
}

// What the client needs from a flag (as api/phonemes.js sends it)
const slimFlag = f => ({
  wi: f.wi, atomIndex: f.atomIndex ?? null, word: f.word, letter: f.letter, kind: f.kind, test: f.test,
  ...(f.kind === 'swapped' ? { atomIndex2: f.atomIndex2, letter2: f.letter2 } : {}),
  expected: f.expected, partner: f.partner, heard: f.heardAs?.class ?? null, score: +f.llr.toFixed(2),
})
