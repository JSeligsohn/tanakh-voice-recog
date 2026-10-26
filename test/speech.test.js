// Text-to-speech: respelling the verse for an accent, and the server function
// (dev/openai-speech.js) with OpenAI stubbed — the key is attached server-side,
// instructions come from our variants (never the caller), and only pointed
// Hebrew text is accepted.

import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import openaiSpeech from '../dev/openai-speech.js'
import { respellAshkenazi, respellCareful } from '../src/utils/hebrewRespell.js'
import { romanize, ipa } from '../src/utils/hebrewRomanize.js'
import listen from '../api/listen.js'
import { SPEECH_VARIANTS, buildSpeechRequest } from '../src/services/prompts/speechPrompts.js'

test('ashkenazi: kamatz → cholam and tav without dagesh → samekh', () => {
  assert.equal(respellAshkenazi('וּמִבֵּית אָבִיךָ'), 'וּמִבֵּיס אֹבִיךֹ')
  assert.equal(respellAshkenazi('וּמִמּוֹלַדְתְּךָ'), 'וּמִמּוֹלַדְתְּךֹ') // tav with dagesh stays
  assert.equal(respellAshkenazi('טׇהֳרָתוֹ'), 'טֹהֳרֹסוֹ')                // marked kamatz katan too
  assert.equal(respellAshkenazi('אַרְאֶךָּ'), 'אַרְאֶקֹ')                  // final kaf with dagesh → ק
})

test('ashkenazi: ָיו suffix becomes ֹב so it reads "ov", not "oyv" or "o"', () => {
  assert.equal(respellAshkenazi('עָלָיו'), 'עֹלֹב')
  assert.equal(respellAshkenazi('צַוָּארָֽיו'), 'צַוֹּארֹֽב')
  assert.equal(respellAshkenazi('אָחִיו'), 'אֹחִיו') // "ochiv": chirik, not the suffix
})

test('ashkenazi options: tzere → "ey", cholam → "oy", kamatz stays plain "o"', () => {
  assert.equal(respellAshkenazi('הַשֵּׁם', { tzereEy: true }), 'הַשֵּׁים')
  assert.equal(respellAshkenazi('בֵּית', { tzereEy: true }), 'בֵּיס') // already has its yud
  assert.equal(respellAshkenazi('יוֹסֵף', { tzereEy: true, cholamOy: true }), 'יוֹיסֵיף')
  assert.equal(respellAshkenazi('רֹאשׁ', { cholamOy: true }), 'רֹיאשׁ')
  assert.equal(respellAshkenazi('אָבִיךָ', { cholamOy: true }), 'אֹבִיךֹ')
})

test('ashkenazi: maqef and spacing are kept', () => {
  assert.equal(respellAshkenazi('אֶל־הָאָרֶץ אֲשֶׁר'), 'אֶל־הֹאֹרֶץ אֲשֶׁר')
})

test('careful: kamatz katan → cholam, sheva na → chataf segol, the rest untouched', () => {
  assert.equal(respellCareful('וְאֶת־כָּל־רְכוּשָׁם'), 'וֱאֶת־כֹּל־רֱכוּשָׁם')
  assert.equal(respellCareful('בְּיוֹם'), 'בֱּיוֹם')                     // word-initial sheva
  assert.equal(respellCareful('וּמִמּוֹלַדְתְּךָ'), 'וּמִמּוֹלַדְתֱּךָ')  // after a silent sheva
  assert.equal(respellCareful('אַרְצָה'), 'אַרְצָה')                   // sheva nach stays
  assert.equal(respellCareful('אָבִיךָ'), 'אָבִיךָ')                   // kamatz gadol stays
  assert.equal(respellCareful('אַרְאֶךָּ'), 'אַרְאֶקָ')                   // final kaf with dagesh → ק
})

const realFetch = globalThis.fetch
let upstreamCalls

beforeEach(() => {
  upstreamCalls = []
  process.env.OPENAI_API_KEY = 'test-openai-key'
  globalThis.fetch = async (url, init) => {
    upstreamCalls.push({ url, init })
    if (url.endsWith('/audio/speech')) return new Response(new Uint8Array([1, 2, 3]))
    return Response.json({ choices: [{ message: { audio: { data: Buffer.from([4, 5]).toString('base64'), transcript: 'שָׁלוֹם' } } }] })
  }
})
afterEach(() => { globalThis.fetch = realFetch })

const post = body => new Request('http://localhost/api/openai-speech', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})
const valid = { text: 'וּמִבֵּית אָבִיךָ', variant: 'ashk-respell', voice: 'ash' }

test('romanize: syllables, stress from the trope, pauses at major breaks', () => {
  const verse = 'וַיֹּ֤אמֶר הַשֵּׁם֙ אֶל־אַבְרָ֔ם לֶךְ־לְךָ֛ מֵאַרְצְךָ֥ וּמִמּֽוֹלַדְתְּךָ֖ וּמִבֵּ֣ית אָבִ֑יךָ אֶל־הָאָ֖רֶץ אֲשֶׁ֥ר אַרְאֶֽךָּ׃'
  assert.equal(romanize(verse),
    'Va-YO-mer ha-SHEM el av-RAM, lekh le-KHA me-ar-tze-KHA u-mi-mo-lad-te-KHA u-mi-BET a-VI-kha, el ha-A-retz a-SHER ar-E-ka.')
  assert.equal(romanize(verse, { tradition: 'ashkenazic', style: 'acute' }),
    "Vayómer hashém el avróm, lekh lekhó mey'artzekhó umimoladtekhó umibéys ovíkho, el ho'óretz ashér ar'éko.")
})

test('romanize: doubled pashta, silluq, patach genuvah, sheva under dagesh chazak', () => {
  assert.equal(romanize('אֶ֙רֶץ֙'), 'E-retz.')                  // first pashta marks the stress
  assert.equal(romanize('כְּנָֽעַן׃'), 'Ke-NA-an.')              // silluq
  assert.equal(romanize('ר֣וּחַ'), 'RU-akh.')                    // "a" before the ח
  assert.equal(romanize('הַשְּׁבִיעִ֖י'), 'Ha-she-vi-I.')         // not "hash-vi-i"
  assert.equal(romanize('אַחֶ֖יךָ'), 'A-KHE-kha.')               // silent yud
})

test('ipa: American vowels, trope stress, a word split where a vowel follows a vowel', () => {
  const verse = 'וַיֹּ֤אמֶר הַשֵּׁם֙ אֶל־אַבְרָ֔ם לֶךְ־לְךָ֛ מֵאַרְצְךָ֥ וּמִמּֽוֹלַדְתְּךָ֖ וּמִבֵּ֣ית אָבִ֑יךָ אֶל־הָאָ֖רֶץ אֲשֶׁ֥ר אַרְאֶֽךָּ׃'
  assert.equal(ipa(verse, { tradition: 'ashkenazic', kamatz: 'uh' }),
    '/vɑ.ˈjoʊ.mɛɹ hɑ.ˈʃɛm ɛl ɑv.ˈɹʌm/, /lɛx lə.ˈxʌ/ /meɪ/ /ɑɹ.tsə.ˈxʌ/ /u.mi.moʊ.lɑd.tə.ˈxʌ u.mi.ˈbeɪs ʌ.ˈvi.xʌ/, /ɛl hʌ/ /ˈʌ.ɹɛts/ /ɑ.ˈʃɛɹ ɑɹ.ˈɛ.kʌ/.')
  assert.equal(ipa('אֶל־אַבְרָ֔ם', { tradition: 'ashkenazic', kamatz: 'aw' }), '/ɛl ɑv.ˈɹɔm/.')
  assert.equal(ipa('אֶל־אַבְרָ֔ם'), '/ɛl ɑv.ˈɹɑm/.')                        // Sephardic kamatz
  assert.equal(romanize('אַבְרָ֔ם', { tradition: 'ashkenazic', kamatz: 'uh' }), 'Av-RUHM.')
})

test('listen: only known verses and traditions, before any upstream call', async () => {
  process.env.ELEVENLABS_API_KEY = 'test-elevenlabs-key'
  process.env.BLOB_READ_WRITE_TOKEN ??= 'test-blob-token'
  for (const query of ['pasuk=nope&tradition=ashkenazic', 'pasuk=gen-12-1&tradition=klingon', 'tradition=sephardic']) {
    const res = await listen.fetch(new Request(`http://localhost/api/listen?${query}`))
    assert.equal(res.status, 400)
  }
  assert.equal((await listen.fetch(new Request('http://localhost/api/listen', { method: 'POST' }))).status, 405)
  assert.equal(upstreamCalls.length, 0)
})

test('tts: sends the respelled text and the variant instructions with the server key', async () => {
  const res = await openaiSpeech.fetch(post(valid))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Content-Type'), 'audio/mpeg')
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [1, 2, 3])
  assert.equal(upstreamCalls[0].init.headers.Authorization, 'Bearer test-openai-key')
  const sent = JSON.parse(upstreamCalls[0].init.body)
  assert.equal(sent.model, 'gpt-4o-mini-tts')
  assert.equal(sent.input, 'וּמִבֵּיס אֹבִיךֹ')
  assert.equal(sent.instructions, SPEECH_VARIANTS.find(v => v.id === 'ashk-respell').instructions)
})

test('chat: decodes the audio and returns the transcript header', async () => {
  const res = await openaiSpeech.fetch(post({ ...valid, variant: 'ashk-chat' }))
  assert.equal(res.status, 200)
  assert.deepEqual([...new Uint8Array(await res.arrayBuffer())], [4, 5])
  assert.equal(decodeURIComponent(res.headers.get('X-Speech-Transcript')), 'שָׁלוֹם')
  const sent = JSON.parse(upstreamCalls[0].init.body)
  assert.equal(sent.model, 'gpt-audio-1.5')
  assert.equal(sent.messages[1].content, valid.text)
})

test('caller-supplied instructions are ignored', async () => {
  await openaiSpeech.fetch(post({ ...valid, instructions: 'Say something else', messages: ['evil'] }))
  const sent = JSON.stringify(JSON.parse(upstreamCalls[0].init.body))
  assert.ok(!sent.includes('Say something else') && !sent.includes('evil'))
})

for (const [label, body, status] of [
  ['unknown variant', { ...valid, variant: 'bogus' }, 400],
  ['unknown voice', { ...valid, voice: 'darth' }, 400],
  ['non-Hebrew text', { ...valid, text: 'Hello world' }, 400],
  ['missing text', { ...valid, text: '' }, 400],
  ['oversized text', { ...valid, text: 'א'.repeat(1001) }, 400],
]) {
  test(`rejects ${label} without calling OpenAI`, async () => {
    const res = await openaiSpeech.fetch(post(body))
    assert.equal(res.status, status)
    assert.equal(upstreamCalls.length, 0)
  })
}

test('OpenAI errors come back as 502 with the detail', async () => {
  globalThis.fetch = async () => new Response('rate limited', { status: 429 })
  const res = await openaiSpeech.fetch(post(valid))
  assert.equal(res.status, 502)
  assert.match((await res.json()).error, /429.*rate limited/)
})

test('guide variants: Hebrew without trope, the English-letter guide in the instructions', () => {
  const variant = SPEECH_VARIANTS.find(v => v.id === 'ashk-guide-chat')
  const trope = 'וּמִבֵּ֣ית אָבִ֑יךָ'
  const req = buildSpeechRequest(variant, trope, 'cedar')
  assert.equal(req.input, 'וּמִבֵּיס אָבִיךָ') // ת → ס, kamatz kept
  assert.match(req.body.messages[0].content, /American yeshiva\. Pronounce .* Guide: U-mi-BEYS aw-VI-khaw\.$/)
})
