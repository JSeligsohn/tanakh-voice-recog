export const psukim = [
  {
    reference: 'בְּרֵאשִׁית יב:א',
    book: 'Bereishit 12:1',
    text: 'וַיֹּאמֶר הַשֵּׁם אֶל־אַבְרָם לֶךְ־לְךָ מֵאַרְצְךָ וּמִמּוֹלַדְתְּךָ וּמִבֵּית אָבִיךָ אֶל־הָאָרֶץ אֲשֶׁר אַרְאֶךָּ',
    translation: 'The LORD said to Abram, "Go forth from your land, your birthplace, and your father\'s house to the land that I will show you."',
  },
  {
    reference: 'בְּרֵאשִׁית יב:ב',
    book: 'Bereishit 12:2',
    text: 'וְאֶעֶשְׂךָ לְגוֹי גָּדוֹל וַאֲבָרֶכְךָ וַאֲגַדְּלָה שְׁמֶךָ וֶהְיֵה בְּרָכָה',
    translation: '"I will make you a great nation, and I will bless you; I will make your name great, and you shall be a blessing."',
  },
  {
    reference: 'בְּרֵאשִׁית יב:ג',
    book: 'Bereishit 12:3',
    text: 'וַאֲבָרְכָה מְבָרְכֶיךָ וּמְקַלֶּלְךָ אָאֹר וְנִבְרְכוּ בְךָ כֹּל מִשְׁפְּחֹת הָאֲדָמָה',
    translation: '"I will bless those who bless you, and whoever curses you I will curse; and all the families of the earth will be blessed through you."',
  },
  {
    reference: 'בְּרֵאשִׁית יב:ד',
    book: 'Bereishit 12:4',
    text: 'וַיֵּלֶךְ אַבְרָם כַּאֲשֶׁר דִּבֶּר אֵלָיו הַשֵּׁם וַיֵּלֶךְ אִתּוֹ לוֹט וְאַבְרָם בֶּן־חָמֵשׁ שָׁנִים וְשִׁבְעִים שָׁנָה בְּצֵאתוֹ מֵחָרָן',
    translation: 'So Abram went, as the LORD had told him; and Lot went with him. Abram was seventy-five years old when he departed from Haran.',
  },
  {
    reference: 'בְּרֵאשִׁית יב:ה',
    book: 'Bereishit 12:5',
    text: 'וַיִּקַּח אַבְרָם אֶת־שָׂרַי אִשְׁתּוֹ וְאֶת־לוֹט בֶּן־אָחִיו וְאֶת־כָּל־רְכוּשָׁם אֲשֶׁר רָכָשׁוּ וְאֶת־הַנֶּפֶשׁ אֲשֶׁר־עָשׂוּ בְחָרָן וַיֵּצְאוּ לָלֶכֶת אַרְצָה כְּנַעַן',
    translation: 'Abram took his wife Sarai, his nephew Lot, all the possessions they had accumulated and the people they had acquired in Haran, and they set out for the land of Canaan.',
  },

  // ── Test verses chosen to stress-test specific pronunciation challenges ──

  // sheva na (שְׁ), sin (יִשְׂ), chataf segol (אֱ), guttural chet (אֶחָד)
  {
    reference: 'דְּבָרִים ו:ד',
    book: 'Test: Devarim 6:4 (Shema)',
    text: 'שְׁמַע יִשְׂרָאֵל הַשֵּׁם אֱלֹהֵינוּ הַשֵּׁם אֶחָד',
    translation: 'Hear, O Israel, the LORD our God, the LORD is one.',
  },

  // Reading-skill test: קֹל (cholam chaser) and קוֹל (cholam malei) sound IDENTICAL —
  // both pronounced "kol". The test is whether the student recognizes the chaser
  // sign (just a dot, no vav). Also: chataf patach (יַעֲ), guttural ayin, sin (עֵשָׂו).
  {
    reference: 'בְּרֵאשִׁית כז:כב',
    book: 'Test: Bereishit 27:22 (chaser sign recognition)',
    text: 'הַקֹּל קוֹל יַעֲקֹב וְהַיָּדַיִם יְדֵי עֵשָׂו',
    translation: 'The voice is the voice of Jacob, but the hands are the hands of Esau.',
  },

  // two cholam chasers (רֹ, לֹ), sheva nach inside word (אֶחְ), guttural chet
  {
    reference: 'תְּהִלִּים כג:א',
    book: 'Test: Tehillim 23:1',
    text: 'הַשֵּׁם רֹעִי לֹא אֶחְסָר',
    translation: 'The LORD is my shepherd; I shall not want.',
  },

  // cholam chaser (מֹ), silent final ה, shin & sin in close proximity, dagesh chazak (שִּׁ)
  {
    reference: 'שְׁמוֹת טו:א',
    book: 'Test: Shemot 15:1 (Az Yashir)',
    text: 'אָז יָשִׁיר־מֹשֶׁה וּבְנֵי יִשְׂרָאֵל אֶת־הַשִּׁירָה הַזֹּאת',
    translation: 'Then Moses and the children of Israel sang this song.',
  },

  // mappiq ה (דְּרָכֶיהָ, נְתִיבוֹתֶיהָ — final ה must be pronounced),
  // sheva na (דְּ, נְ), kamatz katan in וְכָל
  {
    reference: 'מִשְׁלֵי ג:יז',
    book: 'Test: Mishlei 3:17 (mappiq ה)',
    text: 'דְּרָכֶיהָ דַרְכֵי־נֹעַם וְכָל־נְתִיבוֹתֶיהָ שָׁלוֹם',
    translation: 'Her ways are ways of pleasantness, and all her paths are peace.',
  },
]
