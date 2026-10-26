// What to record on the test bench. Each item is read twice: as written
// ("right"), and with the stated mistake ("wrong"). `flag` names the word and
// letter the mistake should be caught on; a right reading should have no
// flags. `later` items (vowels, sheva) are recorded now and scored once the
// vowel step is built.
//
//   { id, group, text, trad, right: how to say it, wrong: the mistake, flag: [{ word, letter }] }

export const groups = [
  { id: 'shin', title: 'Shin and sin', note: 'Including the familiar words gpt-audio always "corrects".' },
  { id: 'bet', title: 'Bet and vet' },
  { id: 'kaf', title: 'Kaf and khaf' },
  { id: 'pe', title: 'Pe and fe' },
  { id: 'soft', title: 'Soft letter after a vowel-ending word', note: 'The letter has no dot because the word before ends in a vowel.' },
  { id: 'tav', title: 'Tav and sav', note: 'Ashkenazic: ת without a dot is "s"; with a dot it is "t" in every tradition.' },
  { id: 'verse', title: 'Whole verses' },
  { id: 'vowel', title: 'Vowels (scored in the next step)', later: true },
  { id: 'sheva', title: 'Sheva (scored in the next step)', later: true },
]

const S = 'sephardic', A = 'ashkenazic'

export const items = [
  // ── Shin and sin ──
  { id: 'shana', group: 'shin', text: 'שָׁנָה', trad: S, right: 'sha-NA', wrong: 'sa-NA', flag: [{ word: 'שָׁנָה', letter: 'ש' }] },
  { id: 'yisrael', group: 'shin', text: 'יִשְׂרָאֵל', trad: S, right: 'yis-ra-EL', wrong: 'yish-ra-EL', flag: [{ word: 'יִשְׂרָאֵל', letter: 'ש' }] },
  { id: 'esav', group: 'shin', text: 'עֵשָׂו', trad: S, right: 'e-SAV', wrong: 'e-SHAV', flag: [{ word: 'עֵשָׂו', letter: 'ש' }] },
  { id: 'yashir', group: 'shin', text: 'יָשִׁיר', trad: S, right: 'ya-SHIR', wrong: 'ya-SIR', flag: [{ word: 'יָשִׁיר', letter: 'ש' }] },
  { id: 'moshe', group: 'shin', text: 'מֹשֶׁה', trad: S, right: 'mo-SHE', wrong: 'mo-SE', flag: [{ word: 'מֹשֶׁה', letter: 'ש' }] },
  { id: 'sarai', group: 'shin', text: 'שָׂרַי', trad: S, right: 'sa-RAI', wrong: 'sha-RAI', flag: [{ word: 'שָׂרַי', letter: 'ש' }] },
  { id: 'shalom', group: 'shin', text: 'שָׁלוֹם', trad: S, right: 'sha-LOM', wrong: 'sa-LOM', flag: [{ word: 'שָׁלוֹם', letter: 'ש' }] },
  { id: 'asa', group: 'shin', text: 'עָשָׂה', trad: S, right: 'a-SA', wrong: 'a-SHA', flag: [{ word: 'עָשָׂה', letter: 'ש' }] },

  // ── Bet and vet ──
  { id: 'baruch', group: 'bet', text: 'בָּרוּךְ', trad: S, right: 'ba-RUCH', wrong: 'va-RUCH', flag: [{ word: 'בָּרוּךְ', letter: 'ב' }] },
  { id: 'avram', group: 'bet', text: 'אַבְרָם', trad: S, right: 'av-RAM', wrong: 'ab-RAM', flag: [{ word: 'אַבְרָם', letter: 'ב' }] },
  { id: 'avicha', group: 'bet', text: 'אָבִיךָ', trad: S, right: 'a-VI-cha', wrong: 'a-BI-cha', flag: [{ word: 'אָבִיךָ', letter: 'ב' }] },
  { id: 'umibeit', group: 'bet', text: 'וּמִבֵּית', trad: S, right: 'u-mi-BEIT', wrong: 'u-mi-VEIT', flag: [{ word: 'וּמִבֵּית', letter: 'ב' }] },

  // ── Kaf and khaf ──
  { id: 'kol', group: 'kaf', text: 'כֹּל', trad: S, right: 'KOL', wrong: 'CHOL', flag: [{ word: 'כֹּל', letter: 'כ' }] },
  { id: 'melech', group: 'kaf', text: 'מֶלֶךְ', trad: S, right: 'ME-lech', wrong: 'ME-lek', flag: [{ word: 'מֶלֶךְ', letter: 'ך' }] },
  { id: 'lecha', group: 'kaf', text: 'לְךָ', trad: S, right: 'le-CHA', wrong: 'le-KA', flag: [{ word: 'לְךָ', letter: 'ך' }] },
  { id: 'areka', group: 'kaf', text: 'אַרְאֶךָּ', trad: S, right: 'ar-E-ka', wrong: 'ar-E-cha', flag: [{ word: 'אַרְאֶךָּ', letter: 'ך' }] },

  // ── Pe and fe ──
  { id: 'paro', group: 'pe', text: 'פַּרְעֹה', trad: S, right: 'par-O', wrong: 'far-O', flag: [{ word: 'פַּרְעֹה', letter: 'פ' }] },
  { id: 'nefesh', group: 'pe', text: 'נֶפֶשׁ', trad: S, right: 'NE-fesh', wrong: 'NE-pesh', flag: [{ word: 'נֶפֶשׁ', letter: 'פ' }] },
  { id: 'yosef', group: 'pe', text: 'יוֹסֵף', trad: S, right: 'yo-SEF', wrong: 'yo-SEP', flag: [{ word: 'יוֹסֵף', letter: 'ף' }] },

  // ── Soft letter after a vowel-ending word ──
  { id: 'vinyamin', group: 'soft', text: 'צַוְּארֵי בִנְיָמִן', trad: S, right: 'tza-ve-REI vin-YA-min', wrong: 'tza-ve-REI bin-YA-min', flag: [{ word: 'בִנְיָמִן', letter: 'ב' }] },
  { id: 'chen', group: 'soft', text: 'וַיְהִי־כֵן', trad: S, right: 'vay-HI CHEN', wrong: 'vay-HI KEN', flag: [{ word: 'כֵן', letter: 'כ' }] },
  { id: 'vou', group: 'soft', text: 'וּלְכוּ־בֹאוּ', trad: S, right: 'ul-CHU VO-u', wrong: 'ul-CHU BO-u', flag: [{ word: 'בֹאוּ', letter: 'ב' }] },

  // ── Tav and sav ──
  { id: 'beis', group: 'tav', text: 'וּמִבֵּית', trad: A, right: 'u-mi-BEIS', wrong: 'u-mi-BEIT', flag: [{ word: 'וּמִבֵּית', letter: 'ת' }] },
  { id: 'bereishis', group: 'tav', text: 'בְּרֵאשִׁית', trad: A, right: 'be-rei-SHIS', wrong: 'be-rei-SHIT', flag: [{ word: 'בְּרֵאשִׁית', letter: 'ת' }] },
  { id: 'bereshit', group: 'tav', text: 'בְּרֵאשִׁית', trad: S, right: 'be-re-SHIT', wrong: 'be-re-SHIS', flag: [{ word: 'בְּרֵאשִׁית', letter: 'ת' }] },
  { id: 'torah', group: 'tav', text: 'תּוֹרָה', trad: A, right: 'TOI-ro (or TOH-raw)', wrong: 'SOI-ro', flag: [{ word: 'תּוֹרָה', letter: 'ת' }] },

  // ── Whole verses ──
  { id: 'shema', group: 'verse', pasuk: 'deut-6-4', trad: S, right: 'Read it as written.', wrong: 'Say "Sema Yishrael", the rest correctly.',
    flag: [{ word: 'שְׁמַע', letter: 'ש' }, { word: 'יִשְׂרָאֵל', letter: 'ש' }] },
  { id: 'lech-lecha', group: 'verse', pasuk: 'gen-12-1', trad: S, right: 'Read it as written.', wrong: 'Say "Hasem", "Abram" and "arecha", the rest correctly.',
    flag: [{ word: 'הַשֵּׁם', letter: 'ש' }, { word: 'אַבְרָם', letter: 'ב' }, { word: 'אַרְאֶךָּ', letter: 'ך' }] },
  { id: 'kol-yaakov', group: 'verse', pasuk: 'gen-27-22', trad: S, right: 'Read it as written.', wrong: 'Say "Eshav" for עֵשָׂו, the rest correctly.',
    flag: [{ word: 'עֵשָׂו', letter: 'ש' }] },
  { id: 'az-yashir', group: 'verse', pasuk: 'ex-15-1', trad: S, right: 'Read it as written.', wrong: 'Say "yasir" and "Yishrael", the rest correctly.',
    flag: [{ word: 'יָשִׁיר־', letter: 'ש' }, { word: 'יִשְׂרָאֵל', letter: 'ש' }] },
  { id: 'lech-lecha-ashk', group: 'verse', pasuk: 'gen-12-1', trad: A, right: 'Read it as written, Ashkenazic.', wrong: 'Say "u-mi-beit" (t, not s), the rest correctly.',
    flag: [{ word: 'וּמִבֵּית', letter: 'ת' }] },

  // ── Vowels (recorded now, scored later) ──
  { id: 'v-biruch', group: 'vowel', text: 'בָּרוּךְ', trad: S, right: 'ba-RUCH', wrong: 'bi-RUCH (kamatz as "i")', flag: [{ word: 'בָּרוּךְ', vowel: 'qamats' }] },
  { id: 'v-shalum', group: 'vowel', text: 'שָׁלוֹם', trad: S, right: 'sha-LOM', wrong: 'sha-LUM (cholam as "u")', flag: [{ word: 'שָׁלוֹם', vowel: 'holam' }] },
  { id: 'v-bit', group: 'vowel', text: 'בֵּית', trad: S, right: 'BEIT', wrong: 'BIT (tzere as "i")', flag: [{ word: 'בֵּית', vowel: 'tzere' }] },
  { id: 'v-omen', group: 'vowel', text: 'אָמֵן', trad: S, right: 'a-MEN', wrong: 'o-MEN (kamatz as "o", Sephardic)', flag: [{ word: 'אָמֵן', vowel: 'qamats' }] },
  { id: 'v-arotz', group: 'vowel', text: 'הָאָרֶץ', trad: S, right: 'ha-A-retz', wrong: 'ha-A-rotz (segol as "o")', flag: [{ word: 'הָאָרֶץ', vowel: 'segol' }] },
  { id: 'v-otoh', group: 'vowel', text: 'אַתָּה', trad: A, right: 'a-TOH', wrong: 'o-TOH (patach as "o")', flag: [{ word: 'אַתָּה', vowel: 'patah' }] },

  // ── Sheva (recorded now, scored later) ──
  { id: 'h-shma', group: 'sheva', text: 'שְׁמַע', trad: S, right: 'she-MA', wrong: 'SHMA (sheva na left out)', flag: [{ word: 'שְׁמַע', vowel: 'sheva' }] },
  { id: 'h-yisera', group: 'sheva', text: 'יִשְׂרָאֵל', trad: S, right: 'yis-ra-EL', wrong: 'yi-se-ra-EL (sheva nach said)', flag: [{ word: 'יִשְׂרָאֵל', vowel: 'sheva' }] },
  { id: 'h-mishpchot', group: 'sheva', text: 'מִשְׁפְּחֹת', trad: S, right: 'mish-pe-CHOT', wrong: 'mish-p-CHOT (sheva na left out)', flag: [{ word: 'מִשְׁפְּחֹת', vowel: 'sheva' }] },
  { id: 'h-lecha', group: 'sheva', text: 'לְךָ', trad: S, right: 'le-CHA', wrong: 'l-CHA (sheva na left out)', flag: [{ word: 'לְךָ', vowel: 'sheva' }] },
]
