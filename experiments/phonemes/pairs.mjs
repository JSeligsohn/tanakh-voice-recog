// Matched pairs for the experiment, spoken by the macOS Hebrew voice (Carmit):
// each word read right, and read with one sound wrong. `say` is what Carmit is
// given; the wrong reading is spelled with the letter the mistake sounds like,
// so the voice has to produce it. `word` is the text the reading is graded
// against. Synthetic speech: a sanity check, not a substitute for students.

export const pairs = [
  // shin/sin — including the familiar words gpt-audio always "corrects"
  { id: 'shana', word: 'שָׁנָה', right: 'שָׁנָה', wrong: 'סָנָה', letter: 'ש', mistake: 'sh → s' },
  { id: 'yashir', word: 'יָשִׁיר', right: 'יָשִׁיר', wrong: 'יָסִיר', letter: 'ש', mistake: 'sh → s' },
  { id: 'asher', word: 'אֲשֶׁר', right: 'אֲשֶׁר', wrong: 'אֲסֶר', letter: 'ש', mistake: 'sh → s' },
  { id: 'shema', word: 'שְׁמַע', right: 'שְׁמַע', wrong: 'סְמַע', letter: 'ש', mistake: 'sh → s' },
  { id: 'esav', word: 'עֵשָׂו', right: 'עֵסָו', wrong: 'עֵשָׁו', letter: 'ש', mistake: 's → sh' },
  { id: 'yisrael', word: 'יִשְׂרָאֵל', right: 'יִסְרָאֵל', wrong: 'יִשְׁרָאֵל', letter: 'ש', mistake: 's → sh' },
  { id: 'sameach', word: 'שָׂמֵחַ', right: 'סָמֵחַ', wrong: 'שָׁמֵחַ', letter: 'ש', mistake: 's → sh' },
  // bet/vet
  { id: 'baruch', word: 'בָּרוּךְ', right: 'בָּרוּךְ', wrong: 'וָרוּךְ', letter: 'ב', mistake: 'b → v' },
  { id: 'bayit', word: 'בַּיִת', right: 'בַּיִת', wrong: 'וַיִת', letter: 'ב', mistake: 'b → v' },
  { id: 'avicha', word: 'אָבִיךָ', right: 'אָוִיךָ', wrong: 'אָבִּיךָ', letter: 'ב', mistake: 'v → b' },
  // kaf/khaf
  { id: 'kol', word: 'כֹּל', right: 'כֹּל', wrong: 'חֹל', letter: 'כ', mistake: 'k → kh' },
  { id: 'kohen', word: 'כֹּהֵן', right: 'כֹּהֵן', wrong: 'חֹהֵן', letter: 'כ', mistake: 'k → kh' },
  { id: 'melech', word: 'מֶלֶךְ', right: 'מֶלֶח', wrong: 'מֶלֶק', letter: 'ך', mistake: 'kh → k' },
  // pe/fe
  { id: 'paro', word: 'פַּרְעֹה', right: 'פַּרְעֹה', wrong: 'פַרְעֹה', letter: 'פ', mistake: 'p → f' },
  { id: 'nefesh', word: 'נֶפֶשׁ', right: 'נֶפֶשׁ', wrong: 'נֶפֶּשׁ', letter: 'פ', mistake: 'f → p' },
]
