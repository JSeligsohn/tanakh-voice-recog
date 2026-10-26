// What to record on the test bench. Each item is read twice: as written
// ("right"), and with the stated mistake ("wrong"). `flag` names what the
// mistake should be caught on; a right reading should have no flags.
//
//   { id, round, group, text | pasuk, trad, right: how to say it, wrong: the mistake,
//     flag: [{ word, letter }            a consonant
//            | { word, vowel }           a vowel, by nikkud name (hiriq, tzere, ...)
//            | { word, vowel: 'sheva-na' | 'sheva-nach' }] }
//
// Round 1 came from the app's verses; round 2 is chosen for coverage: each
// letter pair in every position (start, after a sheva, doubled, soft, final),
// the vowel contrasts the model can hear, and each kind of sheva. The page
// shows the latest round; earlier takes are kept and still re-scored.

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
  { id: 'verse', title: 'Whole verses' },
]

export const latestRound = 2

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
]

// Does a scored sound match a flag in `item.flag`? Ignores maqef and
// final-letter forms.
const BASE = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }
const sameWord = (a, b) => a.replace(/־/g, '') === b.replace(/־/g, '')
export const matchesFlag = (flag, s) => sameWord(flag.word, s.word) && (flag.vowel
  ? (flag.vowel.startsWith('sheva') ? s.kind === flag.vowel : s.kind === 'vowel' && s.test === flag.vowel)
  : s.kind === 'consonant' && (BASE[flag.letter] ?? flag.letter) === (BASE[s.letter] ?? s.letter))
