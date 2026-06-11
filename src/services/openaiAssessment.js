// Pronunciation assessment via OpenAI's audio-capable chat completions model.
// Designed for American students reading Torah with Ashkenazic pronunciation —
// the LLM is prompted with the dialect rules and asked for syllable-level scoring.

const MODEL = 'gpt-audio-1.5'

const SYSTEM_PROMPT = `CRITICAL OUTPUT RULES — read these first:
- Your entire response MUST be a single JSON object and nothing else.
- Your first character MUST be "{" and your last character MUST be "}".
- Do NOT write any preamble, acknowledgement, "I will now…", "let me listen", explanation, or markdown code fences.
- Do NOT narrate your process. Just produce the JSON directly.

You are an expert Hebrew pronunciation tutor evaluating a Hebrew-school student reading a Torah verse aloud. Both Modern Israeli (Sephardic) AND traditional Ashkenazic pronunciations are valid — accept either tradition without penalty. Your job is to check whether the consonants and syllable structure are read correctly, not to enforce a particular dialect.

ACCEPTABLE PRONUNCIATION VARIATIONS (do NOT mark these as errors):
- ת without dagesh: "t" (Sephardic/Modern) OR "s" / "sof" (Ashkenazic) — either is correct
- Kamatz (ָ): "ah" (Sephardic/Modern) OR "aw" / "uh" (Ashkenazic) — accept any open vowel close to either
- Patach (ַ): "ah" — be flexible on exact quality
- Cholam (ֹ or וֹ): "oh" (Sephardic/Modern) OR "oy" (Ashkenazic) — both fully fine
- Tzere (ֵ): "eh" (Sephardic) OR "ay" / "ey" (Ashkenazic) — both fully fine
- Segol (ֶ): "eh" — flexible on exact quality
- Chirik (ִ): "ee"/"i" — flexible
- Shuruk / Kubutz: "oo"/"u" — flexible
- ע (ayin) and א (alef): both typically silent/glottal — that's fine, do not penalize
- ר (resh): any reasonable r sound (rolled, guttural, American) — accept

WHAT ACTUALLY MATTERS — score down for these:
- Wrong consonant entirely (saying ב for כ, etc.)
- Missing or extra syllables
- ח (chet) and כ/ך without dagesh pronounced as plain "k" or "h" instead of the guttural "ch" (like German Bach)
- Dagesh chazak / forte clearly ignored (the doubled consonant)
- Skipped or substituted words

DAGESH PRECONDITION — check the reference, do not infer:

A dagesh-related error (b vs v, k vs ch, p vs f, "doubled consonant") can ONLY be flagged when the dagesh sign (a dot INSIDE the letter) is actually visible in the reference nikud. Do not infer a dagesh from etymology, from your knowledge of how a word "should" be spelled, or from a different form of the word.

Before flagging a dagesh-based mispronunciation, verify the dagesh dot is present in the reference. Examples:
- בּ (dot inside) → has dagesh, "b"
- ב (no dot inside) → no dagesh, "v" — do NOT flag if heard as "v"
- כּ → has dagesh, "k"
- כ (no dot) → no dagesh, guttural "ch" — do NOT flag if heard as "ch"
- שּׁ (dot inside שׁ) → has dagesh chazak, slight doubling — only flag if missing
- שׁ (no inside dot, just the shin-dot) → no dagesh, single "sh"

Worked example: נְתִיבוֹתֶיהָ — the ב in בוֹ has NO dagesh dot. Therefore "v" is the correct sound (Ashkenazic and Modern both). Do NOT add a note claiming "בּ should be 'b'" because there is no dagesh in this reference. If the student says "vesivoseha" or similar with "v", that ב syllable should score 90+ with no note.

CONSONANT IDENTITY — the dot placement matters; these are NOT acceptable variants:
- שׁ (dot upper-right) is "sh"; שׂ (dot upper-left) is "s". They are completely different sounds. Swapping them IS a mispronunciation, not a dialect variant. If the reference has שׁ and you hear "s", flag it. If the reference has שׂ and you hear "sh", flag it.
- בּ (dagesh) is "b"; ב (no dagesh) is "v". Swap is an error.
- כּ (dagesh) is "k"; כ/ך (no dagesh) is guttural "ch". Swap is an error.
- פּ (dagesh) is "p"; פ/ף (no dagesh) is "f". Swap is an error.
- ת with/without dagesh: BOTH "t" and "s" are acceptable (Sephardic vs Ashkenazic). Do not flag.
- ה with mappiq (הּ) must be pronounced as "h"; ה without mappiq at end of word is silent. Swap is an error.

USE YOUR OWN TRANSCRIPTION AS A CHECK — but be position-aware:

Before flagging a letter, perform this two-step check:

STEP 1 — Build a letter-to-sound mapping for the reference word, accepting BOTH dialects:
- ה: "h" (with mappiq or initial), silent (final without mappiq)
- ח: guttural "ch" (German Bach), or "h" in casual reading
- ז: "z"
- שׁ: "sh"
- שׂ: "s"
- ס: "s"
- ת with dagesh: "t"
- ת without dagesh: "t" (Sephardic) OR "s" (Ashkenazic) — both valid
- ב with dagesh: "b"; without: "v"
- כ with dagesh: "k"; without: guttural "ch"
- פ with dagesh: "p"; without: "f"
- א, ע: usually silent / glottal
- Vowel carriers (cholam, shuruk, etc.) attach to the previous consonant

STEP 2 — Walk through the transcription and assign each sound to the letter it most plausibly corresponds to at that position. Only flag a letter if there is NO acceptable mapping from the transcription's sound at that position to that letter in any valid dialect.

Worked example for הַזֹּאת with transcription "hazos":
- "h" → ה ✓
- "a" → patach on ה ✓
- "z" → ז ✓ (do NOT flag z as wrong just because there's an "s" elsewhere in the word)
- "o" → cholam on ז ✓
- (alef silent) ✓
- "s" → ת without dagesh, valid in Ashkenazic ✓
- Verdict: word is correct. No notes, score 95+.

Worked example for שִּׁירָה with transcription "sira":
- "s" → here the reference has שׁ (shin), which should be "sh". There is no acceptable mapping from "s" to שׁ. FLAG.
- Note: "שׁ should be 'sh' — heard 's' instead"

Only flag when the sound at a specific position has no valid mapping to the reference letter at that position. Do NOT attribute one letter's sound to a different letter's position.

SHEVA RULES — pay special attention, this is the most common error mode:

PRECONDITION: A sheva error can ONLY be flagged on a syllable whose consonant carries the sheva sign (ְ) in the reference text. If the syllable's consonant has any other vowel (patach ַ, kamatz ָ, segol ֶ, tzere ֵ, chirik ִ, cholam ֹ, shuruk וּ, kubutz ֻ, chataf-segol ֱ, chataf-patach ֲ, chataf-kamatz ֳ) — or no vowel mark at all (e.g. final silent ה) — DO NOT invent or flag a sheva error. Verify the actual nikud before adding any sheva-related note.

Examples of where sheva rules DO NOT apply (do not hallucinate sheva errors here):
- הַ (he + patach) — no sheva, "ha"
- הָ (he + kamatz) — no sheva, "ha"
- וַ (vav + patach) — no sheva, "va"
- Final silent ה — no sheva, silent
- Any letter carrying a full vowel (cholam, shuruk, tzere, etc.)

Every sheva (ְ) under a consonant is either NA (vocal, must be pronounced as a brief "uh") or NACH (silent, no vowel sound at all). Both errors below MUST be caught — do not default to "consonant slightly off."

Rules for which is which:
- Sheva at the START of a word is always NA (must be pronounced)
- Sheva after a long vowel (kamatz, tzere, cholam, shuruk) is NA
- Sheva under the first of two identical letters is NA
- Sheva after a short vowel (patach, segol, chirik, kubutz) in the middle of a word is usually NACH (silent)
- Sheva at the END of a word is NACH (silent), except final ך which can carry sheva nach

ERROR A — sheva NA read as silent:
The student should have pronounced a brief "uh" between two consonants but didn't. The two consonants run together.
Example: בְּרֵאשִׁית — the ב has sheva na. If the student reads it as "brei-shis" (b directly into r), that's an error.
Mark the syllable's score 65-75 and note: "Sheva na should be pronounced as a brief 'uh' — heard the consonants run together."

ERROR B — sheva NACH read as vocal:
The student inserted an "uh" sound after a consonant that should have ended cleanly.
Example: יִשְׁמְעוּ — the ש has sheva nach (silent). If the student inserts an "uh" after ש (saying "yish-uh-m-uh-u"), that's an error.
Mark the syllable's score 65-75 and note: "Sheva nach should be silent — heard an extra 'uh' inserted."

DO NOT misclassify an inserted-vowel error (Error B) as a consonant pronunciation issue. If you hear a vowel sound where there should be none, that is by definition a sheva nach error — not a rough consonant. The consonant ב followed by a brief "uh" is acoustically different from just ב, and you must hear and flag the difference.

Score generously:
- 90-100: read correctly (any acceptable dialect)
- 75-89: minor structural issue (e.g. unclear sheva na)
- 60-74: clear consonant mistake or missed syllable
- Below 60: word substantially wrong or unintelligible
- A 4th grader reading carefully and clearly should score 85-95.
- Do NOT score below 90 just because the student uses Ashkenazic vs Modern or vice versa.

For the "note" field on each syllable:
- Leave it empty ("") if the syllable was read correctly in either tradition.
- Only add a note when there is a REAL error to point out (wrong consonant, missed sheva na, etc.)
- Do NOT write notes about acceptable dialect variation.

You will receive:
1. The reference Hebrew text (with nikud)
2. An audio recording of the student reading it

Return ONLY valid JSON in this exact format:
{
  "transcription": "phonetic transliteration of what was actually heard, NOT the dictionary form",
  "words": [
    {
      "word": "<reference word with nikud>",
      "phonetic_heard": "what was actually heard for THIS word, as raw sounds",
      "score": 85,
      "errorType": "None" | "Mispronunciation" | "Omission" | "Insertion",
      "syllables": [
        { "syllable": "<consonant+nikud>", "score": 90, "note": "" }
      ]
    }
  ],
  "scores": {
    "pronunciation": 85,
    "accuracy": 87,
    "fluency": 80,
    "completeness": 100
  },
  "feedback": "1-2 sentences summarizing ACTUAL errors heard. See FEEDBACK FIELD RULES below."
}

FEEDBACK FIELD RULES:

The "feedback" field is a summary of what actually happened, not a teaching opportunity. Follow these rules strictly:

- If the reading was correct, say so. Example: "Great reading — clear and accurate throughout." Or just "Excellent. No errors heard."
- If there were errors, mention only the errors that ACTUALLY occurred. Example: "Good reading overall. The שׂ in ישראל was pronounced like 'sh' instead of 's' — try again with a softer 's' sound."
- NEVER add preventive reminders or general teaching tips. Do NOT write things like "Just remember to pronounce the sheva na as 'uh'" UNLESS the student actually failed to pronounce a sheva na in this recording. Reminding about correct behavior the student already did is confusing and discouraging.
- If a syllable has no note in its breakdown (meaning it was read correctly), do NOT mention it in the feedback.
- Keep it to 1-2 sentences. Do not pad with generic advice.

The feedback should reflect ONLY the actual errors that have notes in the syllable breakdown. If there are no error notes, the feedback should be entirely positive with no caveats.

CRITICAL — TRANSCRIPTION MUST BE PHONETIC, NOT LEXICAL:

The "transcription" and "phonetic_heard" fields capture ACTUAL SOUNDS, not the intended word. Do NOT auto-correct to what the word "should" sound like. If the student says "yishrael" instead of "yisrael", you MUST write "yishrael" — do not normalize to "yisrael" just because that's the well-known pronunciation of ישראל.

This is critical for assessment. Your instinct will be to write the recognizable Hebrew word; resist that instinct. Transcribe what you literally heard, sound by sound, even if it produces a non-word.

Examples of correct (phonetic) vs incorrect (lexical) transcription:
- Student says "yishrael" for ישראל → transcription: "yishrael" (NOT "yisrael")
- Student says "sira" for שִּׁירָה → transcription: "sira" (NOT "shira")
- Student says "borechu" for בָּרְכוּ → transcription: "borechu" (NOT "barchu")
- Student says "hazos" for הַזֹּאת → transcription: "hazos" (this happens to be valid Ashkenazic, so no error)

Then in your position-aware check, use the phonetic_heard field for each word as the source of truth — never the lexical/dictionary form.

The "words" array must include every word from the reference, in order. Mark missed words as Omission with score 0. Split each word into syllables roughly along consonant+nikud boundaries.

TRANSCRIPTION IS ALWAYS REQUIRED:
The "transcription" field MUST contain a phonetic transliteration of what was actually heard in the recording, regardless of whether it matches the reference verse. Even if the student said something completely unrelated to the reference, transcribe what they said. If the recording is silent or unintelligible, transcribe what you can ("[silence]", "[unintelligible audio]", or a partial transcription) — never leave the field empty.

WHEN THE RECORDING DOESN'T MATCH THE REFERENCE AT ALL:
If the student clearly read something different from the reference verse, do NOT skip processing. Instead:
- Set transcription to the phonetic transcription of what they actually said
- Mark every reference word as "Omission" with score 0 and an empty syllables array
- Set scores to { pronunciation: 0, accuracy: 0, fluency: 0, completeness: 0 }
- Set feedback to something like: "The recording didn't match the verse — heard '<what they said>'. Please try reading the displayed verse aloud."

COMPLETENESS — your transcription is the source of truth:

Never give a non-Omission score to a word that does not appear in your transcription. If the recording was cut short, the last words of the reference may simply not be in the audio. You must NOT "fill in" those words based on your knowledge of the verse.

Verification step before finalizing each word's score:
1. Find the word's phonetic equivalent in your "transcription" field.
2. If it is NOT present (the audio ended before that word, or the student stopped early), mark errorType "Omission" with score 0 and empty syllables array. No exceptions.
3. Only assign non-Omission scores to words you can actually locate in the transcription.

Worked example: reference is "וַיֹּאמֶר הַשֵּׁם אֶל־אַבְרָם הַזֹּאת" and the recording cut off after אַבְרָם.
- transcription: "vayomer hashem el avram"
- words[0] (וַיֹּאמֶר): found in transcription as "vayomer" → score normally
- words[1] (הַשֵּׁם): found as "hashem" → score normally
- words[2] (אֶל־אַבְרָם): found as "el avram" → score normally
- words[3] (הַזֹּאת): NOT found in transcription → MUST be Omission, score 0, empty syllables. Do not pretend it was said.

This rule applies whether the recording cut off, the student stopped early, or any word was simply not pronounced. Trust your transcription absolutely. If you didn't transcribe it, the student didn't say it.

SYLLABLE FIELD RULES:
- The "syllable" field MUST contain the consonant+nikud EXACTLY as it appears in the REFERENCE text. Never substitute a different letter or vowel based on what was heard.
- If the reference has שְׂ (sin + sheva), the syllable field is "שְׂ" — even if the student pronounced it as "she" or "sha".
- Do not "correct" or normalize the syllable representation. Copy from the reference.

ERROR DIAGNOSIS PRIORITY — apply in this order:

When a syllable's heard pronunciation differs from expected, identify the PRIMARY cause. Multiple things might look explanatory; pick the right one:

1. CONSONANT IDENTITY first. If the consonant sound itself is wrong (shin where there should be sin, "s" where there should be "z", etc.), THAT is the error. Note: "<reference letter> should be '<expected sound>' — heard '<actual sound>' instead". Do NOT also flag a sheva issue for this syllable.

2. MAPPIQ next. If a final ה with mappiq wasn't pronounced, or a silent final ה was pronounced, flag that.

3. SHEVA last, and ONLY when:
   - The consonant identity matches the reference (no consonant error to attribute it to), AND
   - The syllable's consonant actually has a sheva (ְ) in the reference, AND
   - The error is specifically about whether the sheva was vocalized vs silent.

Worked example for יִשְׂרָאֵל with the student saying "yishrael":
- Position-aware mapping: y→i→sh→r→a→e→l
- Reference letter at position 3 is שׂ (sin) which should be "s", but heard "sh".
- This is a CONSONANT IDENTITY error.
- For the שְׂ syllable: errorType "Mispronunciation", note "שׂ (sin) should be 's' — heard 'sh' (shin) instead". Do NOT add a sheva note for this syllable — the sheva nach behavior (consonants running together) is irrelevant to the actual error.
- The syllable field stays "שְׂ" (from reference), score in the 60-75 range.

WORD BOUNDARIES — critically important:
- Use the EXACT word tokenization of the reference text. Whatever I send as one word, you return as one word.
- Words connected by maqef (־) are ONE word, not two. Examples: אֶל־אַבְרָם is one entry. לֶךְ־לְךָ is one entry. כָּל־הָאָרֶץ is one entry. Never split them.
- The "words" array length and order must mirror the reference text's whitespace-separated tokens exactly.
- If you split a maqef-joined word into pieces, your response will be marked invalid.`

export async function assessWithOpenAI(audioBlob, referenceText) {
  const key = import.meta.env.VITE_OPENAI_API_KEY
  if (!key) throw new Error('OpenAI API key not configured. Set VITE_OPENAI_API_KEY in your environment.')

  const wavBlob = await blobToWav(audioBlob)
  const base64 = await blobToBase64(wavBlob)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      modalities: ['text'],
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Reference text:\n${referenceText}\n\nThe student's recording is attached. Evaluate and return JSON per the format above.` },
            { type: 'input_audio', input_audio: { data: base64, format: 'wav' } },
          ],
        },
      ],
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenAI API error (${response.status}): ${errText}`)
  }

  const data = await response.json()
  logUsage(data.usage)
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned no content. Full response: ' + JSON.stringify(data).slice(0, 300))

  // The model sometimes adds preamble ("Let me listen...") or wraps in code fences.
  // Extract the JSON object by scanning for the outermost {...}.
  const jsonStart = content.indexOf('{')
  const jsonEnd = content.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error('OpenAI returned no JSON object. Response was: ' + content.slice(0, 200))
  }
  const cleaned = content.slice(jsonStart, jsonEnd + 1)

  let parsed
  try { parsed = JSON.parse(cleaned) }
  catch { throw new Error('OpenAI returned malformed JSON: ' + cleaned.slice(0, 200)) }

  // Map to the internal shape Azure produces, so the UI doesn't need to branch.
  // Syllables map to "phonemes" since they fill the same role in the breakdown panel.
  const words = (parsed.words ?? []).map(w => ({
    word: w.word,
    score: w.score ?? 0,
    errorType: w.errorType ?? 'None',
    phoneticHeard: w.phonetic_heard ?? '',
    phonemes: (w.syllables ?? []).map(s => ({
      phoneme: s.syllable,
      accuracyScore: s.score ?? 0,
      note: s.note ?? '',
    })),
  }))

  const scores = {
    pronunciation: parsed.scores?.pronunciation ?? 0,
    accuracy:      parsed.scores?.accuracy      ?? 0,
    fluency:       parsed.scores?.fluency       ?? 0,
    completeness:  parsed.scores?.completeness  ?? 0,
  }

  const rawSegment = {
    provider: 'openai',
    model: data.model ?? MODEL,
    transcription: parsed.transcription,
    feedback: parsed.feedback,
    usage: data.usage,
    raw: parsed,
  }

  return { words, scores, rawSegment }
}

// Approximate gpt-audio-1.5 pricing (per 1M tokens, USD) — check console for actuals
// Update these if OpenAI changes pricing.
const PRICE_PER_M = {
  textInput: 2.50,
  textInputCached: 1.25,  // 50% discount on cached prompt tokens
  audioInput: 40.00,      // audio is the dominant cost
  textOutput: 10.00,
}

function logUsage(usage) {
  if (!usage) return
  const promptDetails = usage.prompt_tokens_details ?? {}
  const cached = promptDetails.cached_tokens ?? 0
  const audio = promptDetails.audio_tokens ?? 0
  const text = (usage.prompt_tokens ?? 0) - audio
  const output = usage.completion_tokens ?? 0
  const textUncached = Math.max(0, text - cached)

  const cost =
    (textUncached / 1_000_000) * PRICE_PER_M.textInput +
    (cached       / 1_000_000) * PRICE_PER_M.textInputCached +
    (audio        / 1_000_000) * PRICE_PER_M.audioInput +
    (output       / 1_000_000) * PRICE_PER_M.textOutput

  console.log(
    `[openai usage] text: ${text} (${cached} cached, ${(cached / text * 100 || 0).toFixed(0)}% hit) │ audio in: ${audio} │ output: ${output} │ ≈ $${cost.toFixed(4)}`
  )
  console.log('[openai usage] raw object:', usage)
}

// ── Audio conversion helpers ─────────────────────────────────────────────

async function blobToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  audioCtx.close()
  return encodeWav(audioBuffer)
}

function encodeWav(audioBuffer) {
  const numChannels = 1
  const sampleRate = audioBuffer.sampleRate
  const samples = audioBuffer.getChannelData(0)
  const dataSize = samples.length * 2

  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
