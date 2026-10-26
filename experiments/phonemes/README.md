# Phoneme experiment

Can a phoneme recognizer hear the mistakes the audio transcriber "corrects"?
This replaces "`gpt-audio` writes down the reading, the rules grade the text"
with the approach in the pronunciation-detection brief:

1. **Expected sounds:** the verse's sounds from the rules engine
   (`getExpectedPhonetic`), each tied to its letter.
2. **Phoneme model:** `wav2vec2-xlsr-53-espeak-cv-ft` (ONNX), which labels
   every 20 ms of audio with IPA sounds. It has no vocabulary, so it can't
   prefer a familiar word.
3. **Forced alignment:** CTC Viterbi finds where each expected sound is in the
   recording. Each vowel matches the vowels the rules engine accepts there,
   plus a reduced "uh"; shevas and chataf vowels are optional.
4. **Contrast scores:** each check is the log-likelihood ratio of the best
   alignment as written against the best alignment with one change. Below
   the check's threshold (`FLAG_BELOW` in `lib.mjs`), it's flagged.
   - Consonants: each ש, ב, כ, פ (and Ashkenazic ת without dagesh) against its
     partner (sh↔s, b↔v, k↔kh, p↔f, s↔t). Flagged below 0.
   - Vowels: the accepted vowels against all the others. a↔o and o↔u aren't
     scored against each other, because the model can't separate them.
     Tzere and cholam allow a trailing glide ("ei", "oi"). Flagged below −2.5.
   - Sheva na: said, short (a trace of vowel), or left out (no trace, where
     the letters can cluster). Short and left out are both flagged.
     Sheva nach: silent against a vowel added. Flagged below −2.5.

Everything runs locally with no API calls. A verse takes about 2 s on an M2.

## Setup

```sh
cd experiments/phonemes
npm install
mkdir -p models && for f in config.json preprocessor_config.json vocab.json onnx/model.onnx; do
  curl -sL -o models/$(basename $f) https://huggingface.co/qnighy/wav2vec2-xlsr-53-espeak-cv-ft-ONNX/resolve/main/$f
done   # model.onnx is 1.26 GB
```

`models/`, `data/` and `results/` are git-ignored. Recordings stay local.

## Runs

- `node make-pairs.mjs && node run-pairs.mjs`: the macOS Hebrew voice
  (Carmit) reads each word in `pairs.mjs` correctly and with one wrong sound.
- `node run-verses.mjs tester`: tester recordings in `data/attempts/`
  (download them from the Vercel Blob store `tanakh-attempts`, prefix
  `attempts/`).
- `node run-verses.mjs`: those plus the 163 Listen clips in `voice-library/`
  (correct text, generated voices), to count false flags.

## Test bench

`node bench/server.mjs`, then open http://127.0.0.1:8790. Each item in
`bench/items.mjs` is recorded twice: as written, and with a stated mistake.
The page shows at once what was flagged, and whether that's what should have
happened. Takes are saved, labelled, in `data/bench/` (`results.json` has the
latest result for each). Round 1 came from the app's verses; round 2 is chosen
for coverage (each letter pair in every position, the vowel contrasts, each
kind of sheva). `node rescore-bench.mjs [kind] [--save]` re-scores every
saved take with the current `lib.mjs`.

## Results, 2026-10-26

- **Pairs:** 30 of 30 sorted correctly (15 words × right and wrong).
  Opening silence matters: clips starting at 0 ms lost an initial b, k or p.
- **Tester recordings (9):** it flagged every mistake `gpt-audio` wrote as
  correct ("yishrael" in both Shema takes, "umivet", "abicha", "aser", a
  repeated "vayomer"). Listening confirmed each flagged mistake was real.
- **Listen clips:** shin/sin had 1 false flag in 251. Most other flags were
  real deviations by the generated voices (בִנְיָמִן, בְאַפִּי and בֹאוּ said
  with "b", כֵן as "ken", Ashkenazic ת as "t"). The grading policy is to
  count those as mistakes, since students read the niqqud as printed.

## Bench results, 2026-10-26 (one adult reader, 31 items × 2)

- **Mistakes caught:** 31 of 31, each on the right word and letter.
- **Correct readings:** 31 of 31 with no false flag.
- **One extra flag:** in the "be-re-SHIS" mistake take, the opening בּ also
  scored as "v" (−4.1). The planned mistake (ת) was caught.
- **Close calls:** "Yishrael" in the Az Yashir mistake take was only just
  flagged (−0.6). Lowest scores on correct letters: 0.1 (ךָ in
  וּמִמּוֹלַדְתְּךָ) and 0.8 (פּ in פַּרְעֹה). A threshold of 0 has little
  room either way, so more readers are needed before choosing one.

- **Vowels and sheva (rescored round 1):**
  - Vowels: 3 of 6 mistakes caught (bi-RUCH, BIT, ha-A-rotz, at −3.5 to −4.1).
    1 of 372 correct vowels flagged (a chirik in the "yi-se-ra-EL" take, maybe
    real). The 3 misses are a↔o and o↔u (o-MEN, a-TOH, sha-LUM): the model
    hears all of them as one open "ɑ" or "o", so they aren't scored.
  - Sheva nach with a vowel added: 1 of 1 caught, 0 of 35 false flags.
  - Sheva na (shevas enforced, so it must be heard): the model often gives a
    short sheva no spike of its own, so the score alone mistook "short" for
    "left out". The vowel trace between the two letters now decides: said
    (≥ 0.6), short (some trace, or letters that can't run together, like
    לְךָ), or left out (no trace, letters that can cluster, like "shma"). On
    round 1: SHMA caught as left out, and 7 flags on readings meant to be
    correct. Listening confirmed all 7 were real ("breishit", "vah" for
    וְהַ, a cut-short לְךָ). After a sheva nach (וּמִמּוֹלַדְתְּךָ) it's never
    "left out", only short: that letter opens its own syllable, and a hard
    t's release sounds like a vowel. The deliberate "l-CHA" and "mish-p-CHOT"
    takes scored as said; the model heard a clear vowel, as expected for
    letters that can't run together.
  - The כֵן mistake take is no longer caught. That take has the phrase twice,
    right then wrong, and the alignment picks the right one.

## Bench round 2, 2026-10-26 (a child, except the last two verses: the user)

Coverage items. Takes now score: mistakes caught 32/38, correct readings with
no false flag 37/38.

- **Consonants:** every single-word mistake caught (19/19, child). In the
  Gen 12:2 verse (adult) the ש and ב mistakes were missed.
- **Vowels:** caught MIN, AM, HI, LE, e-NI, a-lo-KIM, MA-lech. Missed ETZ
  (−1.4; the model wasn't confident about the child's vowel) and the blind
  pairs (LU, o-TA). Cutoff moved to −2.2 (correct vowels reach −2.0).
- **Sheva na:** 3/3 caught. A mostly-ə sheva now counts as short: every
  deliberate "left out" take that scored as said (l-CHA, mish-p-CHOT, BNEI)
  was ə, and clearly said ones are e.
- **Sheva nach:** 4/4 caught. Flagged in וַאֲבָרֶכְךָ in both Gen 12:2 takes
  (heard "va-ra-che-cha"), which may be a real mistake.
- **Gen 1:1 takes lost their opening** (the reader started before the
  recorder), giving 3 false flags in בְּרֵאשִׁית. The page now shows "Stop —
  read now" only once the recorder has started.
- **Passing isn't hearing:** a check compares the written sound with its
  rival, so a faint sound with no rival heard passes (child takes of אַף and
  סֵפֶר with no f heard). Children may need a "couldn't hear it clearly" result.

Not yet covered: more readers, and a vowel model that can separate a/o and o/u.
