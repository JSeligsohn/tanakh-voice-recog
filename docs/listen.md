# Listen: how the verse reading got here, and what's left

Notes for picking Listen up again. Last worked on 2026-10-21; committed
2026-10-26.

## How we got here

1. **Azure (original).** Word and verse Listen used Azure text-to-speech. The
   Azure key stopped working on 2026-10-14 and we chose not to renew it, so
   Azure Listen is hidden. The code is still there; adding keys brings it back.
2. **OpenAI text-to-speech (`gpt-4o-mini-tts`), 2026-10-14.** Sephardi read
   from the Hebrew with "follow the nikud" instructions sounded good.
   Ashkenazi by instructions failed (it kept "t" for ת without dagesh), so the
   accent had to go into the text itself: `src/utils/hebrewRespell.js`
   rewrites kamatz as cholam and ת without dagesh as ס.
3. **Voice lab, 2026-10-15.** A dev tab (`src/components/VoiceLab.jsx`)
   compared about 10 prompt and spelling variants over 6 verses
   (`src/services/prompts/speechPrompts.js`). The takes are in
   `voice-library/`, with ratings in `manifest.json` and on a shared rating
   page (claude.ai artifact `4ymRy7CoDaK421zNuVKjos`, ratings in its
   database). Results: the best Ashkenazi was respelled Hebrew read in a
   conversational style. Common slips: a final ךָּ read "cha", a silent א
   voiced, אברם read as אברהם, repeated or cut-off words.
4. **English-letter spelling, 2026-10-15.** `src/utils/hebrewRomanize.js`
   builds a romanization from the rules engine, with stress and pauses from
   the trope (verses need a `trope` field). Sephardi in English letters was
   liked; Ashkenazi read kamatz as "oh" instead of "aw", and English letters
   lost the Hebrew accent.
5. **Decision for production, 2026-10-18.** `gpt-audio` reads the Hebrew text
   with the romanization as a pronunciation guide (`LISTEN_READING`, voice
   cedar). The readings are recorded ahead of time by
   `scripts/generate-listen-audio.mjs`, which transcribes each one back and
   re-records it if the words don't match. They live in `public/audio/listen/`,
   indexed by `src/data/listenAudio.json`. That's what production plays today.
   Automatic checks still miss sound slips, such as "samesh" for חָמֵשׁ, so
   every new reading needs a person to listen to it.
6. **ElevenLabs, 2026-10-21 (this commit).** We tried it for a more natural
   voice. The useful findings came from the ElevenLabs website:
   - Hebrew script is fluent but sounds Israeli.
   - With English letters, the "o" for kamatz is read "oh".
   - **IPA in /slashes/ with `eleven_v4` works**: the stress and vowels came
     out right.
   - A vowel straight after another vowel inside a word (the א in מֵאַרְצְךָ)
     made it insert a "ch" or "g", even with ʔ written. Fix: split the word
     into separate /…/ pieces there.
   - It says "kh" for every final ך, even with a dagesh, so a final ךּ is
     respelled as ק.
   - Your own Ashkenazi kamatz is "uh" everywhere (Avrum, huh-UH-retz).

## What this commit does

- `ipa()` in `hebrewRomanize.js`: the verse in IPA with American vowels and r
  (ɑ, eɪ, oʊ, ɹ, so it doesn't sound Israeli), x for "kh", syllable dots, ˈ
  stress from the trope, and the vowel-after-vowel split. Kamatz style is a
  setting: `o`, `aw` or `uh`.
- `api/listen.js`: `GET /api/listen?pasuk=<id>&tradition=…` reads a verse
  with ElevenLabs the first time it's asked for, then serves it from Vercel
  Blob (`listen/…mp3`, private). Only verses in `psukim.js` can be read, never
  free text, which caps the spend. Each new reading is checked the way a
  student's is (transcribed and graded). If a word is marked, the verse is
  read once more and the reading with fewer marked words is kept;
  `listen/…json` records what was marked. A clip's name includes a hash of
  its IPA, voice and model, so changing any of them makes a fresh reading.
- The app: **testers only** (`?tester=`) hear the ElevenLabs reading, with
  the recorded one as a fallback. The Listen button shows "Loading…" while a
  new reading is made (about 10–15 s the first time).
- `hebrewRespell.js`: a final ךּ is respelled as ק in both respellings.
- `api/openai-audio.js` accepts MP3 (`format: 'mp3'`) for that check.
- `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` were added to the dev
  server's server-only variables.

So far, Lech Lecha 12:1 (Ashkenazic) has been read, on 2026-10-21. Two clips
are in Blob.

## What's left

- **Plan and voice.** The free plan blocks library voices through the API
  (402 `paid_plan_required`) and isn't licensed for commercial use. You want
  to try Tomer (`yGpVFXFoImvRvaURKypy`, Hebrew) or Pharoah 4
  (`J2FGlQG8Gd7x8uEDt2H8`, English), which needs the Starter plan. The
  default voice is the stock "Brian", which you found "too typical AI".
- **Listening tests.** Hear the IPA readings across more verses and both
  traditions, and decide whether ElevenLabs replaces the `gpt-audio`
  recordings.
- **Kamatz style.** `KAMATZ = 'uh'` is hard-coded in `api/listen.js`. If it
  stays, it should probably be a user setting (uh / aw / o; Sephardic a).
- **ע.** The vowel-after-vowel split covers א; ע likely needs it too.
- **The automatic check is noisy.** It's the same transcriber that misses
  familiar-word slips (see the phoneme experiment in
  `experiments/phonemes/`). A phoneme-level check would be a better guard for
  new readings.
- **Before pushing:** pushing `main` deploys `api/listen.js` as a public
  function. It only reads listed verses, once each, but it uses the
  ElevenLabs key, so set the key (or leave it unset to keep Listen off) in
  Vercel first.
- **Moving to mekorot.org (Render).** `api/listen.js` is a Vercel function
  with Vercel Blob. On Render it becomes a Flask route, with storage in
  mekorot's own store.
