// Grading: a word plus what the student said → should it pass, or be flagged?
//
// Each row: { word, heard, trad?, pass: true } or { word, heard, trad?, flag }
//   trad — 'sephardic' (default) or 'ashkenazic'
//   pass — the reading must grade clean (no notes, no mispronunciation)
//   flag — the reading must be flagged, with a note containing this text
//   review / todo — as in expected.js

export const gradingCases = [
  // ── Correct readings and accepted spellings ────────────────────────
  { word: 'בְּרֵאשִׁית', heard: 'bereshit', pass: true },
  { word: 'בְּרֵאשִׁית', heard: 'bereshis', trad: 'ashkenazic', pass: true },
  { word: 'שָׁלוֹם', heard: 'shalom', pass: true },
  { word: 'שָׁלוֹם', heard: 'shalohm', pass: true, rule: 'holam spelled "oh"' },
  { word: 'שָׁלוֹם', heard: 'shalowm', pass: true, rule: 'holam spelled "ow"' },
  { word: 'עוֹלָם', heard: 'ohlam', pass: true, rule: 'holam spelled "oh" before a consonant' },
  { word: 'אֹהֶל', heard: 'ohel', pass: true, rule: '"oh" must not swallow a real ה' },
  { word: 'אֲנִי', heard: 'anee', pass: true, rule: 'chirik spelled "ee"' },
  { word: 'אֲנִי', heard: 'aniy', pass: true, rule: 'final chirik spelled "iy"' },
  { word: 'חַי', heard: 'chai', pass: true, rule: 'final "ai" for patach + yud' },
  { word: 'רוּחַ', heard: 'ruach', pass: true },
  { word: 'רוּחַ', heard: 'rooach', pass: true, rule: 'shuruk spelled "oo"' },
  { word: 'שָׂמֵחַ', heard: 'sameach', pass: true },
  { word: 'וּמִבֵּית', heard: 'umibeit', pass: true, rule: 'tzere spelled "ei"' },
  { word: 'תּוֹרָה', heard: 'torah', pass: true, rule: 'final "ah" before a silent ה' },
  { word: 'פֶּה', heard: 'peh', pass: true, rule: 'final "eh" before a silent ה' },
  { word: 'הַזֶּה', heard: 'hazeh', pass: true, rule: 'final "eh" before a silent ה' },
  { word: 'בְּרֵאשִׁית', heard: 'bureshit', pass: true, rule: 'sheva na heard as "u"' },
  { word: 'בְּרֵאשִׁית', heard: 'buhreshit', pass: true, rule: 'sheva na heard as "uh"' },
  { word: 'בְּיוֹם', heard: 'biyom', pass: true, rule: 'sheva na colors to "i" before yud' },
  { word: 'לְהַבְדִּיל', heard: 'lehavdil', pass: true, rule: 'sheva "eh" variant must not eat a real ה' },
  { word: 'יִשְׂרָאֵל', heard: 'jisrael', pass: true, rule: 'j → y' },
  { word: 'וַיֹּאמֶר', heard: 'wayomer', pass: true, rule: 'w → v before a vowel' },
  { word: 'וַיֹּאמֶר', heard: 'vayyomer', pass: true, rule: 'doubled consonant (dagesh chazak)' },
  { word: 'חָנֵּנִי', heard: 'chonneni', pass: true, rule: 'doubled consonant before same-letter syllable' },
  { word: 'עֵשָׂו', heard: "'esav", pass: true, rule: 'apostrophe for ayin is ignored' },
  { word: 'אֶל־אַבְרָם', heard: 'el avram', pass: true, rule: 'maqef word spoken as two tokens' },
  { word: 'כָּל־הָאָרֶץ', heard: 'kol haarets', pass: true },
  { word: 'כָּל־הָאָרֶץ', heard: 'kal haarets', pass: true, rule: 'lenient: katan read as gadol' },
  { word: 'חָכְמָה', heard: 'chachma', pass: true, rule: 'lenient: katan read as gadol' },
  { word: 'וַיָּקָם', heard: 'vayakam', pass: true, rule: 'lenient: katan read as gadol' },
  { word: 'שָׁמְרוּ', heard: 'shamru', pass: true, rule: 'QK1 ambiguous: silent sheva accepted' },
  { word: 'שָׁמְרוּ', heard: 'shomru', pass: true, rule: 'QK1 ambiguous: katan accepted' },
  { word: 'אָמֵן', heard: 'omein', trad: 'ashkenazic', pass: true, rule: 'Ashkenazic tzere "ei"' },
  { word: 'שָׁלוֹם', heard: 'sholoym', trad: 'ashkenazic', pass: true, rule: 'Ashkenazic holam "oy"' },

  // ── Errors that must be flagged ────────────────────────────────────
  { word: 'הַשֵּׁם', heard: 'hasem', flag: 'shin', rule: 'shin read as sin' },
  { word: 'יִשְׂרָאֵל', heard: 'yishrael', flag: 'sin', rule: 'sin read as shin' },
  { word: 'בָּרָא', heard: 'vara', flag: 'with dagesh', rule: 'בּ read as v' },
  { word: 'אָב', heard: 'ab', flag: 'no dagesh', rule: 'ב read as b' },
  { word: 'פֶּה', heard: 'fe', flag: 'with dagesh', rule: 'פּ read as f' },
  { word: 'בְּרֵאשִׁית', heard: 'bereshit', trad: 'ashkenazic', flag: 'sav', rule: 'Ashkenazic ת read as t' },
  { word: 'יָדָהּ', heard: 'yada', flag: 'mappiq', rule: 'mappiq ה not sounded' },
  { word: 'רוּחַ', heard: 'rucha', flag: 'Patach genuvah', rule: 'patach genuvah read after the letter' },
  { word: 'רוּחַ', heard: 'ruch', flag: 'Patach genuvah', rule: 'patach genuvah dropped' },
  { word: 'שָׁלוֹם', heard: 'sholom', flag: 'Vowel mismatch', rule: 'Sephardic qamats gadol read as o' },
  { word: 'שְׁמֶךָ', heard: 'shmecha', flag: 'Sheva na', rule: 'sheva na dropped' },
  { word: 'בְּרֵאשִׁית', heard: 'bireshit', flag: 'Sheva na', rule: 'sheva na heard as "i"' },
  { word: 'הִנְנִי', heard: 'hinni', flag: 'Sheva na', rule: 'S4 sheva na dropped' },
  { word: 'יִשְׂרָאֵל', heard: 'yiserael', flag: 'Extra "e"', rule: 'sheva nach voiced' },
  { word: 'יִשְׂרָאֵל', heard: 'yiserael', flag: 'Sheva nach', rule: 'voiced sheva nach named as such',
    todo: 'flagged, but the note blames the next letter ("Extra e inserted before ר")' },
  { word: 'אֲנִי', heard: 'anii', flag: 'held too long', rule: 'vowel elongated' },
  { word: 'אַבְרָם', heard: 'avrami', flag: 'at the end of the word', rule: 'extra sound at the end' },
  { word: 'וַתַּהַר', heard: 'vatahr', flag: 'Vowel mismatch', rule: 'vowel dropped' },
]

// Whole verses through Manual mode: word alignment across the verse.
// expect maps reference word index → expected errorType (others must be 'None').
export const verseCases = [
  {
    text: 'אֶל אַבְרָם', heard: 'avram el',
    expect: { 1: 'OutOfOrder' }, rule: 'adjacent words swapped',
  },
  {
    text: 'וַיֹּאמֶר הַשֵּׁם אֶל־אַבְרָם', heard: 'vayomer el avram',
    expect: { 1: 'Omission' }, rule: 'word skipped',
  },
  {
    text: 'וַיֹּאמֶר הַשֵּׁם אֶל־אַבְרָם', heard: 'vayomer hashem hashem el avram',
    expect: {}, notes: { 1: 'Stuttered' }, rule: 'word repeated',
  },
  {
    text: 'וַיֹּאמֶר הַשֵּׁם אֶל־אַבְרָם', heard: 'vayomer hashem hashem shalom el avram',
    expect: {}, rule: 'extra word inserted is skipped over',
  },
  {
    text: 'לֶךְ־לְךָ מֵאַרְצְךָ', heard: 'lech lecha meartsecha',
    expect: {}, rule: 'maqef word spoken as two tokens',
  },
]
