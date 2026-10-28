// What to record on the test bench. Each item is read twice: as written
// ("right"), and with the stated mistake ("wrong"). `flag` names what the
// mistake should be caught on; a right reading should have no flags.
//
//   { id, round, group, text | pasuk, trad, right: how to say it, wrong: the mistake,
//     flag: [{ word, letter }            a consonant
//            | { word, vowel }           a vowel, by nikkud name (hiriq, tzere, ...)
//            | { word, vowel: 'sheva-na' | 'sheva-nach' }
//            | { word, problem: 'skipped' | 'wrong word' | 'prefix left out' | ... }] }
//   a problem names the check that should catch it (matched on its test)
//   right or wrong may be left out; a wrong take with no flag is a variation
//   that should pass (a pause, a self-correction), or, with `ungraded`, a real
//   mistake we choose not to grade (so nothing else should be flagged)
//
// Round 1 came from the app's verses; round 2 is chosen for coverage: each
// letter pair in every position (start, after a sheva, doubled, soft, final),
// the vowel contrasts the model can hear, and each kind of sheva. The page
// shows the latest round; earlier takes are kept and still re-scored. Round 3
// is recorded per reader (adult, child): o vs u, the vowels students confuse
// most (וֹ/וּ), for building a vowel check that measures the sound itself; and
// how real students read (pauses, repeats, skipped words, noise).

export const groups = [
  { id: 'shin', title: 'Shin and sin', note: 'Start, middle and end of a word, and sin with a cholam (שֹׂ).' },
  { id: 'bet', title: 'Bet and vet', note: 'At the start, after a silent sheva, doubled, soft in the middle, and at the end.' },
  { id: 'kaf', title: 'Kaf and khaf' },
  { id: 'pe', title: 'Pe and fe' },
  { id: 'soft', title: 'Soft letter after a vowel-ending word', note: 'The letter has no dot because the word before ends in a vowel.' },
  { id: 'tav', title: 'Tav and sav', note: 'Ashkenazic: ת without a dot is "s"; with a dot it is "t" in every tradition.' },
  { id: 'vowel', title: 'Vowels', note: 'Contrasts the model can hear: i, e and a apart, and o and u apart from i and e.' },
  { id: 'blind', title: 'Vowels the model can\'t tell apart yet', note: 'a vs o and o vs u. These will show as missed; they are recorded to test other models later.' },
  { id: 'sheva', title: 'Sheva', note: 'Sheva na must be heard: flagged if left out (letters run together) or said too short. Sheva nach is silent: flagged if a vowel is added.' },
  { id: 'ou', title: 'O and u', note: 'The vowels students confuse most (וֹ vs וּ). OH is o as in "bone"; OO is u as in "moon". Scored with their own o-vs-u check. Both readers, please.' },
  { id: 'long', title: 'Long words', note: 'One mistake somewhere in a long word: a vowel, a sheva, or a whole syllable dropped.' },
  { id: 'prefix', title: 'Dropped prefixes', note: 'The little "ve-", "ha-", "u-", "la-" swallowed. Not detected yet; these are for building that check.' },
  { id: 'letters', title: 'Look-alike letters', note: 'A letter read as one that looks like it. Only shin/sin, bet/vet, kaf/khaf, pe/fe and tav/sav are checked so far; these are for building a check for every letter.' },
  { id: 'english', title: 'Sounds English speakers get wrong', note: 'ח as "h" and צ as "s" or "z": not detected yet. The "h" of a final הּ isn\'t graded: it\'s a breath the model barely hears, so a dropped one can\'t be told from a quiet one.' },
  { id: 'endings', title: 'Word endings', note: 'Patach genuvah read in the wrong order, a vowel added to a silent final sheva, and ־ָיו read "-ayu". Not detected yet.' },
  { id: 'reading', title: 'How students really read', note: 'Shema with pauses, repeats, noise and so on. Skipped and wrong words aren\'t detected yet (they\'ll show as missed); the rest should still catch the mistake and nothing else.' },
  { id: 'verse', title: 'Whole verses' },
]

export const latestRound = 4

const S = 'sephardic', A = 'ashkenazic'

export const items = [
  // ═══ Round 1: from the app's verses ═══
  // ── Shin and sin ──
  { round: 1, id: 'shana', group: 'shin', text: 'שָׁנָה', trad: S, right: 'sha-NA', wrong: 'sa-NA', flag: [{ word: 'שָׁנָה', letter: 'ש' }] },
  { round: 1, id: 'yisrael', group: 'shin', text: 'יִשְׂרָאֵל', trad: S, right: 'yis-ra-EL', wrong: 'yish-ra-EL', flag: [{ word: 'יִשְׂרָאֵל', letter: 'ש' }] },
  { round: 1, id: 'esav', group: 'shin', text: 'עֵשָׂו', trad: S, right: 'e-SAV', wrong: 'e-SHAV', flag: [{ word: 'עֵשָׂו', letter: 'ש' }] },
  { round: 1, id: 'yashir', group: 'shin', text: 'יָשִׁיר', trad: S, right: 'ya-SHIR', wrong: 'ya-SIR', flag: [{ word: 'יָשִׁיר', letter: 'ש' }] },
  { round: 1, id: 'moshe', group: 'shin', text: 'מֹשֶׁה', trad: S, right: 'mo-SHE', wrong: 'mo-SE', flag: [{ word: 'מֹשֶׁה', letter: 'ש' }] },
  { round: 1, id: 'sarai', group: 'shin', text: 'שָׂרַי', trad: S, right: 'sa-RAI', wrong: 'sha-RAI', flag: [{ word: 'שָׂרַי', letter: 'ש' }] },
  { round: 1, id: 'shalom', group: 'shin', text: 'שָׁלוֹם', trad: S, right: 'sha-LOM', wrong: 'sa-LOM', flag: [{ word: 'שָׁלוֹם', letter: 'ש' }] },
  { round: 1, id: 'asa', group: 'shin', text: 'עָשָׂה', trad: S, right: 'a-SA', wrong: 'a-SHA', flag: [{ word: 'עָשָׂה', letter: 'ש' }] },

  // ── Bet and vet ──
  { round: 1, id: 'baruch', group: 'bet', text: 'בָּרוּךְ', trad: S, right: 'ba-RUCH', wrong: 'va-RUCH', flag: [{ word: 'בָּרוּךְ', letter: 'ב' }] },
  { round: 1, id: 'avram', group: 'bet', text: 'אַבְרָם', trad: S, right: 'av-RAM', wrong: 'ab-RAM', flag: [{ word: 'אַבְרָם', letter: 'ב' }] },
  { round: 1, id: 'avicha', group: 'bet', text: 'אָבִיךָ', trad: S, right: 'a-VI-cha', wrong: 'a-BI-cha', flag: [{ word: 'אָבִיךָ', letter: 'ב' }] },
  { round: 1, id: 'umibeit', group: 'bet', text: 'וּמִבֵּית', trad: S, right: 'u-mi-BEIT', wrong: 'u-mi-VEIT', flag: [{ word: 'וּמִבֵּית', letter: 'ב' }] },

  // ── Kaf and khaf ──
  { round: 1, id: 'kol', group: 'kaf', text: 'כֹּל', trad: S, right: 'KOL', wrong: 'CHOL', flag: [{ word: 'כֹּל', letter: 'כ' }] },
  { round: 1, id: 'melech', group: 'kaf', text: 'מֶלֶךְ', trad: S, right: 'ME-lech', wrong: 'ME-lek', flag: [{ word: 'מֶלֶךְ', letter: 'ך' }] },
  { round: 1, id: 'lecha', group: 'kaf', text: 'לְךָ', trad: S, right: 'le-CHA', wrong: 'le-KA', flag: [{ word: 'לְךָ', letter: 'ך' }] },
  { round: 1, id: 'areka', group: 'kaf', text: 'אַרְאֶךָּ', trad: S, right: 'ar-E-ka', wrong: 'ar-E-cha', flag: [{ word: 'אַרְאֶךָּ', letter: 'ך' }] },

  // ── Pe and fe ──
  { round: 1, id: 'paro', group: 'pe', text: 'פַּרְעֹה', trad: S, right: 'par-O', wrong: 'far-O', flag: [{ word: 'פַּרְעֹה', letter: 'פ' }] },
  { round: 1, id: 'nefesh', group: 'pe', text: 'נֶפֶשׁ', trad: S, right: 'NE-fesh', wrong: 'NE-pesh', flag: [{ word: 'נֶפֶשׁ', letter: 'פ' }] },
  { round: 1, id: 'yosef', group: 'pe', text: 'יוֹסֵף', trad: S, right: 'yo-SEF', wrong: 'yo-SEP', flag: [{ word: 'יוֹסֵף', letter: 'ף' }] },

  // ── Soft letter after a vowel-ending word ──
  { round: 1, id: 'vinyamin', group: 'soft', text: 'צַוְּארֵי בִנְיָמִן', trad: S, right: 'tza-ve-REI vin-YA-min', wrong: 'tza-ve-REI bin-YA-min', flag: [{ word: 'בִנְיָמִן', letter: 'ב' }] },
  { round: 1, id: 'chen', group: 'soft', text: 'וַיְהִי־כֵן', trad: S, right: 'vay-HI CHEN', wrong: 'vay-HI KEN', flag: [{ word: 'כֵן', letter: 'כ' }] },
  { round: 1, id: 'vou', group: 'soft', text: 'וּלְכוּ־בֹאוּ', trad: S, right: 'ul-CHU VO-u', wrong: 'ul-CHU BO-u', flag: [{ word: 'בֹאוּ', letter: 'ב' }] },

  // ── Tav and sav ──
  { round: 1, id: 'beis', group: 'tav', text: 'וּמִבֵּית', trad: A, right: 'u-mi-BEIS', wrong: 'u-mi-BEIT', flag: [{ word: 'וּמִבֵּית', letter: 'ת' }] },
  { round: 1, id: 'bereishis', group: 'tav', text: 'בְּרֵאשִׁית', trad: A, right: 'be-rei-SHIS', wrong: 'be-rei-SHIT', flag: [{ word: 'בְּרֵאשִׁית', letter: 'ת' }] },
  { round: 1, id: 'bereshit', group: 'tav', text: 'בְּרֵאשִׁית', trad: S, right: 'be-re-SHIT', wrong: 'be-re-SHIS', flag: [{ word: 'בְּרֵאשִׁית', letter: 'ת' }] },
  { round: 1, id: 'torah', group: 'tav', text: 'תּוֹרָה', trad: A, right: 'TOI-ro (or TOH-raw)', wrong: 'SOI-ro', flag: [{ word: 'תּוֹרָה', letter: 'ת' }] },

  // ── Whole verses ──
  { round: 1, id: 'shema', group: 'verse', pasuk: 'deut-6-4', trad: S, right: 'Read it as written.', wrong: 'Say "Sema Yishrael", the rest correctly.',
    flag: [{ word: 'שְׁמַע', letter: 'ש' }, { word: 'יִשְׂרָאֵל', letter: 'ש' }] },
  { round: 1, id: 'lech-lecha', group: 'verse', pasuk: 'gen-12-1', trad: S, right: 'Read it as written.', wrong: 'Say "Hasem", "Abram" and "arecha", the rest correctly.',
    flag: [{ word: 'הַשֵּׁם', letter: 'ש' }, { word: 'אַבְרָם', letter: 'ב' }, { word: 'אַרְאֶךָּ', letter: 'ך' }] },
  { round: 1, id: 'kol-yaakov', group: 'verse', pasuk: 'gen-27-22', trad: S, right: 'Read it as written.', wrong: 'Say "Eshav" for עֵשָׂו, the rest correctly.',
    flag: [{ word: 'עֵשָׂו', letter: 'ש' }] },
  { round: 1, id: 'az-yashir', group: 'verse', pasuk: 'ex-15-1', trad: S, right: 'Read it as written.', wrong: 'Say "yasir" and "Yishrael", the rest correctly.',
    flag: [{ word: 'יָשִׁיר־', letter: 'ש' }, { word: 'יִשְׂרָאֵל', letter: 'ש' }] },
  { round: 1, id: 'lech-lecha-ashk', group: 'verse', pasuk: 'gen-12-1', trad: A, right: 'Read it as written, Ashkenazic.', wrong: 'Say "u-mi-beit" (t, not s), the rest correctly.',
    flag: [{ word: 'וּמִבֵּית', letter: 'ת' }] },

  // ── Vowels (recorded now, scored later) ──
  { round: 1, id: 'v-biruch', group: 'vowel', text: 'בָּרוּךְ', trad: S, right: 'ba-RUCH', wrong: 'bi-RUCH (kamatz as "i")', flag: [{ word: 'בָּרוּךְ', vowel: 'qamats' }] },
  { round: 1, id: 'v-shalum', group: 'vowel', text: 'שָׁלוֹם', trad: S, right: 'sha-LOM', wrong: 'sha-LUM (cholam as "u")', flag: [{ word: 'שָׁלוֹם', vowel: 'holam' }] },
  { round: 1, id: 'v-bit', group: 'vowel', text: 'בֵּית', trad: S, right: 'BEIT', wrong: 'BIT (tzere as "i")', flag: [{ word: 'בֵּית', vowel: 'tzere' }] },
  { round: 1, id: 'v-omen', group: 'vowel', text: 'אָמֵן', trad: S, right: 'a-MEN', wrong: 'o-MEN (kamatz as "o", Sephardic)', flag: [{ word: 'אָמֵן', vowel: 'qamats' }] },
  { round: 1, id: 'v-arotz', group: 'vowel', text: 'הָאָרֶץ', trad: S, right: 'ha-A-retz', wrong: 'ha-A-rotz (segol as "o")', flag: [{ word: 'הָאָרֶץ', vowel: 'segol' }] },
  { round: 1, id: 'v-otoh', group: 'vowel', text: 'אַתָּה', trad: A, right: 'a-TOH', wrong: 'o-TOH (patach as "o")', flag: [{ word: 'אַתָּה', vowel: 'patah' }] },

  // ── Sheva (recorded now, scored later) ──
  { round: 1, id: 'h-shma', group: 'sheva', text: 'שְׁמַע', trad: S, right: 'she-MA', wrong: 'SHMA (sheva na left out)', flag: [{ word: 'שְׁמַע', vowel: 'sheva-na' }] },
  { round: 1, id: 'h-yisera', group: 'sheva', text: 'יִשְׂרָאֵל', trad: S, right: 'yis-ra-EL', wrong: 'yi-se-ra-EL (sheva nach said)', flag: [{ word: 'יִשְׂרָאֵל', vowel: 'sheva-nach' }] },
  { round: 1, id: 'h-mishpchot', group: 'sheva', text: 'מִשְׁפְּחֹת', trad: S, right: 'mish-pe-CHOT', wrong: 'mish-p-CHOT (sheva na left out)', flag: [{ word: 'מִשְׁפְּחֹת', vowel: 'sheva-na' }] },
  { round: 1, id: 'h-lecha', group: 'sheva', text: 'לְךָ', trad: S, right: 'le-CHA', wrong: 'l-CHA (sheva na left out)', flag: [{ word: 'לְךָ', vowel: 'sheva-na' }] },
  // ═══ Round 2: chosen for coverage ═══
  // Shin and sin
  { round: 2, id: 'r2-shamayim', group: 'shin', text: 'שָׁמַיִם', trad: S, right: 'sha-MA-yim', wrong: 'sa-MA-yim', flag: [{ word: 'שָׁמַיִם', letter: 'ש' }] },
  { round: 2, id: 'r2-ish', group: 'shin', text: 'אִישׁ', trad: S, right: 'ISH', wrong: 'IS', flag: [{ word: 'אִישׁ', letter: 'ש' }] },
  { round: 2, id: 'r2-sade', group: 'shin', text: 'שָׂדֶה', trad: S, right: 'sa-DE', wrong: 'sha-DE', flag: [{ word: 'שָׂדֶה', letter: 'ש' }] },
  { round: 2, id: 'r2-sone', group: 'shin', text: 'שֹׂנֵא', trad: S, right: 'so-NE', wrong: 'sho-NE', flag: [{ word: 'שֹׂנֵא', letter: 'ש' }] },

  // Bet and vet
  { round: 2, id: 'r2-midbar', group: 'bet', text: 'מִדְבָּר', trad: S, right: 'mid-BAR', wrong: 'mid-VAR', flag: [{ word: 'מִדְבָּר', letter: 'ב' }] },
  { round: 2, id: 'r2-shabat', group: 'bet', text: 'שַׁבָּת', trad: S, right: 'sha-BAT', wrong: 'sha-VAT', flag: [{ word: 'שַׁבָּת', letter: 'ב' }] },
  { round: 2, id: 'r2-tova', group: 'bet', text: 'טוֹבָה', trad: S, right: 'to-VA', wrong: 'to-BA', flag: [{ word: 'טוֹבָה', letter: 'ב' }] },
  { round: 2, id: 'r2-lev', group: 'bet', text: 'לֵב', trad: S, right: 'LEV', wrong: 'LEB', flag: [{ word: 'לֵב', letter: 'ב' }] },

  // Kaf and khaf
  { round: 2, id: 'r2-ki', group: 'kaf', text: 'כִּי', trad: S, right: 'KI', wrong: 'CHI', flag: [{ word: 'כִּי', letter: 'כ' }] },
  { round: 2, id: 'r2-malka', group: 'kaf', text: 'מַלְכָּה', trad: S, right: 'mal-KA', wrong: 'mal-CHA', flag: [{ word: 'מַלְכָּה', letter: 'כ' }] },
  { round: 2, id: 'r2-suka', group: 'kaf', text: 'סֻכָּה', trad: S, right: 'su-KA', wrong: 'su-CHA', flag: [{ word: 'סֻכָּה', letter: 'כ' }] },
  { round: 2, id: 'r2-ochel', group: 'kaf', text: 'אֹכֶל', trad: S, right: 'O-chel', wrong: 'O-kel', flag: [{ word: 'אֹכֶל', letter: 'כ' }] },

  // Pe and fe
  { round: 2, id: 'r2-pe', group: 'pe', text: 'פֶּה', trad: S, right: 'PE', wrong: 'FE', flag: [{ word: 'פֶּה', letter: 'פ' }] },
  { round: 2, id: 'r2-mishpat', group: 'pe', text: 'מִשְׁפָּט', trad: S, right: 'mish-PAT', wrong: 'mish-FAT', flag: [{ word: 'מִשְׁפָּט', letter: 'פ' }] },
  { round: 2, id: 'r2-tapuach', group: 'pe', text: 'תַּפּוּחַ', trad: S, right: 'ta-PU-ach', wrong: 'ta-FU-ach', flag: [{ word: 'תַּפּוּחַ', letter: 'פ' }] },
  { round: 2, id: 'r2-sefer', group: 'pe', text: 'סֵפֶר', trad: S, right: 'SE-fer', wrong: 'SE-per', flag: [{ word: 'סֵפֶר', letter: 'פ' }] },
  { round: 2, id: 'r2-af', group: 'pe', text: 'אַף', trad: S, right: 'AF', wrong: 'AP', flag: [{ word: 'אַף', letter: 'ף' }] },

  // Tav and sav
  { round: 2, id: 'r2-emes', group: 'tav', text: 'אֱמֶת', trad: A, right: 'e-MES', wrong: 'e-MET', flag: [{ word: 'אֱמֶת', letter: 'ת' }] },
  { round: 2, id: 'r2-emet', group: 'tav', text: 'אֱמֶת', trad: S, right: 'e-MET', wrong: 'e-MES', flag: [{ word: 'אֱמֶת', letter: 'ת' }] },

  // Vowels the model can hear
  { round: 2, id: 'r2-min', group: 'vowel', text: 'מִן', trad: S, right: 'MIN', wrong: 'MEN (chirik as "e")', flag: [{ word: 'מִן', vowel: 'hiriq' }] },
  { round: 2, id: 'r2-im', group: 'vowel', text: 'אִם', trad: S, right: 'IM', wrong: 'AM (chirik as "a")', flag: [{ word: 'אִם', vowel: 'hiriq' }] },
  { round: 2, id: 'r2-etz', group: 'vowel', text: 'עֵץ', trad: S, right: 'ETZ', wrong: 'ITZ (tzere as "i")', flag: [{ word: 'עֵץ', vowel: 'tzere' }] },
  { round: 2, id: 'r2-malech', group: 'vowel', text: 'מֶלֶךְ', trad: S, right: 'ME-lech', wrong: 'MA-lech (segol as "a")', flag: [{ word: 'מֶלֶךְ', vowel: 'segol' }] },
  { round: 2, id: 'r2-hu', group: 'vowel', text: 'הוּא', trad: S, right: 'HU', wrong: 'HI (shuruk as "i")', flag: [{ word: 'הוּא', vowel: 'shuruk' }] },
  { round: 2, id: 'r2-lo', group: 'vowel', text: 'לֹא', trad: S, right: 'LO', wrong: 'LE (cholam as "e")', flag: [{ word: 'לֹא', vowel: 'holam' }] },
  { round: 2, id: 'r2-ani', group: 'vowel', text: 'אֲנִי', trad: S, right: 'a-NI', wrong: 'e-NI (chataf patach as "e")', flag: [{ word: 'אֲנִי', vowel: 'hataf-patah' }] },
  { round: 2, id: 'r2-elokim', group: 'vowel', text: 'אֱלֹהִים', trad: S, right: 'e-lo-KIM (or e-lo-HIM)', wrong: 'a-lo-KIM (chataf segol as "a")', flag: [{ word: 'אֱלֹהִים', vowel: 'hataf-segol' }] },

  // Vowels it can't tell apart yet
  { round: 2, id: 'r2-lu', group: 'blind', text: 'לוֹ', trad: S, right: 'LO', wrong: 'LU (cholam as "u")', flag: [{ word: 'לוֹ', vowel: 'holam' }] },
  { round: 2, id: 'r2-ota', group: 'blind', text: 'אַתָּה', trad: S, right: 'a-TA', wrong: 'o-TA (patach as "o")', flag: [{ word: 'אַתָּה', vowel: 'patah' }] },

  // Sheva
  { round: 2, id: 'r2-bnei', group: 'sheva', text: 'בְּנֵי', trad: S, right: 'be-NEI', wrong: 'BNEI (sheva na left out)', flag: [{ word: 'בְּנֵי', vowel: 'sheva-na' }] },
  { round: 2, id: 'r2-yishpetu', group: 'sheva', text: 'יִשְׁפְּטוּ', trad: S, right: 'yish-pe-TU', wrong: 'yish-P-TU (second sheva left out)', flag: [{ word: 'יִשְׁפְּטוּ', vowel: 'sheva-na' }] },
  { round: 2, id: 'r2-dvarim', group: 'sheva', text: 'דְּבָרִים', trad: S, right: 'de-va-RIM', wrong: 'DVA-rim (sheva na left out)', flag: [{ word: 'דְּבָרִים', vowel: 'sheva-na' }] },
  { round: 2, id: 'r2-midebar', group: 'sheva', text: 'מִדְבָּר', trad: S, right: 'mid-BAR', wrong: 'mi-de-BAR (vowel added)', flag: [{ word: 'מִדְבָּר', vowel: 'sheva-nach' }] },
  { round: 2, id: 'r2-yitzchak', group: 'sheva', text: 'יִצְחָק', trad: S, right: 'yitz-CHAK', wrong: 'yi-tze-CHAK (vowel added)', flag: [{ word: 'יִצְחָק', vowel: 'sheva-nach' }] },
  { round: 2, id: 'r2-maleka', group: 'sheva', text: 'מַלְכָּה', trad: S, right: 'mal-KA', wrong: 'ma-le-KA (vowel added)', flag: [{ word: 'מַלְכָּה', vowel: 'sheva-nach' }] },

  // Whole verses
  { round: 2, id: 'r2-bereshit', group: 'verse', text: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ', trad: S, right: 'Read it as written (Genesis 1:1).', wrong: 'Say "hasamayim" and "ha-A-ratz", the rest correctly.',
    flag: [{ word: 'הַשָּׁמַיִם', letter: 'ש' }, { word: 'הָאָרֶץ', vowel: 'segol' }] },
  { round: 2, id: 'r2-darkei', group: 'verse', pasuk: 'prov-3-17', trad: S, right: 'Read it as written.', wrong: 'Say "da-re-CHEI" and "ne-ti-BO-te-ha", the rest correctly.',
    flag: [{ word: 'דַרְכֵי־', vowel: 'sheva-nach' }, { word: 'נְתִיבוֹתֶיהָ', letter: 'ב' }] },
  { round: 2, id: 'r2-veeescha', group: 'verse', pasuk: 'gen-12-2', trad: S, right: 'Read it as written.', wrong: 'Say "ve-e-esh-CHA" and "va-a-BA-rech-cha", the rest correctly.',
    flag: [{ word: 'וְאֶעֶשְׂךָ', letter: 'ש' }, { word: 'וַאֲבָרֶכְךָ', letter: 'ב' }] },
  // ═══ Round 3: o vs u, and how students really read (per reader) ═══
  // O and u, both directions, every spelling
  { round: 3, id: 'r3-lo', group: 'ou', text: 'לוֹ', trad: S, right: 'LOH', wrong: 'LOO', flag: [{ word: 'לוֹ', vowel: 'holam' }] },
  { round: 3, id: 'r3-lu', group: 'ou', text: 'לוּ', trad: S, right: 'LOO', wrong: 'LOH', flag: [{ word: 'לוּ', vowel: 'shuruk' }] },
  { round: 3, id: 'r3-hu', group: 'ou', text: 'הוּא', trad: S, right: 'HOO', wrong: 'HOH', flag: [{ word: 'הוּא', vowel: 'shuruk' }] },
  { round: 3, id: 'r3-yom', group: 'ou', text: 'יוֹם', trad: S, right: 'YOHM', wrong: 'YOOM', flag: [{ word: 'יוֹם', vowel: 'holam' }] },
  { round: 3, id: 'r3-kum', group: 'ou', text: 'קוּם', trad: S, right: 'KOOM', wrong: 'KOHM', flag: [{ word: 'קוּם', vowel: 'shuruk' }] },
  { round: 3, id: 'r3-tov', group: 'ou', text: 'טוֹב', trad: S, right: 'TOHV', wrong: 'TOOV', flag: [{ word: 'טוֹב', vowel: 'holam' }] },
  { round: 3, id: 'r3-or', group: 'ou', text: 'אוֹר', trad: S, right: 'OHR', wrong: 'OOR', flag: [{ word: 'אוֹר', vowel: 'holam' }] },
  { round: 3, id: 'r3-moshe', group: 'ou', text: 'מֹשֶׁה', trad: S, right: 'moh-SHEH', wrong: 'moo-SHEH (cholam with no vav, said as "oo")', flag: [{ word: 'מֹשֶׁה', vowel: 'holam' }] },
  { round: 3, id: 'r3-kulam', group: 'ou', text: 'כֻּלָּם', trad: S, right: 'koo-LAHM', wrong: 'koh-LAHM (kubutz said as "oh")', flag: [{ word: 'כֻּלָּם', vowel: 'qubuts' }] },
  { round: 3, id: 'r3-baruch', group: 'ou', text: 'בָּרוּךְ', trad: S, right: 'bah-ROOCH', wrong: 'bah-ROHCH', flag: [{ word: 'בָּרוּךְ', vowel: 'shuruk' }] },
  { round: 3, id: 'r3-gadol', group: 'ou', text: 'גָּדוֹל', trad: S, right: 'gah-DOHL', wrong: 'gah-DOOL', flag: [{ word: 'גָּדוֹל', vowel: 'holam' }] },
  { round: 3, id: 'r3-shalom', group: 'ou', text: 'שָׁלוֹם', trad: S, right: 'shah-LOHM', wrong: 'shah-LOOM', flag: [{ word: 'שָׁלוֹם', vowel: 'holam' }] },
  { round: 3, id: 'r3-tora', group: 'ou', text: 'תּוֹרָה', trad: S, right: 'toh-RAH', wrong: 'too-RAH', flag: [{ word: 'תּוֹרָה', vowel: 'holam' }] },

  // How students really read: Shema, with something else going on
  { round: 3, id: 'r3-pause', group: 'reading', pasuk: 'deut-6-4', trad: S, right: 'Read it, pausing 3 seconds after יִשְׂרָאֵל.', wrong: 'Same pause, and say "Sema".', flag: [{ word: 'שְׁמַע', letter: 'ש' }] },
  { round: 3, id: 'r3-um', group: 'reading', pasuk: 'deut-6-4', trad: S, right: 'Read it, saying "um" once in the middle.', wrong: 'Same "um", and say "Yishrael".', flag: [{ word: 'יִשְׂרָאֵל', letter: 'ש' }] },
  { round: 3, id: 'r3-repeat', group: 'reading', pasuk: 'deut-6-4', trad: S, right: 'Read it, saying יִשְׂרָאֵל twice ("Yisrael, Yisrael").', wrong: 'Same repeat, and say "Hasem" both times.', flag: [{ word: 'הַשֵּׁם', letter: 'ש' }] },
  { round: 3, id: 'r3-restart', group: 'reading', pasuk: 'deut-6-4', trad: S, right: 'Read "Shema Yisrael", stop, then start again and read it all.', wrong: 'Start with "Sema Yisrael", stop, then read it all correctly. (Self-corrected: should pass.)', flag: [] },
  { round: 3, id: 'r3-fast', group: 'reading', pasuk: 'deut-6-4', trad: S, right: 'Read it as fast as you can.', wrong: 'As fast, and say "Sema".', flag: [{ word: 'שְׁמַע', letter: 'ש' }] },
  { round: 3, id: 'r3-quiet', group: 'reading', pasuk: 'deut-6-4', trad: S, right: 'Read it very quietly, almost a whisper.', wrong: 'As quietly, and say "Yishrael".', flag: [{ word: 'יִשְׂרָאֵל', letter: 'ש' }] },
  { round: 3, id: 'r3-far', group: 'reading', pasuk: 'deut-6-4', trad: S, right: 'Read it from across the room.', wrong: 'From as far, and say "Hasem".', flag: [{ word: 'הַשֵּׁם', letter: 'ש' }] },
  { round: 3, id: 'r3-noise', group: 'reading', pasuk: 'deut-6-4', trad: S, right: 'Read it with music or TV on in the background.', wrong: 'Same noise, and say "Sema".', flag: [{ word: 'שְׁמַע', letter: 'ש' }] },
  { round: 3, id: 'r3-skip', group: 'reading', pasuk: 'deut-6-4', trad: S, wrong: 'Leave out אֱלֹהֵינוּ, the rest correctly.', flag: [{ word: 'אֱלֹהֵינוּ', problem: 'skipped' }] },
  { round: 3, id: 'r3-wrongword', group: 'reading', pasuk: 'deut-6-4', trad: S, wrong: 'Say "gadol" instead of אֶחָד, the rest correctly.', flag: [{ word: 'אֶחָד', problem: 'wrong word' }] },
  // ═══ Round 4: long words, dropped prefixes, look-alike letters, endings ═══
  // Long words
  { round: 4, id: 'r4-yishtachavu', group: 'long', text: 'וַיִּשְׁתַּחֲווּ', trad: S, right: 'va-yish-ta-cha-VOO', wrong: 'va-yish-ta-VOO ("cha" left out)', flag: [{ word: 'וַיִּשְׁתַּחֲווּ', problem: 'syllable left out' }] },
  { round: 4, id: 'r4-mishpechot', group: 'long', text: 'לְמִשְׁפְּחֹתֵיהֶם', trad: S, right: 'le-mish-pe-choh-tei-HEM', wrong: 'le-mish-pe-cheh-tei-HEM (cholam as "eh")', flag: [{ word: 'לְמִשְׁפְּחֹתֵיהֶם', vowel: 'holam' }] },
  { round: 4, id: 'r4-mishpechot-drop', group: 'long', text: 'לְמִשְׁפְּחֹתֵיהֶם', trad: S, right: 'le-mish-pe-choh-tei-HEM', wrong: 'le-mish-pe-choh-HEM ("tei" left out)', flag: [{ word: 'לְמִשְׁפְּחֹתֵיהֶם', problem: 'syllable left out' }] },
  { round: 4, id: 'r4-hitkadishtem', group: 'long', text: 'וְהִתְקַדִּשְׁתֶּם', trad: S, right: 've-hit-ka-dish-TEM', wrong: 've-hit-ka-di-sheh-TEM (vowel added after ש)', flag: [{ word: 'וְהִתְקַדִּשְׁתֶּם', vowel: 'sheva-nach' }] },
  { round: 4, id: 'r4-nafshecha', group: 'long', text: 'וּבְכָל־נַפְשְׁךָ', trad: S, right: 'oo-ve-chol naf-she-CHA', wrong: "oo-ve-chol naf-sh'-CHA (the sheva rushed, barely said)", flag: [{ word: 'נַפְשְׁךָ', vowel: 'sheva-na' }] },
  { round: 4, id: 'r4-ahavta', group: 'long', text: 'וְאָהַבְתָּ', trad: S, right: 've-a-hav-TA', wrong: 've-a-ha-veh-TA (vowel added after ב)', flag: [{ word: 'וְאָהַבְתָּ', vowel: 'sheva-nach' }] },
  { round: 4, id: 'r4-vaychulu', group: 'long', text: 'וַיְכֻלּוּ', trad: S, right: 'vay-choo-LOO', wrong: 'vay-choh-LOO (kubutz as "oh")', flag: [{ word: 'וַיְכֻלּוּ', vowel: 'qubuts' }] },

  // Dropped prefixes
  { round: 4, id: 'r4-hashamayim', group: 'prefix', text: 'הַשָּׁמַיִם', trad: S, right: 'ha-sha-MA-yim', wrong: 'sha-MA-yim ("ha-" left out)', flag: [{ word: 'הַשָּׁמַיִם', problem: 'prefix left out' }] },
  { round: 4, id: 'r4-veet', group: 'prefix', text: 'וְאֵת', trad: S, right: 've-ET', wrong: 'ET ("ve-" left out)', flag: [{ word: 'וְאֵת', problem: 'prefix left out' }] },
  { round: 4, id: 'r4-umibeit', group: 'prefix', text: 'וּמִבֵּית', trad: S, right: 'oo-mi-BEIT', wrong: 'mi-BEIT ("oo-" left out)', flag: [{ word: 'וּמִבֵּית', problem: 'prefix left out' }] },
  { round: 4, id: 'r4-laaretz', group: 'prefix', text: 'לָאָרֶץ', trad: S, right: 'la-A-retz', wrong: 'A-retz ("la-" left out)', flag: [{ word: 'לָאָרֶץ', problem: 'prefix left out' }] },

  // Look-alike letters
  { round: 4, id: 'r4-davar', group: 'letters', text: 'דָּבָר', trad: S, right: 'da-VAR', wrong: 'ra-VAR (ד read as ר)', flag: [{ word: 'דָּבָר', letter: 'ד' }] },
  { round: 4, id: 'r4-raah', group: 'letters', text: 'רָאָה', trad: S, right: 'ra-AH', wrong: 'da-AH (ר read as ד)', flag: [{ word: 'רָאָה', letter: 'ר' }] },
  { round: 4, id: 'r4-bara', group: 'letters', text: 'בָּרָא', trad: S, right: 'ba-RA', wrong: 'ka-RA (בּ read as כּ)', flag: [{ word: 'בָּרָא', letter: 'ב' }] },
  { round: 4, id: 'r4-halach', group: 'letters', text: 'הָלַךְ', trad: S, right: 'ha-LACH', wrong: 'cha-LACH (ה read as ח)', flag: [{ word: 'הָלַךְ', letter: 'ה' }] },
  { round: 4, id: 'r4-vayomer', group: 'letters', text: 'וַיֹּאמֶר', trad: S, right: 'va-YOH-mer', wrong: 'za-YOH-mer (ו read as ז)', flag: [{ word: 'וַיֹּאמֶר', letter: 'ו' }] },
  { round: 4, id: 'r4-sus', group: 'letters', text: 'סוּס', trad: S, right: 'SOOS', wrong: 'MOOS (ס read as ם)', flag: [{ word: 'סוּס', letter: 'ס' }] },
  { round: 4, id: 'r4-gadol', group: 'letters', text: 'גָּדוֹל', trad: S, right: 'ga-DOHL', wrong: 'na-DOHL (ג read as נ)', flag: [{ word: 'גָּדוֹל', letter: 'ג' }] },

  // Sounds English speakers get wrong
  { round: 4, id: 'r4-chesed', group: 'english', text: 'חֶסֶד', trad: S, right: 'CHE-sed', wrong: 'HE-sed (ח as "h")', flag: [{ word: 'חֶסֶד', letter: 'ח' }] },
  { round: 4, id: 'r4-chayim', group: 'english', text: 'חַיִּים', trad: S, right: 'cha-YIM', wrong: 'ha-YIM (ח as "h")', flag: [{ word: 'חַיִּים', letter: 'ח' }] },
  { round: 4, id: 'r4-tzadik', group: 'english', text: 'צַדִּיק', trad: S, right: 'tza-DIK', wrong: 'sa-DIK (צ as "s")', flag: [{ word: 'צַדִּיק', letter: 'צ' }] },
  { round: 4, id: 'r4-tziyon', group: 'english', text: 'צִיּוֹן', trad: S, right: 'tzi-YOHN', wrong: 'zi-YOHN (צ as "z")', flag: [{ word: 'צִיּוֹן', letter: 'צ' }] },
  { round: 4, id: 'r4-artzah', group: 'english', text: 'אַרְצָהּ', trad: S, right: 'ar-TZAH (the final h heard)', wrong: 'ar-TZA (the final h dropped)', flag: [], ungraded: 'The final h of הּ isn\'t graded.' },

  // Word endings
  { round: 4, id: 'r4-ruach', group: 'endings', text: 'רוּחַ', trad: S, right: 'ROO-ach', wrong: 'ROO-cha (patach after the ח)', flag: [{ word: 'רוּחַ', problem: 'patach genuvah' }] },
  { round: 4, id: 'r4-sameach', group: 'endings', text: 'שָׂמֵחַ', trad: S, right: 'sa-MEH-ach', wrong: 'sa-MEH-cha (patach after the ח)', flag: [{ word: 'שָׂמֵחַ', problem: 'patach genuvah' }] },
  { round: 4, id: 'r4-at', group: 'endings', text: 'אַתְּ', trad: S, right: 'AT', wrong: 'A-ta (vowel added at the end)', flag: [{ word: 'אַתְּ', problem: 'vowel added at the end' }] },
  { round: 4, id: 'r4-lech', group: 'endings', text: 'לֵךְ', trad: S, right: 'LECH', wrong: 'LE-cheh (vowel added at the end)', flag: [{ word: 'לֵךְ', problem: 'vowel added at the end' }] },
  { round: 4, id: 'r4-alav', group: 'endings', text: 'עָלָיו', trad: S, right: 'a-LAV', wrong: 'a-LAI-yoo', flag: [{ word: 'עָלָיו', problem: '-av ending' }] },
  { round: 4, id: 'r4-elav', group: 'endings', text: 'אֵלָיו', trad: S, right: 'e-LAV', wrong: 'e-LAI-yoo', flag: [{ word: 'אֵלָיו', problem: '-av ending' }] },

  // Whole verses, each with three mistakes
  { round: 4, id: 'r4-veahavta', group: 'verse', text: 'וְאָהַבְתָּ אֵת הַשֵּׁם אֱלֹהֶיךָ בְּכָל־לְבָבְךָ וּבְכָל־נַפְשְׁךָ וּבְכָל־מְאֹדֶךָ', trad: S, right: 'Read it as written (Deut 6:5).',
    wrong: 'Say "Elokech" (the end of אֱלֹהֶיךָ left out), "naf-sh\'-CHA" (the sheva rushed), and "be-chol" for the last וּבְכָל־ ("oo-" left out).',
    flag: [{ word: 'אֱלֹהֶיךָ', vowel: 'qamats' }, { word: 'נַפְשְׁךָ', vowel: 'sheva-na' }, { word: 'וּבְכָל־', problem: 'prefix left out' }] },
  { round: 4, id: 'r4-tohu', group: 'verse', text: 'וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל־פְּנֵי תְהוֹם וְרוּחַ אֱלֹהִים מְרַחֶפֶת עַל־פְּנֵי הַמָּיִם', trad: S, right: 'Read it as written (Gen 1:2).',
    wrong: 'Say "ve-HOH-shech" (ח as "h"), "te-HOOM" (cholam as "oo"), and "ve-roo-CHA" (patach after the ח).',
    flag: [{ word: 'וְחֹשֶׁךְ', letter: 'ח' }, { word: 'תְהוֹם', vowel: 'holam' }, { word: 'וְרוּחַ', problem: 'patach genuvah' }] },
]

// Does a scored sound match a flag in `item.flag`? Ignores maqef and
// final-letter forms.
const BASE = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }
const sameWord = (a, b) => a.replace(/־/g, '') === b.replace(/־/g, '')
export const matchesFlag = (flag, s) => sameWord(flag.word, s.word) && (flag.problem
  ? s.test === flag.problem
  : flag.vowel
  ? (flag.vowel.startsWith('sheva') ? s.kind === flag.vowel : ['vowel', 'vowel-ou', 'vowel-missing'].includes(s.kind) && s.test === flag.vowel)
  : ['consonant', 'letter'].includes(s.kind) && (BASE[flag.letter] ?? flag.letter) === (BASE[s.letter] ?? s.letter))
