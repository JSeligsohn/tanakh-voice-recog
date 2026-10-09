// Expected pronunciation per word: what the rules engine says a word should
// sound like, as the Latin string the student's reading is graded against.
//
// Each row: { word, seph?, ashk?, rule, review?, todo? }
//   seph / ashk — expected output for that tradition (omit to skip it)
//   rule        — what the case exercises, shown in the test name
//   review      — a judgment call a teacher should confirm; the test still runs
//   todo        — a known gap: the test runs but a failure doesn't fail the suite
//
// Only nikud matters here; cantillation marks are ignored by the tokenizer.

export const expectedCases = [
  // ── Consonants ─────────────────────────────────────────────────────
  { word: 'בָּרָא', seph: 'bara', ashk: 'boro', rule: 'בּ with dagesh = b' },
  { word: 'אָב', seph: 'av', rule: 'ב without dagesh = v' },
  { word: 'כִּי', seph: 'ki', rule: 'כּ with dagesh = k' },
  { word: 'לֵךְ', seph: 'lech', rule: 'final ך = ch' },
  { word: 'אַף', seph: 'af', rule: 'final ף = f' },
  { word: 'פֶּה', seph: 'pe', rule: 'פּ = p; final ה silent' },
  { word: 'שָׂרָה', seph: 'sara', rule: 'שׂ (sin) = s' },
  { word: 'שֵׁם', seph: 'shem', rule: 'שׁ (shin) = sh' },
  { word: 'צֶדֶק', seph: 'tsedek', rule: 'צ = ts' },
  { word: 'חַי', seph: 'chay', rule: 'ח = ch; final consonantal yud' },
  { word: 'עַם', seph: 'am', rule: 'ע silent' },
  { word: 'אֱלֹהִים', seph: 'elohim', rule: 'א silent; hataf segol' },
  { word: 'יָדָהּ', seph: 'yadah', rule: 'mappiq הּ is sounded' },
  { word: 'שַׁבָּת', seph: 'shabat', ashk: 'shabos', rule: 'ת without dagesh: t (Seph) / s (Ashk)' },
  { word: 'תּוֹרָה', seph: 'tora', ashk: 'toro', rule: 'תּ with dagesh = t in both',
    review: 'Ashkenazic canonical "toro"; many readers say "toyre"' },

  // ── Vowel letters (malei) ──────────────────────────────────────────
  { word: 'שָׁלוֹם', seph: 'shalom', ashk: 'sholom', rule: 'holam malei' },
  { word: 'לִי', seph: 'li', rule: 'chirik malei — yud is silent' },
  { word: 'וּמִבֵּית', seph: 'umibet', rule: 'standalone shuruk; tzere malei' },
  { word: 'רוּחַ', seph: 'ruach', rule: 'shuruk on a vav' },
  { word: 'וַיֹּאמֶר', seph: 'vayomer', rule: 'consonantal vav and yud; silent alef' },
  { word: 'אֵלָיו', seph: 'elav', ashk: 'elov', rule: 'ָיו suffix: yud silent, vav = v' },
  { word: 'יָדָיו', seph: 'yadav', rule: 'ָיו suffix: yud silent, vav = v' },
  { word: 'חַיָּיו', seph: 'chayav', rule: 'ָיו suffix after a consonantal yud' },
  { word: 'עָלָיו', seph: 'alav', rule: 'ָיו suffix' },

  // ── Sheva ──────────────────────────────────────────────────────────
  { word: 'בְּרֵאשִׁית', seph: 'bereshit', ashk: 'bereshis', rule: 'S1 sheva na at word start' },
  { word: 'יִשְׂרָאֵל', seph: 'yisrael', rule: 'S3 sheva nach after a short vowel' },
  { word: 'מִדְבָּר', seph: 'midbar', rule: 'S3 sheva nach; dagesh kal after it' },
  { word: 'וַיִּשְׁמְרוּ', seph: 'vayishmeru', rule: 'S6 two shevas: nach then na' },
  { word: 'הִנְנִי', seph: 'hineni', rule: 'S4 sheva under the first of two identical letters' },
  { word: 'הַלְלוּ', seph: 'halelu', rule: 'S4 identical letters' },
  { word: 'לֶךְ־לְךָ', seph: 'lechlecha', rule: 'S5 nach at maqef end; S1 na after maqef' },
  { word: 'אֶת־בְּנוֹ', seph: 'etbeno', rule: 'S1 na at the start of a maqef component' },
  { word: 'שׁוֹמְרִים', seph: 'shomerim', rule: 'S2 sheva after a long vowel: shown vocal, silent also accepted' },
  { word: 'הַמְּלָכִים', seph: 'hamelachim', rule: 'sheva under a dagesh chazak is na',
    todo: 'no rule yet for sheva under dagesh chazak — engine gives "hamlachim"' },

  // ── Patach genuvah ─────────────────────────────────────────────────
  { word: 'רוּחַ', seph: 'ruach', rule: 'patach genuvah under final ח' },
  { word: 'נֹחַ', seph: 'noach', rule: 'patach genuvah after holam' },
  { word: 'שָׂמֵחַ', seph: 'sameach', rule: 'patach genuvah after tzere' },
  { word: 'יָדוּעַ', seph: 'yadua', rule: 'patach genuvah under final ע' },
  { word: 'גָּבֹהַּ', seph: 'gavoah', rule: 'patach genuvah under mappiq הּ' },

  // ── Qamats gadol / katan ───────────────────────────────────────────
  { word: 'כָּל־הָאָרֶץ', seph: 'kolhaarets', ashk: 'kolhoorets', rule: 'QK2 katan before maqef' },
  { word: 'צָהֳרַיִם', seph: 'tsohorayim', rule: 'QK3 katan before hataf qamats' },
  { word: 'וַיָּקָם', seph: 'vayakom', rule: 'QK4 hollow vayyiqtol' },
  { word: 'חָנֵּנִי', seph: 'choneni', rule: 'QK5 katan before dagesh chazak' },
  { word: 'שָׁמָּה', seph: 'shama', rule: 'QK5 exception: stressed (directional ה)' },
  { word: 'בָּתִּים', seph: 'batim', rule: 'QK5 exception: בָּתִּים' },
  { word: 'חָכְמָה', seph: 'chochma', rule: 'QK6 known katan word' },
  { word: 'קָרְבָּן', seph: 'korban', rule: 'QK6 known katan word' },
  { word: 'חׇכְמָה', seph: 'chochma', rule: 'QK0 explicit qamats katan sign' },
  { word: 'שָֽׁמְרוּ', seph: 'shameru', rule: "QK0' meteg marks gadol; sheva na" },
  { word: 'שָׁמְרוּ', seph: 'shameru', rule: 'QK1 ambiguous — canonical gadol + na',
    review: 'without meteg this could be "shameru" (verb) or "shomru"; both are accepted when grading' },
  { word: 'חֳדָשִׁים', seph: 'chodashim', ashk: 'chodoshim', rule: 'hataf qamats = o' },
  { word: 'בָּרוּךְ', ashk: 'boruch', rule: 'Ashkenazic kamatz = o' },
  { word: 'אָמֵן', ashk: 'omen', rule: 'Ashkenazic kamatz; tzere',
    review: 'Ashkenazic tzere canonical "e"; "omein" is accepted as a variant when grading' },
]

// Rule-level checks: the classification each sheva / qamats in a word gets,
// in order of appearance. Failures here name the rule that broke.
export const shevaTypeCases = [
  { word: 'בְּרֵאשִׁית', types: ['na'], rule: 'S1' },
  { word: 'לֵךְ', types: ['nach'], rule: 'S5' },
  { word: 'וַיִּשְׁמְרוּ', types: ['nach', 'na'], rule: 'S6' },
  { word: 'הִנְנִי', types: ['na'], rule: 'S4' },
  { word: 'יִשְׂרָאֵל', types: ['nach'], rule: 'S3' },
  { word: 'שׁוֹמְרִים', types: ['either'], rule: 'S2 (no meteg): either' },
  { word: 'שֽׁוֹמְרִים', types: ['na'], rule: 'S2 with meteg: na' },
  { word: 'לֶךְ־לְךָ', types: ['nach', 'na'], rule: 'S5/S1 across maqef' },
  { word: 'חָכְמָה', types: ['nach'], rule: 'after qamats katan' },
  { word: 'שָׁמְרוּ', types: ['either'], rule: 'after ambiguous qamats' },
]

export const qamatsTypeCases = [
  { word: 'שָׁלוֹם', types: ['gadol'], rule: 'open syllable' },
  { word: 'כָּל־הָאָרֶץ', types: ['katan', 'gadol', 'gadol'], rule: 'QK2' },
  { word: 'צָהֳרַיִם', types: ['katan'], rule: 'QK3' },
  { word: 'וַיָּקָם', types: ['gadol', 'katan'], rule: 'QK4' },
  { word: 'חָנֵּנִי', types: ['katan'], rule: 'QK5' },
  { word: 'שָׁמָּה', types: ['gadol', 'gadol'], rule: 'QK5 stressed exception' },
  { word: 'בָּתִּים', types: ['gadol'], rule: 'QK5 word exception' },
  { word: 'חָכְמָה', types: ['katan', 'gadol'], rule: 'QK6' },
  { word: 'שָׁמְרוּ', types: ['ambiguous'], rule: 'QK1' },
  { word: 'שָֽׁמְרוּ', types: ['gadol'], rule: "QK0' meteg" },
  { word: 'חׇכְמָה', types: ['katan', 'gadol'], rule: 'QK0 explicit sign' },
]
