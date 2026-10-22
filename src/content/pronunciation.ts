import type { PronunciationTopic } from './types';
import { bi } from './helpers';

/**
 * Pronunciation lab targeted at the sounds Arabic speakers find hardest
 * (see Swan & Smith, "Learner English", chapter on Arabic speakers).
 */
export const PRONUNCIATION: PronunciationTopic[] = [
  {
    id: 'p-b',
    title: '/p/ vs /b/ — pen or Ben?',
    titleAr: 'الفرق بين /p/ و /b/',
    sounds: ['/p/', '/b/'],
    how: bi(
      'Both sounds start with closed lips. /b/ is voiced: your vocal cords vibrate. /p/ is voiceless and, at the start of a stressed syllable, comes with a strong puff of air. Test: hold a tissue in front of your mouth — it should move for "pin" but hardly for "bin".',
      'الصوتان يبدآن بإغلاق الشفتين. /b/ مجهور: تهتز الأوتار الصوتية. أما /p/ فمهموس، ويخرج معه في بداية المقطع المنبور نفَس هواء قوي. اختبر: ضع منديلًا أمام فمك — يجب أن يتحرك عند pin ولا يكاد يتحرك عند bin.',
    ),
    arabicNote:
      'العربية الفصحى لا تحتوي على /p/، لذلك يقول كثيرون «بارك» بدل park و«بيبول» بدل people. السر هو نفخة الهواء: ضع ورقة أمام فمك وقل pen — يجب أن تتحرك الورقة.',
    pairs: [
      { a: 'pin', b: 'bin' },
      { a: 'pack', b: 'back' },
      { a: 'pea', b: 'bee' },
      { a: 'pull', b: 'bull' },
      { a: 'cap', b: 'cab' },
      { a: 'rope', b: 'robe' },
      { a: 'pear', b: 'bear' },
      { a: 'park', b: 'bark' },
    ],
    sentences: ['Please put the pens in the purple box.', 'Peter bought a big blue pen.', 'The baby is playing with a paper boat.'],
  },
  {
    id: 'f-v',
    title: '/f/ vs /v/ — fan or van?',
    titleAr: 'الفرق بين /f/ و /v/',
    sounds: ['/f/', '/v/'],
    how: bi(
      'Rest your top teeth lightly on your bottom lip and push air through. /f/ is voiceless. For /v/, keep the same position but turn your voice on — you should feel your lip buzz.',
      'ضع أسنانك العلوية برفق على شفتك السفلى وادفع الهواء. /f/ مهموس. ولـ /v/ حافظ على الوضع نفسه لكن شغّل صوتك — يجب أن تشعر بطنين في شفتك.',
    ),
    arabicNote:
      'صوت /v/ غير موجود في العربية، فيُنطق غالبًا «ف»: «فيري» بدل very و«فان» بدل van. كأنك تنطق «ف» مع طنين واهتزاز — ضع يدك على حلقك لتشعر بالاهتزاز.',
    pairs: [
      { a: 'fan', b: 'van' },
      { a: 'fine', b: 'vine' },
      { a: 'few', b: 'view' },
      { a: 'leaf', b: 'leave' },
      { a: 'safe', b: 'save' },
      { a: 'ferry', b: 'very' },
      { a: 'fast', b: 'vast' },
      { a: 'fail', b: 'veil' },
    ],
    sentences: ['Vivian has a very valuable violin.', 'Five vans visited the village.', 'I love living in a vibrant city.'],
  },
  {
    id: 'i-ii',
    title: '/ɪ/ vs /iː/ — ship or sheep?',
    titleAr: 'الفرق بين /ɪ/ القصيرة و /iː/ الطويلة',
    sounds: ['/ɪ/', '/iː/'],
    how: bi(
      '/iː/ is long and tense: spread your lips as if smiling, tongue high and forward. /ɪ/ is short and relaxed: the tongue drops a little and moves back; the lips are neutral.',
      '/iː/ طويلة ومشدودة: افرد شفتيك كأنك تبتسم ولسانك مرتفع إلى الأمام. /ɪ/ قصيرة ومرتخية: ينخفض اللسان قليلًا ويتراجع، والشفتان محايدتان.',
    ),
    arabicNote:
      'العربية تفرّق بين الكسرة والياء المدّية («بِر» و«بير») — استفد من ذلك: /ɪ/ كسرة قصيرة مرتخية، و /iː/ ياء ممدودة مع ابتسامة. انتبه: الخلط بين sheet و beach وما يشبههما قد يُنتج كلمات محرجة!',
    pairs: [
      { a: 'ship', b: 'sheep' },
      { a: 'live', b: 'leave' },
      { a: 'fit', b: 'feet' },
      { a: 'chip', b: 'cheap' },
      { a: 'hit', b: 'heat' },
      { a: 'bit', b: 'beat' },
      { a: 'sit', b: 'seat' },
      { a: 'fill', b: 'feel' },
    ],
    sentences: ['Will you sleep on the ship?', 'Please sit in this seat.', 'The fish is cheap, but the chips are not.'],
  },
  {
    id: 'e-i',
    title: '/e/ vs /ɪ/ — pen or pin?',
    titleAr: 'الفرق بين /e/ و /ɪ/',
    sounds: ['/e/', '/ɪ/'],
    how: bi(
      'For /e/ open your mouth a little more and keep the tongue in the middle. For /ɪ/ the tongue is higher and the mouth is more closed.',
      'في /e/ افتح فمك أكثر قليلًا واجعل لسانك في المنتصف. وفي /ɪ/ يكون اللسان أعلى والفم أكثر انغلاقًا.',
    ),
    arabicNote:
      'في كثير من اللهجات العربية لا يوجد فرق واضح بين /e/ و /ɪ/، فتُنطق pen مثل pin و ten مثل tin. افتح فكّك قليلًا في /e/ — فكّر في الصوت الذي بين الفتحة والكسرة.',
    pairs: [
      { a: 'pen', b: 'pin' },
      { a: 'bed', b: 'bid' },
      { a: 'set', b: 'sit' },
      { a: 'ten', b: 'tin' },
      { a: 'bet', b: 'bit' },
      { a: 'well', b: 'will' },
      { a: 'led', b: 'lid' },
      { a: 'send', b: 'sinned' },
    ],
    sentences: ['Ten men went to bed.', 'Can I borrow a pen and a pin?', 'Will you sell me the well?'],
  },
  {
    id: 'ae-uh',
    title: '/æ/ vs /ʌ/ — cat or cut?',
    titleAr: 'الفرق بين /æ/ و /ʌ/',
    sounds: ['/æ/', '/ʌ/'],
    how: bi(
      '/æ/: drop your jaw wide, tongue low and forward — a big, open sound. /ʌ/: short, relaxed and central, with the jaw only half open — like a quick "uh".',
      '/æ/: أنزل فكّك كثيرًا ولسانك منخفض إلى الأمام — صوت واسع ومفتوح. /ʌ/: قصير ومرتخٍ في وسط الفم والفك نصف مفتوح — كأنه «آه» قصيرة مكتومة.',
    ),
    arabicNote:
      'يقع الصوتان قرب «الفتحة» العربية فيختلطان. /æ/ فتحة واسعة جدًا مع إنزال الفك (cat)، و /ʌ/ صوت قصير مكتوم في وسط الفم (cut). الخلط بينهما يغيّر المعنى: hat/hut و ankle/uncle.',
    pairs: [
      { a: 'cat', b: 'cut' },
      { a: 'cap', b: 'cup' },
      { a: 'bag', b: 'bug' },
      { a: 'hat', b: 'hut' },
      { a: 'ran', b: 'run' },
      { a: 'match', b: 'much' },
      { a: 'ankle', b: 'uncle' },
      { a: 'fan', b: 'fun' },
    ],
    sentences: ['My uncle has a cup and a cap.', 'The cat ran from the bug.', 'Thanks so much for the fun match.'],
  },
  {
    id: 'ch-sh',
    title: '/tʃ/ vs /ʃ/ — chair or share?',
    titleAr: 'الفرق بين /tʃ/ و /ʃ/',
    sounds: ['/tʃ/', '/ʃ/'],
    how: bi(
      '/tʃ/ starts with a full stop: the tongue blocks the air like /t/, then releases it into /ʃ/. /ʃ/ is a continuous hiss with no stop at all.',
      '/tʃ/ يبدأ بإغلاق كامل: يحبس اللسان الهواء كما في /t/ ثم يطلقه إلى /ʃ/. أما /ʃ/ فصفير مستمر بلا توقف.',
    ),
    arabicNote:
      'صوت /tʃ/ موجود في بعض اللهجات الخليجية والعراقية («چ» كما في «چاي»)، لكن كثيرًا من المتعلمين ينطقونه «ش». ابدأ بإغلاق كامل كأنك تقول «ت» ثم انفجر في «ش».',
    pairs: [
      { a: 'chair', b: 'share' },
      { a: 'chip', b: 'ship' },
      { a: 'cheap', b: 'sheep' },
      { a: 'watch', b: 'wash' },
      { a: 'chop', b: 'shop' },
      { a: 'catch', b: 'cash' },
      { a: 'match', b: 'mash' },
      { a: 'chew', b: 'shoe' },
    ],
    sentences: ['Which shop sells cheap chairs?', 'Watch me wash the dishes.', 'She chose a chocolate cherry.'],
  },
  {
    id: 'th',
    title: '/θ/ and /ð/ — think, this',
    titleAr: 'صوتا /θ/ (ث) و /ð/ (ذ)',
    sounds: ['/θ/', '/ð/'],
    how: bi(
      'Put the tip of your tongue lightly between your teeth and blow air out. /θ/ (think) is voiceless; /ð/ (this) is voiced.',
      'ضع طرف لسانك برفق بين أسنانك وادفع الهواء. /θ/ (think) مهموس، و /ð/ (this) مجهور.',
    ),
    arabicNote:
      'لديك هذان الصوتان في الفصحى: /θ/ = ث و /ð/ = ذ! لكن كثيرًا من اللهجات تحوّلهما إلى «س/ت» و«ز/د»، فيقول المتعلم «سِنك» بدل think و«زيس» بدل this. استخدم نطقك للثاء والذال كما في الفصحى.',
    pairs: [
      { a: 'think', b: 'sink' },
      { a: 'thank', b: 'tank' },
      { a: 'three', b: 'tree' },
      { a: 'thin', b: 'sin' },
      { a: 'mouth', b: 'mouse' },
      { a: 'then', b: 'den' },
      { a: 'they', b: 'day' },
      { a: 'breathe', b: 'breeze' },
    ],
    sentences: ['Thank you for the three things.', 'They think this is the third theatre.', 'My father and brother breathe the fresh air together.'],
  },
  {
    id: 'ng',
    title: '/ŋ/ — sing, not sin-g',
    titleAr: 'الصوت الأنفي /ŋ/',
    sounds: ['/ŋ/', '/n/'],
    how: bi(
      'Raise the back of your tongue against the soft palate and let the air flow through your nose. At the end of "sing" or "thing", do NOT release a /g/.',
      'ارفع مؤخرة لسانك نحو سقف الحلق الرخو ودع الهواء يخرج من الأنف. وفي آخر sing و thing لا تُطلق صوت /g/.',
    ),
    arabicNote:
      'يميل المتعلم العربي إلى نطق «سِنْغ» بإضافة /g/ واضحة في آخر sing و thing و morning. في الإنجليزية القياسية تنتهي الكلمة بصوت أنفي /ŋ/ دون /g/ مسموعة — تمامًا كالنون المخفاة قبل الكاف في «منكم».',
    pairs: [
      { a: 'sin', b: 'sing' },
      { a: 'thin', b: 'thing' },
      { a: 'ran', b: 'rang' },
      { a: 'win', b: 'wing' },
      { a: 'ban', b: 'bang' },
      { a: 'kin', b: 'king' },
      { a: 'sun', b: 'sung' },
      { a: 'ton', b: 'tongue' },
    ],
    sentences: ['The king is singing a long song.', 'Bring the ring on Sunday morning.', 'Nothing is wrong with the wing.'],
  },
  {
    id: 'clusters',
    title: 'Consonant clusters — spring, not "isspring"',
    titleAr: 'تتابع السواكن (spring و street)',
    sounds: ['/spr/', '/str/', '/pl/'],
    how: bi(
      'English words can start with two or three consonants. Glide straight from one to the next without adding a vowel: start the /s/ hiss and roll into the next sounds — s-p-r-ing.',
      'تبدأ الكلمات الإنجليزية أحيانًا بساكنين أو ثلاثة. انتقل من صوت إلى الذي يليه مباشرة دون إضافة حركة: ابدأ بصفير /s/ ثم أكمل — s-p-r-ing.',
    ),
    arabicNote:
      'العربية لا تبدأ الكلمة بساكنين، لذا يضيف المتعلم همزة وصل أو حركة: «إسبرنغ» بدل spring و«إستريت» بدل street، أو يُدخل حركة بين الساكنين فتصبح sport مثل support و please مثل police! تدرّب ببطء ثم أسرِع.',
    pairs: [
      { a: 'sport', b: 'support' },
      { a: 'blow', b: 'below' },
      { a: 'plight', b: 'polite' },
      { a: 'prayed', b: 'parade' },
      { a: 'please', b: 'police' },
      { a: 'claps', b: 'collapse' },
    ],
    sentences: ['Spring is the best season for sports.', 'The street was strangely quiet.', 'She speaks Spanish splendidly.'],
  },
  {
    id: 'stress',
    title: 'Word stress — REcord or reCORD?',
    titleAr: 'النبر في الكلمة',
    sounds: ["'○○", "○'○"],
    how: bi(
      'In every English word one syllable is stressed: it is louder, longer and higher. Unstressed vowels often weaken to schwa /ə/. Some words change stress — and meaning — between noun and verb.',
      'في كل كلمة إنجليزية مقطع منبور: أعلى وأطول وأوضح. وحروف العلة غير المنبورة تضعف غالبًا إلى /ə/. وبعض الكلمات يتغير نبرها — ومعناها — بين الاسم والفعل.',
    ),
    arabicNote:
      'النبر في العربية منتظم نسبيًا، أما في الإنجليزية فيتنقل ويغيّر المعنى أحيانًا: a REcord (تسجيل) و to reCORD (يسجّل). وكلمات العائلة الواحدة يتغير نبرها: PHOtograph و phoTOgraphy و photoGRAPHic. احفظ النبر مع الكلمة دائمًا (القواميس تضع علامة ˈ قبل المقطع المنبور).',
    pairs: [
      { a: 'a record', b: 'to record' },
      { a: 'a present', b: 'to present' },
      { a: 'an object', b: 'to object' },
      { a: 'a desert', b: 'to desert' },
      { a: 'a contract', b: 'to contract' },
      { a: 'an increase', b: 'to increase' },
    ],
    sentences: ['I want to record a new record.', 'Please present the present to your mother.', 'Photography is a photographic art.'],
  },
  {
    id: 'weak-forms',
    title: "Weak forms — can or can't?",
    titleAr: 'الصيغ الضعيفة والشوا /ə/',
    sounds: ['/ə/', '/kən/', '/kɑːnt/'],
    how: bi(
      'Small grammar words (a, the, to, of, for, and, can, was) are usually unstressed, and their vowel becomes schwa /ə/ — the most common sound in English. That is why positive "can" (/kən/) sounds so different from "can\'t" (/kɑːnt/).',
      'الكلمات النحوية الصغيرة (a و the و to و of و and و can) غير منبورة عادةً، وتتحول حروف العلة فيها إلى /ə/ — أكثر الأصوات شيوعًا في الإنجليزية. لذلك تبدو can الموجبة /kən/ مختلفة جدًا عن can\'t /kɑːnt/.',
    ),
    arabicNote:
      'يميل المتعلم العربي إلى نطق كل كلمة نطقًا كاملًا واضحًا، فيبدو الكلام آليًا وبطيئًا ويصعب عليه فهم الناطقين. الإنجليزية لغة إيقاعها نبري: a cup of tea تُنطق /ə ˈkʌp əv ˈtiː/. درّب أذنك على الصيغ الضعيفة وستفهم الأفلام بشكل أفضل.',
    pairs: [
      { a: 'I can swim.', b: "I can't swim." },
      { a: 'She can drive.', b: "She can't drive." },
      { a: 'We can come.', b: "We can't come." },
      { a: 'They can cook.', b: "They can't cook." },
    ],
    sentences: ['I want to go to the shop.', 'A cup of tea and a piece of cake.', 'What do you want to do?'],
  },
  {
    id: 'silent',
    title: 'Silent letters — know, listen, Wednesday',
    titleAr: 'الحروف الصامتة',
    sounds: ['k̶n', 'w̶r', 'mb̶'],
    how: bi(
      'English spelling is not phonetic. Many letters are silent: k in know, w in write, b in climb, l in walk, t in listen, h in hour, d in Wednesday. The pairs below sound exactly the same.',
      'التهجئة الإنجليزية ليست صوتية. حروف كثيرة لا تُنطق: k في know، و w في write، و b في climb، و l في walk، و t في listen، و h في hour، و d في Wednesday. والأزواج أدناه تُنطق بالطريقة نفسها تمامًا.',
    ),
    arabicNote:
      'العربية تُكتب كما تُنطق تقريبًا، فيميل المتعلم إلى نطق كل حرف مكتوب: «كنو» بدل know و«ليستِن» بدل listen و«وِدنزداي» بدل Wednesday /ˈwenzdeɪ/. لا تثق بالتهجئة — استمع أولًا ثم انطق.',
    pairs: [
      { a: 'know', b: 'no' },
      { a: 'write', b: 'right' },
      { a: 'hour', b: 'our' },
      { a: 'knight', b: 'night' },
      { a: 'whole', b: 'hole' },
      { a: 'wrap', b: 'rap' },
    ],
    homophones: true,
    sentences: ['I know the knight walked for an hour.', 'Listen! Someone is knocking on the door.', 'On Wednesday I climbed the mountain.'],
  },
];
