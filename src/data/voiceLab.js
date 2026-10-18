// Verses for the Voice lab (dev page comparing OpenAI readings).
//
// Chosen from a pool of ~290 Torah verses (6–15 words, no divine names) by
// greedy coverage over our rules engine: the first five together cover every
// letter and final form, every vowel, dagesh/no dagesh in ב כ פ ת, shin/sin,
// sheva na/nach, kamatz gadol/katan, all three chatafim, patach genuvah,
// mappiq, dagesh chazak and the ָיו suffix. Text is Miqra according to the
// Masorah (via Sefaria) with the cantillation removed; meteg and the kamatz
// katan sign are kept, since our rules engine reads them.

export const voiceLabVerses = [
  {
    id: 'gen-12-1',
    book: 'Bereishit 12:1',
    text: 'וַיֹּאמֶר הַשֵּׁם אֶל־אַבְרָם לֶךְ־לְךָ מֵאַרְצְךָ וּמִמּוֹלַדְתְּךָ וּמִבֵּית אָבִיךָ אֶל־הָאָרֶץ אֲשֶׁר אַרְאֶךָּ',
    trope: 'וַיֹּ֤אמֶר הַשֵּׁם֙ אֶל־אַבְרָ֔ם לֶךְ־לְךָ֛ מֵאַרְצְךָ֥ וּמִמּֽוֹלַדְתְּךָ֖ וּמִבֵּ֣ית אָבִ֑יךָ אֶל־הָאָ֖רֶץ אֲשֶׁ֥ר אַרְאֶֽךָּ׃',
    covers: 'The familiar one from the app, for reference.',
  },
  {
    id: 'gen-45-17',
    book: 'Bereishit 45:17',
    text: 'וַיֹּאמֶר פַּרְעֹה אֶל־יוֹסֵף אֱמֹר אֶל־אַחֶיךָ זֹאת עֲשׂוּ טַֽעֲנוּ אֶת־בְּעִירְכֶם וּלְכוּ־בֹאוּ אַרְצָה כְּנָֽעַן',
    trope: 'וַיֹּ֤אמֶר פַּרְעֹה֙ אֶל־יוֹסֵ֔ף אֱמֹ֥ר אֶל־אַחֶ֖יךָ זֹ֣את עֲשׂ֑וּ טַֽעֲנוּ֙ אֶת־בְּעִ֣ירְכֶ֔ם וּלְכוּ־בֹ֖אוּ אַ֥רְצָה כְּנָֽעַן׃',
    covers: 'Most letters and vowels; sin; chataf patach and segol; sheva na and nach; b/v, k/ch, p/f, t/s.',
  },
  {
    id: 'deut-32-22',
    book: 'Devarim 32:22',
    text: 'כִּי־אֵשׁ קָדְחָה בְאַפִּי וַתִּיקַד עַד־שְׁאוֹל תַּחְתִּית וַתֹּאכַל אֶרֶץ וִֽיבֻלָהּ וַתְּלַהֵט מוֹסְדֵי הָרִֽים',
    trope: 'כִּי־אֵשׁ֙ קָדְחָ֣ה בְאַפִּ֔י וַתִּיקַ֖ד עַד־שְׁא֣וֹל תַּחְתִּ֑ית וַתֹּ֤אכַל אֶ֙רֶץ֙ וִֽיבֻלָ֔הּ וַתְּלַהֵ֖ט מוֹסְדֵ֥י הָרִֽים׃',
    covers: 'ד ץ ק; kubutz; mappiq (וִיבֻלָהּ); ambiguous kamatz (קָדְחָה); tav with dagesh.',
  },
  {
    id: 'num-6-9',
    book: 'Bamidbar 6:9',
    text: 'וְכִֽי־יָמוּת מֵת עָלָיו בְּפֶתַע פִּתְאֹם וְטִמֵּא רֹאשׁ נִזְרוֹ וְגִלַּח רֹאשׁוֹ בְּיוֹם טׇהֳרָתוֹ בַּיּוֹם הַשְּׁבִיעִי יְגַלְּחֶֽנּוּ',
    trope: 'וְכִֽי־יָמ֨וּת מֵ֤ת עָלָיו֙ בְּפֶ֣תַע פִּתְאֹ֔ם וְטִמֵּ֖א רֹ֣אשׁ נִזְר֑וֹ וְגִלַּ֤ח רֹאשׁוֹ֙ בְּי֣וֹם טׇהֳרָת֔וֹ בַּיּ֥וֹם הַשְּׁבִיעִ֖י יְגַלְּחֶֽנּוּ׃',
    covers: 'ג; kamatz katan and chataf kamatz (טׇהֳרָתוֹ); the ָיו suffix (עָלָיו); פ without dagesh.',
  },
  {
    id: 'gen-1-15',
    book: 'Bereishit 1:15',
    text: 'וְהָיוּ לִמְאוֹרֹת בִּרְקִיעַ הַשָּׁמַיִם לְהָאִיר עַל־הָאָרֶץ וַֽיְהִי־כֵֽן',
    trope: 'וְהָי֤וּ לִמְאוֹרֹת֙ בִּרְקִ֣יעַ הַשָּׁמַ֔יִם לְהָאִ֖יר עַל־הָאָ֑רֶץ וַֽיְהִי־כֵֽן׃',
    covers: 'Patach genuvah (בִּרְקִיעַ).',
  },
  {
    id: 'gen-45-14',
    book: 'Bereishit 45:14',
    text: 'וַיִּפֹּל עַל־צַוְּארֵי בִנְיָֽמִן־אָחִיו וַיֵּבְךְּ וּבִנְיָמִן בָּכָה עַל־צַוָּארָֽיו',
    trope: 'וַיִּפֹּ֛ל עַל־צַוְּארֵ֥י בִנְיָֽמִן־אָחִ֖יו וַיֵּ֑בְךְּ וּבִ֨נְיָמִ֔ן בָּכָ֖ה עַל־צַוָּארָֽיו׃',
    covers: 'Final ך with dagesh (וַיֵּבְךְּ); a sheva at the very end of a word.',
  },
]
