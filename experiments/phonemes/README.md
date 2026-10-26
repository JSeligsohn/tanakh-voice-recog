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
   recording. Vowels match any vowel for now, and shevas are optional.
4. **Contrast score:** each ש, ב, כ, פ (and Ashkenazic ת without dagesh) is
   scored against its partner sound (sh↔s, b↔v, k↔kh, p↔f, s↔t). The score is
   the log-likelihood ratio of the best alignment with the written sound
   against the best alignment with the partner. Negative means the partner
   fits better, and the letter is flagged.

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

Not yet covered: vowels, sheva, real students, and children's voices.
