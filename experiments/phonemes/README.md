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

Other models for `compare-models.mjs` (see `MODELS` in `lib.mjs`): the xlsr
`onnx/model_fp16.onnx` and `onnx/model_q4.onnx` from the same repo,
`onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX` into `models/lv60/`, and
`anyspeech/zipa-small-crctc-500k` / `anyspeech/zipa-large-crctc-500k`
(`model.onnx`, `model.int8.onnx`, `tokens.txt`) into `models/zipa-s/` and
`models/zipa-l/`.

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
saved take with the current `lib.mjs`. Round 3 is recorded per reader
(adult, child): o vs u in every spelling, and Shema read the way students
really read (pauses, "um", repeats, a restart, fast, quiet, far away, noise,
a skipped word, a wrong word).

## Compare: the two graders on testers' attempts

With the bench running, open http://127.0.0.1:8790/compare. Enter the app's
address and the review password, and click "Fetch new attempts": new tester
attempts are downloaded through the app's Review API into `data/attempts/`
(the password is passed on to the app, never saved), and each is graded
twice: by the production grader (the saved gpt-audio transcription through
the rules engine) and by the phoneme scorer (the recording). The page shows,
word by word, where they disagree, with the recording; the verdicts you click
("Current grader right", "Phoneme scorer right", ...) are saved to
`data/compare-verdicts.json`. "Re-score all" grades every saved attempt again,
after a scorer change, without downloading anything.

### First comparison, 2026-10-27 (9 tester attempts, 21 disagreeing words)

The user's verdicts: phoneme scorer right 12, current grader right 6, both 2,
neither 1. The current grader's 6 showed two gaps, now fixed:
- **A dropped final ־ךָ** ("lekh" for לְךָ, "avikh" for אָבִיךָ, an Ashkenazic
  take): new `vowel-missing` check for that ending only (−4.5; 2 of 33
  correctly said endings on the bench score below).
- **לֶךְ־ heard "lach"** 3 times: a segol right before "ch" accepts "a" (the
  sound pulls it; "al" for אֶל־ is still caught). The wrong-word check
  compares each word's usual sounds, so this doesn't hide "gadol" for אֶחָד.

After the fixes the phoneme scorer matches 19 of the 20 verdicts (it was 14);
the one left is a borderline "v" in one take of וּמִבֵּית. The fixes were made
on these same attempts, so new attempts are the real test.

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

## Model comparison, 2026-10-26

`PHONEME_MODEL=<name> node compare-models.mjs` scores every bench take (rounds
1–2) with one model. AUC is how well a check's scores separate the planned
mistakes from correct readings (1 = perfectly, 0.5 = chance). "Caught" and
"false" use the cutoffs tuned on xlsr. Speed is on an M2: a 10 s verse with
one thread, and peak memory of the whole Node process.

| Model | Size | Letters AUC | Vowels AUC | Sheva na caught | Sheva nach AUC | a/o, o/u AUC | 10 s verse, 1 thread | Peak memory |
|---|---|---|---|---|---|---|---|---|
| xlsr (current) | 1.26 GB | 0.995 | **0.985** | **6/6** | 0.996 | 0.81 | 4.6 s | 1.5 GB |
| xlsr fp16 | 632 MB | 0.994 | 0.984 | 6/6 | 0.992 | 0.81 | slower | 1.4 GB |
| xlsr q4 | 241 MB | 0.993 | 0.967 | 5/6 | 0.988 | 0.79 | 4.9 s | 0.6–0.7 GB |
| lv-60 | 1.26 GB | 0.990 | 0.947 | 4/6 | 0.969 | 0.67 | — | 1.6 GB |
| ZIPA small | 260 MB | **0.997** | 0.949 | 2/6 | **1.000** | 0.80 | 0.36 s | 0.6 GB |
| ZIPA small int8 | 71 MB | 0.994 | 0.950 | 2/6 | **1.000** | 0.81 | **0.24 s** | **0.35 GB** |
| ZIPA large | 1.2 GB | 0.985 | 0.935 | 3/6 | 0.992 | 0.78 | — | 1.4 GB |

Tuned per model (cutoffs in `lib.mjs`), counting the sheva na flags the user
confirmed by ear as real:

| | Letters | Vowels | Sheva na | Sheva nach |
|---|---|---|---|---|
| xlsr | 56/58 caught, 2/218 false | **10/13**, 2/571 false | **13/13**, 4/43 false* | 6/6, 0/50 false |
| ZIPA small int8 | 56/58, 2/218 | 7/13, 7/571 | 10/13, 1/43 | 6/6, 1/50 |

\* three are "short" shevas in fluent adult verse takes, not yet checked by
ear; one is the Gen 1:1 take that lost its opening.

- None of them separates a/o or o/u reliably.
- ZIPA is ~15–20× faster and the int8 version fits in 512 MB, but it's
  weaker on vowels, and its sheva na results use cutoffs tuned for xlsr.
- ZIPA needs Kaldi log-mel features (`fbank.mjs`), which match lhotse's to
  0.0001 per value.

## Bench round 3, 2026-10-27 (adult and child; the child's takes had background noise throughout, and a lisp on shin/sin)

- **O vs u works** once the readings are unambiguous ("YOOM", not "yum"):
  the model hears it, and it now has its own check (`vowel-ou`, cutoff −1).
  Adult: 12/13 caught, 13/13 correct takes clean (AUC 0.996 over all takes).
  Child: 6/13 caught, 11/13 clean. Not scored in two unstressed spots readers
  soften: the prefix וּ, and the final וּ of ־ֵינוּ (אֱלֹהֵינוּ).
- **Skipped words** are flagged once ("left out"), and their sounds aren't
  graded: the verse fits far better without the word (−47 for both skipped
  takes; read words go down to −28). Cutoff −35.
- **Words** (built after round 3): optional "junk" between words soaks up
  false starts, "um"s and restarts, at a cost per sound (silence is free;
  `PHONEME_JUNK`, default 2). Then, per word: **skipped** if the verse fits
  far better without it (taken out first, so its sounds aren't squeezed into
  its neighbours); **wrong word** if it fits worse than junk and what was
  heard there differs in at least 90% of its sounds ("gadol" for אֶחָד);
  **unclear** if it fits worse than junk and almost nothing was heard there
  (whispered, cut off). A flagged word's sounds aren't graded. On all takes:
  skipped 2/2, wrong word 2/2; on readings meant to be correct, 1 wrong word
  (a child's garbled "adasinta") and 12 unclear, mostly whispered or cut-off.
- A chataf on א or ע is now required (it's the whole syllable), else the junk
  before the word swallowed e-NI and a-lo-KIM.
- **Restarts:** the child's corrected "Sema… Shema" now passes; the adult's
  still doesn't (the second attempt's "m" wasn't heard, so the first fits
  better).
- **אֱלֹהֵינוּ:** the model heard the tzere as a full "ee" ("Elokinu") in six
  of the adult's Shema takes; the user listened and all six were a clear
  "Elokeinu". So a tzere before a written yod in a longer word accepts "ee";
  in a one-syllable word (בֵּית) "BIT" is still caught.
- **Children:** noise, extra speech in takes and the lisp make the child's
  results much weaker; flags on ש in שְׁמַע/הַשֵּׁם are likely the lisp.

Not yet covered: more readers, and a vowel model that can separate a/o.

## Bench round 4 and the new checks, 2026-10-28 (adult)

Round 4 recorded the mistake types no check covered yet. Built from it, each
tuned on all 304 bench takes (rounds 1–4), then run unseen on the 9 tester
attempts on the Compare page:

| Check | Catches | Mistakes caught | Correct readings flagged |
|---|---|---|---|
| `letter` | a look-alike letter (ד/ר, ב/כ, ה/ח/ת, ו/ז/ן, ס/ם, ג/נ, ט/מ), ח said "h", צ said "z" | 9 of 10 (missed: one ח as "h", −1.8) | 4 of 1096 |
| `syllable` | a syllable or prefix left out ("va-yish-ta-VOO", "sha-MA-yim") | 5 of 6 | 2 in fluent verses (plus 4 in takes cut off at the start) |
| `order` | patach genuvah said after its letter ("ROO-cha") | 3 of 3 | 0 |
| `end-vowel` | a vowel added under a final sheva ("A-ta" for אַתְּ, "LE-cheh" for לֵךְ) | 2 of 2 | 0 of 19 |
| `ending` | ־ָיו said "-ai-yoo" | 2 of 2 | 0 |

- **Letter:** each letter is tested only against the letters it looks like
  and the English-speaker swaps. Testing it against every other consonant
  flagged 73 correct sounds: the model often hears a quick ל, ר or י as
  something else. Also left out:
  - ך against ר: the model hears a correct "ch" as a throaty Israeli "r"
    (a tester's מֵאַרְצְךָ).
  - **צ said "s"**: the model hears a correct "tz" as "s" too, in 9 of 12
    correct readings.
- **ח and ה** are now told apart: ח no longer accepts a plain "h", and ה no
  longer accepts the throaty ħ. A soft כ heard as "h" still passes.
- **Syllable**, cutoff −6.5:
  - A syllable counts as said if its vowel is there; a quiet letter doesn't
    make it missing.
  - Not judged where it runs into a vowel before it (א, ע, ה, a prefix וּ,
    or a yod right after a vowel). There "ha-A-retz" is said "haaretz", and
    one vowel is heard either way. So "A-retz" for לָאָרֶץ isn't caught.
  - Taken out before anything else is scored, like a skipped word.
- **End vowel:**
  - Flagged when a full vowel (not a reduced "uh") of ≥ 0.6 is heard within
    0.3 s of the word's last letter.
  - Only on a written final sheva (ךְ, תְּ). On every last letter it flagged
    11 correct takes, and the user listened to all of them. They were:
    - background noise at the end of the children's takes
    - an adult's full "m" released (קוּם, יוֹם), which sounds almost like "muh"

    Those blips look just like the real "-a": one frame each, and no quieter.
  - Not judged before a word starting with a vowel or ה.
  - Comparing alignments missed it: the junk after the word soaked up the
    added vowel cheaply.
- **Final הּ (mappik)** isn't graded. It's a breath the model barely hears
  (2–8% "h" when said, 0.3% when dropped), so a dropped one can't be told
  from a quiet one.
- **No change elsewhere:** the old checks' flags on correct readings went
  from 12 to 11 (vowel) and 17 to 15 (sheva-na).
- **On the testers' attempts**, the only new flag is a real one: "mimoladekh"
  for וּמִמּוֹלַדְתְּךָ, flagged once as "te" left out. Before, it got three
  flags.
