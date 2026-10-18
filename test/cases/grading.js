// Grading: a word plus what the student said → should it pass, or be flagged?
//
// Each row: { word, heard, trad?, pass: true } or { word, heard, trad?, flag }
//   trad — 'sephardic' (default) or 'ashkenazic'
//   pass — the reading must grade clean (no notes, no mispronunciation)
//   flag — the reading must be flagged, with a note containing this text
//   notes — optional: exactly this many notes (one slip must not cascade)
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
  { word: 'אֵלָיו', heard: 'elav', pass: true, rule: 'ָיו suffix read "av" (verse check false flag)' },
  { word: 'אֱלֹהֵינוּ', heard: 'eloheinu', trad: 'ashkenazic', pass: true, rule: 'divine name as written' },
  { word: 'אֱלֹהֵינוּ', heard: 'elokeinu', trad: 'ashkenazic', pass: true, rule: 'divine name substitution "Elokeinu"' },
  { word: 'אֱלֹהִים', heard: 'elokim', pass: true, rule: 'divine name substitution "Elokim"' },
  { word: 'לֵאלֹהִים', heard: 'lelokim', pass: true, rule: 'divine name substitution with a prefix' },
  { word: 'הַשֵּׁם', heard: 'kashem', flag: 'ה (he) is "h" as in "hat" — you said "k"', rule: '"k" for ה only in forms of אֱלֹהִים' },
  { word: 'וּבְנֵי', heard: 'uvnei', trad: 'ashkenazic', pass: true, rule: 'S2 sheva after a long vowel may be silent' },
  { word: 'וּבְנֵי', heard: 'uvenei', trad: 'ashkenazic', pass: true, rule: 'S2 sheva after a long vowel may be voiced' },
  { word: 'שׁוֹמְרִים', heard: 'shomrim', pass: true, rule: 'S2 sheva after a long vowel may be silent' },
  { word: 'וַאֲגַדְּלָה', heard: 'vaagadela', pass: true, rule: 'S7 sheva under a dagesh chazak said' },
  { word: 'וַאֲגַדְּלָה', heard: 'vaagadla', pass: true, rule: 'S7 sheva under a dagesh chazak may be silent' },
  { word: 'הַשְּׁבִיעִי', heard: 'hashevii', pass: true, rule: 'S7 dagesh chazak after the article' },
  { word: 'מְבָרְכֶיךָ', heard: 'mevarechecha', pass: true, rule: 'silent yud after segol' },
  { word: 'מְבָרְכֶיךָ', heard: 'mevarecheycha', pass: true, rule: 'segol + yud said "ey" is accepted' },
  { word: 'דְּרָכֶיהָ', heard: 'deracheha', pass: true, rule: 'silent yud after segol before ה' },
  { word: 'אַחֶיךָ', heard: 'achecho', trad: 'ashkenazic', pass: true, rule: 'silent yud after segol (Ashkenazic)' },
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
  { word: 'בָּרוּךְ', heard: 'boruch', trad: 'ashkenazic', pass: true, rule: 'Ashkenazic kamatz "o"' },
  { word: 'בָּרוּךְ', heard: 'bawruch', trad: 'ashkenazic', pass: true, rule: 'Ashkenazic kamatz "aw"' },
  { word: 'בָּרוּךְ', heard: 'baruch', trad: 'ashkenazic', pass: true, rule: 'lenient: Ashkenazic kamatz heard as "a"' },
  { word: 'בָּרוּךְ', heard: 'buruch', trad: 'ashkenazic', pass: true, rule: 'lenient: Ashkenazic kamatz heard as "u"' },
  { word: 'בָּרוּךְ', heard: 'buhruch', trad: 'ashkenazic', pass: true, rule: 'lenient: Ashkenazic kamatz heard as "uh"' },
  { word: 'שָׁלוֹם', heard: 'shalom', trad: 'ashkenazic', pass: true, rule: 'lenient: Ashkenazic kamatz heard as "a"' },
  { word: 'הָאָרֶץ', heard: 'haarets', trad: 'ashkenazic', pass: true, rule: 'repeated "a" belongs to the next kamatz, not elongation' },

  // ── Errors that must be flagged ────────────────────────────────────
  { word: 'הַשֵּׁם', heard: 'hasem', flag: 'shin', rule: 'shin read as sin' },
  { word: 'יִשְׂרָאֵל', heard: 'yishrael', flag: 'sin', rule: 'sin read as shin' },
  { word: 'בָּרָא', heard: 'vara', flag: 'בּ (bet, with a dot) is "b" as in "boy" — you said "v" as in "very", the sound of ב (vet, no dot).', rule: 'בּ read as v: names the letter, both sounds, and the letter read instead' },
  { word: 'אָב', heard: 'ab', flag: 'the sound of בּ (bet, with a dot)', rule: 'ב read as b' },
  { word: 'פֶּה', heard: 'fe', flag: 'the sound of פ (fe, no dot)', rule: 'פּ read as f' },
  { word: 'בְּרֵאשִׁית', heard: 'bereshit', trad: 'ashkenazic', flag: 'sav', rule: 'Ashkenazic ת read as t' },
  { word: 'יָדָהּ', heard: 'yada', flag: 'mappiq', rule: 'mappiq ה not sounded' },
  { word: 'וֶהְיֵה', heard: 'veye', trad: 'ashkenazic', flag: 'Skipped הְ — its "h" wasn\'t heard', notes: 1, rule: 'ה with sheva left out: one skipped sound, no mention of mappiq' },
  { word: 'וֶהְיֵה', heard: 'veyis', trad: 'ashkenazic', flag: 'ה is said "h" here', rule: 'silent ה with sheva: no mention of mappiq (production reading)' },
  { word: 'וְאֶעֶשְׂךָ', heard: "ve'escha", trad: 'ashkenazic', flag: 'Skipped', notes: 1, rule: 'one dropped syllable is one mistake, not three' },
  { word: 'וַאֲבָרֶכְךָ', heard: "ka'arechcha", trad: 'ashkenazic', flag: 'Skipped', notes: 2, rule: 'wrong letter + dropped syllable = two mistakes, not four' },
  { word: 'וַיֹּאמֶר', heard: 'vamer', flag: 'Skipped', notes: 1, rule: 'dropped syllable mid-word' },
  { word: 'בְּרֵאשִׁית', heard: 'rereshit', flag: 'you said "r"', notes: 1, rule: 'a wrong letter is not mistaken for a skipped syllable' },
  { word: 'הַשֵּׁם', heard: 'kashem', flag: 'you said "k"', notes: 1, rule: 'the "h" inside "sh" is not taken as ה' },
  { word: 'לֶךְ־לְךָ', heard: 'lechlo', trad: 'ashkenazic', flag: 'Skipped ךָ — its "kh" and "aw" weren\'t heard', notes: 2, rule: 'a final syllable left out is named as skipped' },
  { word: 'אֶל־אַבְרָם', heard: 'telavram', flag: 'at the start — אֶ is just the vowel "eh" as in "bed"', notes: 1, rule: 'a consonant added before a vowel-carrying א names the vowel, not "silent"' },
  { word: 'מֵאַרְצְךָ', heard: 'mekartsecha', flag: 'before אַ — it is just the vowel "ah" as in "father"', notes: 1, rule: 'same, mid-word' },
  { word: 'רוּחַ', heard: 'rucha', flag: 'Patach genuvah', rule: 'patach genuvah read after the letter' },
  { word: 'רוּחַ', heard: 'ruch', flag: 'Patach genuvah', rule: 'patach genuvah dropped' },
  { word: 'שָׁלוֹם', heard: 'sholom', flag: 'The vowel is kamatz: "ah" as in "father" — you said "oh" as in "go".', rule: 'Sephardic qamats gadol read as o' },
  { word: 'אַתָּה', heard: 'otoh', trad: 'ashkenazic', flag: 'The vowel is patach', rule: 'Ashkenazic patach read as o (only kamatz is lenient)' },
  { word: 'בָּרוּךְ', heard: 'biruch', trad: 'ashkenazic', flag: 'The vowel is kamatz: "aw" as in "law" — you said "ee" as in "see".', rule: 'Ashkenazic kamatz read as "i"' },
  { word: 'שְׁמֶךָ', heard: 'shmecha', flag: 'Sheva na', rule: 'sheva na dropped' },
  { word: 'בְּרֵאשִׁית', heard: 'bireshit', flag: 'Sheva na', rule: 'sheva na heard as "i"' },
  { word: 'הִנְנִי', heard: 'hinni', flag: 'Sheva na', rule: 'S4 sheva na dropped' },
  { word: 'יִשְׂרָאֵל', heard: 'yiserael', flag: 'Sheva nach is silent — no vowel after this letter. You said "eh" as in "bed".', notes: 1, rule: 'voiced sheva nach named as such' },
  { word: 'לֵךְ', heard: 'leche', flag: 'Sheva nach is silent', notes: 1, rule: 'voiced word-final sheva nach' },
  { word: 'וַאֲבָרֶכְךָ', heard: 'vaavarechcha', pass: true, rule: 'sheva nach kept silent' },
  { word: 'אֲנִי', heard: 'anii', flag: 'it\'s a short "ee" as in "see"', rule: 'vowel elongated' },
  { word: 'אַבְרָם', heard: 'avrami', flag: 'at the end of the word', rule: 'extra sound at the end' },
  { word: 'וַתַּהַר', heard: 'vatahr', flag: 'The vowel is patach: "ah" as in "father" — it was left out.', rule: 'vowel dropped' },
]

// Whole verses through Manual mode: word alignment across the verse.
// expect maps graded word index → expected errorType (others must be 'None').
// Each part of a maqef-joined phrase is its own graded word.
export const verseCases = [
  {
    text: 'אֶל־אַבְרָם', heard: 'elavram',
    expect: {}, rule: 'maqef phrase heard as one token is split between its words',
  },
  {
    text: 'אֶל־אַבְרָם', heard: 'el',
    expect: { 1: 'Omission' }, rule: 'one word of a maqef phrase skipped',
  },
  {
    text: 'אֶל־אַבְרָם', heard: 'elavrom',
    expect: { 1: 'Mispronunciation' }, notes: { 1: 'The vowel is kamatz' },
    rule: 'a mistake in a maqef phrase is on its own word',
  },
  {
    text: 'וְאֶת־כָּל־רְכוּשָׁם', heard: 'veetkolrechusham',
    expect: {}, rule: 'three maqef-joined words heard as one token',
  },
  {
    text: 'אֶת־שָׂרַי', heard: 'etsaray',
    expect: {}, rule: 'ת then שׂ across the maqef is not צ',
  },
  {
    text: 'אֶת־שָׂרַי', heard: 'etsharay',
    expect: { 1: 'Mispronunciation' }, notes: { 1: 'שׂ (sin, dot on the left) is "s"' },
    rule: 'sin read as shin, across the maqef',
  },
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
    expect: { 1: 'Repeated' }, notes: { 1: 'Stuttered' }, rule: 'word repeated',
  },
  {
    text: 'וַיֹּאמֶר הַשֵּׁם אֶל־אַבְרָם', heard: 'vayomer hashem hashem shalom el avram',
    expect: { 1: 'Repeated' }, rule: 'extra word inserted is skipped over',
  },
  {
    text: 'לֶךְ־לְךָ מֵאַרְצְךָ', heard: 'lech lecha meartsecha',
    expect: {}, rule: 'maqef word spoken as two tokens',
  },
  {
    text: 'אֶל־הָאָרֶץ אֲשֶׁר', heard: 'el ha arets ka asher',
    expect: { 2: 'Mispronunciation' }, notes: { 2: 'Extra "k"' },
    rule: 'an extra prefix syllable between words goes on the next word (כַּאֲשֶׁר for אֲשֶׁר)',
  },
  {
    text: 'וַאֲגַדְּלָה שְׁמֶךָ', heard: 'vaagad la shemecha',
    expect: {}, rule: 'a prefix-like syllable that ends the word stays with it',
  },
]
