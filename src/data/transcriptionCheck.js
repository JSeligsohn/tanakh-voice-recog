// Items for the dev Transcription check page: words to read aloud in a stated
// way, and the transcription the audio model should produce for that reading.
//
// Each item:
//   id       — stable key for saved recordings/results (don't renumber)
//   word     — Hebrew with nikud, as shown to the reader and sent as reference
//   sayAs    — how to say it; CAPS mark the sound being tested
//   expect   — the transcription we want back (normalized before comparing)
//   accept   — other transcriptions that count as equally right
//   intent   — 'correct' reading, or a deliberate 'error' the model must not fix
//   trad     — tradition the reading belongs to (used to grade the result)
//   group    — section heading on the page

export const checkItems = [
  // ── Vowels ─────────────────────────────────────────────────────────
  { id: 'v-baruch-mod', group: 'Vowels', word: 'בָּרוּךְ', sayAs: 'Modern: "BAH-rookh"', expect: 'baruch', intent: 'correct', trad: 'sephardic' },
  { id: 'v-baruch-ash', group: 'Vowels', word: 'בָּרוּךְ', sayAs: 'Ashkenazic: "BAW-rookh"', expect: 'boruch', accept: ['bawruch'], intent: 'correct', trad: 'ashkenazic' },
  { id: 'v-shalom-mod', group: 'Vowels', word: 'שָׁלוֹם', sayAs: 'Modern: "shah-LOHM"', expect: 'shalom', intent: 'correct', trad: 'sephardic' },
  { id: 'v-shalom-ash', group: 'Vowels', word: 'שָׁלוֹם', sayAs: 'Ashkenazic: "SHAW-LOYM"', expect: 'sholoym', accept: ['sholoim', 'shawloym'], intent: 'correct', trad: 'ashkenazic' },
  { id: 'v-amen-mod', group: 'Vowels', word: 'אָמֵן', sayAs: 'Modern: "ah-MEN"', expect: 'amen', intent: 'correct', trad: 'sephardic' },
  { id: 'v-amen-ash', group: 'Vowels', word: 'אָמֵן', sayAs: 'Ashkenazic: "AW-MAYN"', expect: 'omayn', accept: ['omeyn', 'omein', 'awmayn'], intent: 'correct', trad: 'ashkenazic' },
  { id: 'v-elohim', group: 'Vowels', word: 'אֱלֹהִים', sayAs: '"eh-loh-HEEM"', expect: 'elohim', intent: 'correct', trad: 'sephardic' },
  { id: 'v-melech', group: 'Vowels', word: 'מֶלֶךְ', sayAs: '"MEH-lekh"', expect: 'melech', intent: 'correct', trad: 'sephardic' },
  { id: 'v-ani', group: 'Vowels', word: 'אֲנִי', sayAs: '"ah-NEE"', expect: 'ani', accept: ['anee'], intent: 'correct', trad: 'sephardic' },
  { id: 'v-torah', group: 'Vowels', word: 'תּוֹרָה', sayAs: 'Modern: "toh-RAH"', expect: 'tora', accept: ['torah'], intent: 'correct', trad: 'sephardic' },
  { id: 'v-chodashim', group: 'Vowels', word: 'חֳדָשִׁים', sayAs: '"kho-dah-SHEEM" (chataf kamatz = o)', expect: 'chodashim', intent: 'correct', trad: 'sephardic' },
  { id: 'v-kol', group: 'Vowels', word: 'כָּל־הָאָרֶץ', sayAs: '"KOL ha-AH-rets" (kamatz katan)', expect: 'kolhaarets', intent: 'correct', trad: 'sephardic' },
  { id: 'v-sholom-err', group: 'Vowels', word: 'שָׁלוֹם', sayAs: 'Wrong for Modern: "SHOH-lohm"', expect: 'sholom', intent: 'error', trad: 'sephardic' },
  { id: 'v-ata-err', group: 'Vowels', word: 'אַתָּה', sayAs: 'Wrong (patach as o): "OH-taw"', expect: 'oto', accept: ['otoh'], intent: 'error', trad: 'ashkenazic' },
  { id: 'v-biruch-err', group: 'Vowels', word: 'בָּרוּךְ', sayAs: 'Wrong: "BEE-rookh"', expect: 'biruch', intent: 'error', trad: 'sephardic' },

  // ── Sheva ──────────────────────────────────────────────────────────
  { id: 's-bereshit', group: 'Sheva', word: 'בְּרֵאשִׁית', sayAs: '"beh-reh-SHEET"', expect: 'bereshit', accept: ['bereishit', 'bereyshit'], intent: 'correct', trad: 'sephardic' },
  { id: 's-shemecha', group: 'Sheva', word: 'שְׁמֶךָ', sayAs: '"sheh-meh-KHAH" (sheva na voiced)', expect: 'shemecha', intent: 'correct', trad: 'sephardic' },
  { id: 's-shmecha-err', group: 'Sheva', word: 'שְׁמֶךָ', sayAs: 'Wrong (sheva dropped): "SHMEH-khah"', expect: 'shmecha', intent: 'error', trad: 'sephardic' },
  { id: 's-yisrael', group: 'Sheva', word: 'יִשְׂרָאֵל', sayAs: '"yis-rah-EL" (sheva nach silent)', expect: 'yisrael', intent: 'correct', trad: 'sephardic' },
  { id: 's-yiserael-err', group: 'Sheva', word: 'יִשְׂרָאֵל', sayAs: 'Wrong (sheva nach voiced): "yi-SEH-rah-el"', expect: 'yiserael', intent: 'error', trad: 'sephardic' },
  { id: 's-hineni', group: 'Sheva', word: 'הִנְנִי', sayAs: '"hee-neh-NEE"', expect: 'hineni', intent: 'correct', trad: 'sephardic' },
  { id: 's-hinni-err', group: 'Sheva', word: 'הִנְנִי', sayAs: 'Wrong: "HIN-nee"', expect: 'hinni', accept: ['hini'], intent: 'error', trad: 'sephardic' },

  // ── Consonants ─────────────────────────────────────────────────────
  { id: 'c-hashem', group: 'Consonants', word: 'הַשֵּׁם', sayAs: '"ha-SHEM"', expect: 'hashem', intent: 'correct', trad: 'sephardic' },
  { id: 'c-hasem-err', group: 'Consonants', word: 'הַשֵּׁם', sayAs: 'Wrong (shin as s): "ha-SEM"', expect: 'hasem', intent: 'error', trad: 'sephardic' },
  { id: 'c-yishrael-err', group: 'Consonants', word: 'יִשְׂרָאֵל', sayAs: 'Wrong (sin as sh): "yiSH-rah-el"', expect: 'yishrael', intent: 'error', trad: 'sephardic' },
  { id: 'c-bara', group: 'Consonants', word: 'בָּרָא', sayAs: '"bah-RAH"', expect: 'bara', intent: 'correct', trad: 'sephardic' },
  { id: 'c-vara-err', group: 'Consonants', word: 'בָּרָא', sayAs: 'Wrong (בּ as v): "VAH-rah"', expect: 'vara', intent: 'error', trad: 'sephardic' },
  { id: 'c-av', group: 'Consonants', word: 'אָב', sayAs: '"AHV"', expect: 'av', intent: 'correct', trad: 'sephardic' },
  { id: 'c-ab-err', group: 'Consonants', word: 'אָב', sayAs: 'Wrong (ב as b): "AHB"', expect: 'ab', intent: 'error', trad: 'sephardic' },
  { id: 'c-pe', group: 'Consonants', word: 'פֶּה', sayAs: '"PEH"', expect: 'pe', accept: ['peh'], intent: 'correct', trad: 'sephardic' },
  { id: 'c-fe-err', group: 'Consonants', word: 'פֶּה', sayAs: 'Wrong (פּ as f): "FEH"', expect: 'fe', accept: ['feh'], intent: 'error', trad: 'sephardic' },
  { id: 'c-ki', group: 'Consonants', word: 'כִּי', sayAs: '"KEE"', expect: 'ki', accept: ['kee'], intent: 'correct', trad: 'sephardic' },
  { id: 'c-chi-err', group: 'Consonants', word: 'כִּי', sayAs: 'Wrong (כּ as ch): "KHEE"', expect: 'chi', accept: ['chee'], intent: 'error', trad: 'sephardic' },
  { id: 'c-shabat-mod', group: 'Consonants', word: 'שַׁבָּת', sayAs: 'Modern: "shah-BAHT"', expect: 'shabat', accept: ['shabbat'], intent: 'correct', trad: 'sephardic' },
  { id: 'c-shabos-ash', group: 'Consonants', word: 'שַׁבָּת', sayAs: 'Ashkenazic: "SHAH-bos"', expect: 'shabos', accept: ['shabbos'], intent: 'correct', trad: 'ashkenazic' },
  { id: 'c-bereshit-ash-err', group: 'Consonants', word: 'בְּרֵאשִׁית', sayAs: 'Wrong for Ashkenazic (ending in T): "beh-ray-SHEET"', expect: 'bereyshit', accept: ['bereshit', 'bereishit'], intent: 'error', trad: 'ashkenazic' },
  { id: 'c-tsedek', group: 'Consonants', word: 'צֶדֶק', sayAs: '"TSEH-dek"', expect: 'tsedek', accept: ['tzedek'], intent: 'correct', trad: 'sephardic' },
  { id: 'c-chay', group: 'Consonants', word: 'חַי', sayAs: '"KHAI"', expect: 'chay', accept: ['chai'], intent: 'correct', trad: 'sephardic' },

  // ── Silent and special letters ─────────────────────────────────────
  { id: 'x-am', group: 'Silent and special letters', word: 'עַם', sayAs: '"AHM" (ayin silent)', expect: 'am', intent: 'correct', trad: 'sephardic' },
  { id: 'x-ham-err', group: 'Silent and special letters', word: 'עַם', sayAs: 'Wrong (added h): "HAHM"', expect: 'ham', intent: 'error', trad: 'sephardic' },
  { id: 'x-yadah', group: 'Silent and special letters', word: 'יָדָהּ', sayAs: '"yah-DAH" with an audible final H (mappiq)', expect: 'yadah', intent: 'correct', trad: 'sephardic' },
  { id: 'x-yada-err', group: 'Silent and special letters', word: 'יָדָהּ', sayAs: 'Wrong (mappiq silent): "yah-DAH" with no h', expect: 'yada', intent: 'error', trad: 'sephardic' },
  { id: 'x-ruach', group: 'Silent and special letters', word: 'רוּחַ', sayAs: '"ROO-akh" (patach genuvah)', expect: 'ruach', intent: 'correct', trad: 'sephardic' },
  { id: 'x-rucha-err', group: 'Silent and special letters', word: 'רוּחַ', sayAs: 'Wrong (patach after the ח): "roo-KHAH"', expect: 'rucha', intent: 'error', trad: 'sephardic' },
  { id: 'x-sameach', group: 'Silent and special letters', word: 'שָׂמֵחַ', sayAs: '"sah-MEH-akh"', expect: 'sameach', intent: 'correct', trad: 'sephardic' },
  { id: 'x-vayomer', group: 'Silent and special letters', word: 'וַיֹּאמֶר', sayAs: '"vah-YOH-mer"', expect: 'vayomer', accept: ['vayyomer'], intent: 'correct', trad: 'sephardic' },
]

// Full verses: real readings in context, where the model has more reason to
// "fix" what it hears and words run together. Each verse is recorded once
// read correctly and once with mistakes planted at known words.
//
// Each verse item:
//   pasukIdx — verse in psukim.js
//   trad     — tradition to read and grade in
//   plants   — deliberate mistakes: { index (word in the verse), sayAs, heard }
//              where `heard` is the transcription a faithful model would write
// Words without a plant must grade clean; planted words must be flagged.

export const verseItems = [
  { id: 'vs-12-1-clean', pasukIdx: 0, trad: 'sephardic', plants: [] },
  {
    id: 'vs-12-1-errors', pasukIdx: 0, trad: 'sephardic',
    plants: [
      { index: 1, sayAs: 'ha-SEM (shin as s)', heard: 'hasem' },
      { index: 6, sayAs: 'oo-mi-VAYT (בּ as v)', heard: 'umivet' },
      { index: 10, sayAs: 'ar-EH-kha (כּ as ch)', heard: 'arecha' },
    ],
  },
  { id: 'vs-shema-clean', pasukIdx: 5, trad: 'ashkenazic', plants: [] },
  {
    id: 'vs-shema-errors', pasukIdx: 5, trad: 'ashkenazic',
    plants: [
      { index: 0, sayAs: 'SHMA (sheva na dropped)', heard: 'shma' },
      { index: 1, sayAs: 'yiSH-ro-el (sin as shin)', heard: 'yishroel' },
    ],
  },
  { id: 'vs-12-4-clean', pasukIdx: 3, trad: 'sephardic', plants: [] },
  {
    id: 'vs-12-4-errors', pasukIdx: 3, trad: 'sephardic',
    plants: [
      { index: 3, sayAs: 'di-VER (בּ as v)', heard: 'diver' },
      { index: 10, sayAs: 'ben ha-MESH (ח as h)', heard: 'benhamesh' },
      { index: 11, sayAs: 'sho-NEEM (kamatz as o in Sephardic)', heard: 'shonim' },
    ],
  },
  { id: 'vs-az-yashir-clean', pasukIdx: 8, trad: 'ashkenazic', plants: [] },
  {
    id: 'vs-az-yashir-errors', pasukIdx: 8, trad: 'ashkenazic',
    plants: [
      { index: 2, sayAs: 'oo-BNAY (ב as b)', heard: 'ubney' },
      { index: 5, sayAs: 'ha-ZOT (tav as t in Ashkenazic)', heard: 'hazot' },
    ],
  },
]
