/**
 * Mock & Offline AI Service
 * Provides instant, zero-latency Urdu translations and multi-context examples
 * for 100 Essential English Phrasal Verbs and daily conversation sentences.
 */

import { AIService, WordEnrichment } from './aiService';
import { Word } from '../../features/words/types';
import { SEED_COLLOCATIONS } from '../storage/seedCollocations';
import { SEED_AFFIXES } from '../storage/seedAffixes';
import { SEED_CONFUSED_WORDS } from '../storage/seedConfusedWords';
import { SEED_HOMOPHONES } from '../storage/seedHomophones';
import { SEED_PRONOUNS } from '../storage/seedPronouns';

const DICTIONARY: Record<string, WordEnrichment> = {
  'give up': {
    urduMeaning: 'ہار مان لینا / ترک کرنا / چھوڑ دینا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'giv up',
    exampleSentence: 'Never give up on your goals, no matter how difficult they appear.',
  },
  'figure out': {
    urduMeaning: 'سمجھنا / حل نکالنا / کھوج لگانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'FIG-yer owt',
    exampleSentence: 'I am trying to figure out how to resolve this software bug.',
  },
  'run out of': {
    urduMeaning: 'ختم ہو جانا / قلت ہو جانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'run owt uv',
    exampleSentence: 'We have run out of time and need to wrap up the meeting.',
  },
  'look forward to': {
    urduMeaning: 'بے صبری سے انتظار کرنا / مشتاق ہونا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'look FOR-wurd too',
    exampleSentence: 'I look forward to meeting you and your team this Friday.',
  },
  'put off': {
    urduMeaning: 'ملتوی کرنا / ٹالنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'poot awf',
    exampleSentence: "Don't put off your important tasks until the last moment.",
  },
  'come across': {
    urduMeaning: 'اتفاقاً ملنا / نظر آنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'kum uh-KRAWS',
    exampleSentence: 'I came across an old family photograph while cleaning my desk.',
  },
  'call off': {
    urduMeaning: 'منسوخ کرنا / رد کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'kawl awf',
    exampleSentence: 'They called off the outdoor concert due to heavy rainfall.',
  },
  'break down': {
    urduMeaning: 'خراب ہو جانا / ہمت ہار جانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'brayk down',
    exampleSentence: '(1) Machine: My laptop broke down. (2) Emotional: She broke down in tears.',
  },
  'bring up': {
    urduMeaning: 'ذکر کرنا / پرورش کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'bring up',
    exampleSentence: '(1) Mention: She brought up an important point. (2) Raise: He was brought up in Lahore.',
  },
  'turn down': {
    urduMeaning: 'مسترد کرنا / آواز مدہم کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'turn down',
    exampleSentence: '(1) Reject: He turned down the job offer. (2) Volume: Please turn down the music.',
  },
  'get along with': {
    urduMeaning: 'اچھے تعلقات رکھنا / نبھانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'get uh-LAWNG with',
    exampleSentence: 'I get along very well with all my workplace colleagues.',
  },
  'look after': {
    urduMeaning: 'دیکھ بھال کرنا / خیال رکھنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'look AF-tur',
    exampleSentence: 'Can you look after my bag while I step away for a moment?',
  },
  'carry on': {
    urduMeaning: 'جاری رکھنا / کام جاری رکھنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'KAIR-ee on',
    exampleSentence: 'Please carry on with your preparation and stay dedicated.',
  },
  'hold on': {
    urduMeaning: 'انتظار کرنا / صبر کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'hohld on',
    exampleSentence: 'Hold on for a minute while I locate your file in the system.',
  },
  'find out': {
    urduMeaning: 'معلوم کرنا / دریافت کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'fynd owt',
    exampleSentence: 'I need to find out the truth behind what really happened.',
  },
  'run into': {
    urduMeaning: 'اچانک ملنا / ٹکرا جانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'run IN-too',
    exampleSentence: 'I ran into an old university friend at the coffee shop today.',
  },
  'get over': {
    urduMeaning: 'سنبھلنا / قابو پانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'get OH-vur',
    exampleSentence: 'She eventually got over her disappointment and tried again.',
  },
  'catch up with': {
    urduMeaning: 'برابر آنا / حال احوال کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'kach up with',
    exampleSentence: "Let's catch up this weekend over coffee to discuss your progress.",
  },
  'look into': {
    urduMeaning: 'تحقیقات کرنا / چھان بین کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'look IN-too',
    exampleSentence: "I'll look into the customer issue and report back by evening.",
  },
  'back out': {
    urduMeaning: 'وعدے سے پیچھے ہٹنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'bak owt',
    exampleSentence: 'He promised to invest, but backed out at the last minute.',
  },
  'cut down on': {
    urduMeaning: 'مقدار کم کرنا / کمی لانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'kut down on',
    exampleSentence: 'I am cutting down on sugar and processed carbs to stay fit.',
  },
  'make up for': {
    urduMeaning: 'تلافی کرنا / نقصان پورا کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'mayk up for',
    exampleSentence: "I'll work late tonight to make up for lost time earlier.",
  },
  'pass away': {
    urduMeaning: 'وفات پانا / انتقال کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'pas uh-WAY',
    exampleSentence: 'His beloved grandfather passed away peacefully at age eighty.',
  },
  'stand out': {
    urduMeaning: 'نمایاں ہونا / ممتاز نظر آنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'stand owt',
    exampleSentence: 'Her extraordinary presentation skills made her work stand out.',
  },
  'take off': {
    urduMeaning: 'اڑان بھرنا / کپڑے جوتے اتارنا / کامیاب ہونا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'tayk awf',
    exampleSentence: '(1) Flight: The plane took off on time. (2) Clothes: Take off your muddy shoes.',
  },
  'put up with': {
    urduMeaning: 'برداشت کرنا / گوارا کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'poot up with',
    exampleSentence: "I can't put up with this persistent construction noise all day.",
  },
  'count on': {
    urduMeaning: 'بھروسہ کرنا / انحصار کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'kownt on',
    exampleSentence: 'You can always count on me whenever you face an obstacle.',
  },
  'give in': {
    urduMeaning: 'ہار مان لینا / مان جانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'giv in',
    exampleSentence: 'After lengthy debate, management finally gave in to our proposal.',
  },
  'drop by': {
    urduMeaning: 'مختصر ملاقات کے لیے آنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'drop by',
    exampleSentence: "I'll drop by your office this evening for a quick chat.",
  },
  'show up': {
    urduMeaning: 'حاضر ہونا / وقت پر پہنچنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'shoh up',
    exampleSentence: 'We waited for thirty minutes, but he didn’t show up today.',
  },
  'wake up': {
    urduMeaning: 'جاگنا / بیدار ہونا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'wayk up',
    exampleSentence: 'I wake up at seven o’clock sharp every morning.',
  },
  'get up': {
    urduMeaning: 'بستر سے اٹھنا / کھڑے ہونا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'get up',
    exampleSentence: 'I wake up at six, but I usually get up around six-thirty.',
  },
  'hurry up': {
    urduMeaning: 'جلدی کرنا / تیزی لانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'HUR-ee up',
    exampleSentence: 'Hurry up or we will be late for our flight check-in.',
  },
  'slow down': {
    urduMeaning: 'رفتار کم کرنا / دھیمے ہونا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'sloh down',
    exampleSentence: 'Please slow down; the road is wet and visibility is low.',
  },
  'hang out': {
    urduMeaning: 'ساتھ وقت گزارنا / مل بیٹھنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'hang owt',
    exampleSentence: 'I like to hang out with close friends on pleasant Sunday afternoons.',
  },
  'come over': {
    urduMeaning: 'گھر آنا / ملنے آنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'kum OH-vur',
    exampleSentence: "Come over to my place whenever you're free this evening.",
  },
  'head out': {
    urduMeaning: 'روانہ ہونا / نکلنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'hed owt',
    exampleSentence: "It is getting late, so I'm heading out now to beat the traffic.",
  },
  'stay over': {
    urduMeaning: 'رات گزارنا / شب بسری کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'stay OH-vur',
    exampleSentence: "Because of the rain, I stayed over at my friend's house overnight.",
  },
  'speak up': {
    urduMeaning: 'اونچی آواز میں بولنا / کھل کر بولنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'speek up',
    exampleSentence: '(1) Volume: Could you speak up, please? (2) Express: Speak up for your rights.',
  },
  'point out': {
    urduMeaning: 'نشاندہی کرنا / توجہ دلانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'poynt owt',
    exampleSentence: 'He pointed out a critical calculation mistake in the ledger.',
  },
  'spell out': {
    urduMeaning: 'ہجے بتانا / واضح اور تفصیل سے بتانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'spel owt',
    exampleSentence: '(1) Letters: Can you spell out your name? (2) Detail: Let me spell out the policy.',
  },
  'go over': {
    urduMeaning: 'جائزہ لینا / دہرانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'goh OH-vur',
    exampleSentence: "Let's go over the presentation slides one more time before the pitch.",
  },
  'talk over': {
    urduMeaning: 'بات چیت کرکے فیصلہ کرنا / تبادلہ خیال کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'tawk OH-vur',
    exampleSentence: "Let's talk over the plan during lunch and reach an agreement.",
  },
  'get back to': {
    urduMeaning: 'دوبارہ جواب دینا / رابطہ کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'get bak too',
    exampleSentence: "I will check the inventory and get back to you by tomorrow morning.",
  },
  'cut in': {
    urduMeaning: 'بات کاٹنا / درمیان میں بولنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'kut in',
    exampleSentence: 'Sorry to cut in, but there is an urgent visitor waiting for you.',
  },
  'fill out': {
    urduMeaning: 'فارم پُر کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'fil owt',
    exampleSentence: 'Please fill out this application form with your verified details.',
  },
  'log in': {
    urduMeaning: 'اکاؤنٹ میں داخل ہونا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'log in',
    exampleSentence: 'Enter your credentials to log in to the student portal.',
  },
  'log out': {
    urduMeaning: 'اکاؤنٹ سے باہر نکلنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'log owt',
    exampleSentence: 'Always remember to log out after completing your banking transactions.',
  },
  'set up': {
    urduMeaning: 'ترتیب دینا / قائم کرنا / آراستہ کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'set up',
    exampleSentence: '(1) Install: I need to set up my laptop. (2) Business: She set up a bakery.',
  },
  'carry out': {
    urduMeaning: 'انجام دینا / عمل کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'KAIR-ee owt',
    exampleSentence: 'The engineering team carried out the safety tests with precision.',
  },
  'write down': {
    urduMeaning: 'لکھ لینا / قلمبند کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'ryt down',
    exampleSentence: 'Write down the instructions so you remember each step accurately.',
  },
  'follow up': {
    urduMeaning: 'دوبارہ رابطہ کرنا / پیش رفت جاننا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'FOL-oh up',
    exampleSentence: "I'll follow up with the developer regarding our requested feature.",
  },
  'sort out': {
    urduMeaning: 'مسئلہ حل کرنا / ترتیب دینا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'sort owt',
    exampleSentence: "(1) Problem: Let's sort out this issue. (2) Organize: Sort out your books.",
  },
  'deal with': {
    urduMeaning: 'نمٹنا / نبھانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'deel with',
    exampleSentence: "She has the patience to deal with difficult customer complaints.",
  },
  'work out': {
    urduMeaning: 'حل نکالنا / کامیاب ہونا / ورزش کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'wurk owt',
    exampleSentence: '(1) Exercise: I work out at the gym. (2) Solve: We worked out a practical solution.',
  },
  'end up': {
    urduMeaning: 'آخرکار کسی حالت میں پہنچنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'end up',
    exampleSentence: 'We intended to go camping but ended up staying in a hotel due to rain.',
  },
  'turn out': {
    urduMeaning: 'ثابت ہونا / نتیجہ نکلنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'turn owt',
    exampleSentence: 'Despite early worries, the conference turned out to be magnificent.',
  },
  'narrow down': {
    urduMeaning: 'اختیارات محدود کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'NAIR-oh down',
    exampleSentence: "Let's narrow down the choices to the top three strongest candidates.",
  },
  'rule out': {
    urduMeaning: 'امکان کو خارج کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'rool owt',
    exampleSentence: "We cannot rule out a technical server malfunction at this stage.",
  },
  'come up with': {
    urduMeaning: 'خیال یا حل پیش کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'kum up with',
    exampleSentence: 'She came up with a brilliant idea for our marketing campaign.',
  },
  'mess up': {
    urduMeaning: 'گڑبڑ کرنا / کام بگاڑنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'mes up',
    exampleSentence: 'I accidentally messed up the project settings and had to reset.',
  },
  'cheer up': {
    urduMeaning: 'خوش کرنا / حوصلہ بڑھانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'cheer up',
    exampleSentence: 'A warm conversation with an old friend always cheers me up.',
  },
  'calm down': {
    urduMeaning: 'پرسکون ہونا / غصہ دھیما کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'kahm down',
    exampleSentence: 'Take a slow deep breath and calm down before answering.',
  },
  'open up': {
    urduMeaning: 'دل کی بات بتانا / کھل کر بولنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'OH-pun up',
    exampleSentence: 'He found it reassuring to open up about his personal anxieties.',
  },
  'make up': {
    urduMeaning: 'صلح کرنا / کہانی گھڑنا / پورا کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'mayk up',
    exampleSentence: '(1) Reconcile: They had an argument but made up soon. (2) Invent: He made up an excuse.',
  },
  'let down': {
    urduMeaning: 'مایوس کرنا / اعتماد توڑنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'let down',
    exampleSentence: 'I gave you my word and I definitely do not want to let you down.',
  },
  'give away': {
    urduMeaning: 'مفت دے دینا / راز ظاہر کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'giv uh-WAY',
    exampleSentence: "(1) Donate: He gave away his old books. (2) Reveal: Don't give away the movie ending.",
  },
  'take up': {
    urduMeaning: 'سرگرمی شروع کرنا / جگہ گھیرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'tayk up',
    exampleSentence: '(1) Hobby: I decided to take up morning walking. (2) Space: The couch takes up space.',
  },
  'keep up with': {
    urduMeaning: 'رفتار کے ساتھ چلنا / ہم قدم رہنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'keep up with',
    exampleSentence: 'I strive to keep up with the latest technological developments.',
  },
  'bring back': {
    urduMeaning: 'واپس لانا / یاد دلانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'bring bak',
    exampleSentence: '(1) Return: Bring back my umbrella. (2) Memory: This song brings back sweet memories.',
  },
  'take back': {
    urduMeaning: 'واپس لینا / واپس کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'tayk bak',
    exampleSentence: '(1) Retract: I take back what I said; I was hasty. (2) Return: Take back the jacket.',
  },
  'give back': {
    urduMeaning: 'واپس کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'giv bak',
    exampleSentence: 'Please give back the notebook after you finish your homework.',
  },
  'pick up': {
    urduMeaning: 'اٹھانا / سیکھ لینا / سواری میں بٹھانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'pik up',
    exampleSentence: '(1) Lift: Pick up the phone. (2) Learn: I picked up Italian. (3) Transport: I’ll pick you up.',
  },
  'drop off': {
    urduMeaning: 'چھوڑنا / گاڑی سے اتارنا / سو جانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'drop awf',
    exampleSentence: "(1) Ride: I'll drop you off at the main gate. (2) Sleep: He dropped off while reading.",
  },
  'put on': {
    urduMeaning: 'پہننا / چلانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'poot on',
    exampleSentence: '(1) Clothes: Put on your jacket before leaving. (2) Music: Put on some soothing music.',
  },
  'try on': {
    urduMeaning: 'پہن کر دیکھنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'try on',
    exampleSentence: 'Can I try on this coat to make sure the fit is comfortable?',
  },
  'throw away': {
    urduMeaning: 'پھینک دینا / ضائع کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'throh uh-WAY',
    exampleSentence: "(1) Discard: Don't throw away that document. (2) Waste: Don't throw away this chance.",
  },
  'clean up': {
    urduMeaning: 'صفائی کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'kleen up',
    exampleSentence: 'I need to thoroughly clean up my workspace before starting the task.',
  },
  'tidy up': {
    urduMeaning: 'چیزیں ترتیب سے رکھنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'TY-dee up',
    exampleSentence: "Let's tidy up the living room before our guests arrive.",
  },
  'eat out': {
    urduMeaning: 'باہر ریستوران میں کھانا کھانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'eet owt',
    exampleSentence: 'We typically eat out with family on Friday evenings.',
  },
  'cut out': {
    urduMeaning: 'بند کرنا / نکال دینا / پرہیز کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'kut owt',
    exampleSentence: '(1) Stop habit: I need to cut out junk food. (2) Shape: Cut out the diagram carefully.',
  },
  'check out': {
    urduMeaning: 'دیکھنا / جانچنا / ہوٹل چھوڑنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'chek owt',
    exampleSentence: '(1) Inspect: Check out this useful application! (2) Hotel: Check out before 11 AM.',
  },
  'look up': {
    urduMeaning: 'معلومات تلاش کرنا / حالات سنورنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'look up',
    exampleSentence: "(1) Search: I'll look up the word in the dictionary. (2) Improve: Things are looking up.",
  },
  'read through': {
    urduMeaning: 'مکمل پڑھنا / شروع سے آخر تک پڑھنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'reed throo',
    exampleSentence: 'Read through the draft agreement carefully before sending it.',
  },
  'think over': {
    urduMeaning: 'غور کرنا / سنجیدگی سے سوچنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'think OH-vur',
    exampleSentence: "Take some time to think over the job offer before making a choice.",
  },
  'settle down': {
    urduMeaning: 'پرسکون ہونا / مستحکم زندگی شروع کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'SET-ul down',
    exampleSentence: '(1) Quiet: The students settled down quickly. (2) Live: He hopes to settle down soon.',
  },
  'get by': {
    urduMeaning: 'گزارا کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'get by',
    exampleSentence: 'I can get by with my conversational English while traveling abroad.',
  },
  'get rid of': {
    urduMeaning: 'چھٹکارا پانا / الگ کر دینا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'get rid uv',
    exampleSentence: 'I need to get rid of unnecessary digital distractions to stay productive.',
  },
  'keep away from': {
    urduMeaning: 'دور رہنا / فاصلہ رکھنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'keep uh-WAY from',
    exampleSentence: 'Keep away from negative influences that drain your enthusiasm.',
  },
  'look around': {
    urduMeaning: 'اِدھر اُدھر دیکھنا / جائزہ لینا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'look uh-ROWND',
    exampleSentence: 'We spent the morning looking around the historic architecture.',
  },
  'turn up': {
    urduMeaning: 'آ پہنچنا / آواز بڑھانا / سامنے آنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'turn up',
    exampleSentence: '(1) Arrive: He turned up late to the event. (2) Volume: Please turn up the radio.',
  },
  'turn off': {
    urduMeaning: 'بند کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'turn awf',
    exampleSentence: 'Remember to turn off the lights before locking the doors.',
  },
  'turn on': {
    urduMeaning: 'چلانا / آن کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'turn on',
    exampleSentence: 'Turn on the computer and open your vocabulary app.',
  },
  'find out about': {
    urduMeaning: 'معلومات حاصل کرنا / دریافت کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'fynd owt uh-BOWT',
    exampleSentence: 'I want to find out about the registration schedule for the course.',
  },
  'get in': {
    urduMeaning: 'اندر داخل ہونا / سوار ہونا / پہنچنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'get in',
    exampleSentence: '(1) Vehicle: Get in the car quickly. (2) Arrive: What time does your train get in?',
  },
  'get out': {
    urduMeaning: 'باہر نکلنا / اترنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'get owt',
    exampleSentence: 'You can get out of the car right in front of the main entrance.',
  },
  'move on': {
    urduMeaning: 'آگے بڑھنا / نیا آغاز کرنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'moov on',
    exampleSentence: "It was a tough setback, but it's time to move on and work hard.",
  },
  'keep on': {
    urduMeaning: 'مسلسل کرتے رہنا / جاری رکھنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'keep on',
    exampleSentence: 'Keep on practicing every day and your vocabulary will expand rapidly.',
  },
  'watch out': {
    urduMeaning: 'خبردار رہنا / ہوشیار رہنا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'woch owt',
    exampleSentence: 'Watch out for heavy traffic when crossing this busy junction.',
  },
  'take after': {
    urduMeaning: 'مشابہ ہونا / عادت یا شکل میں کسی پر جانا',
    partOfSpeech: 'phrasal verb',
    pronunciation: 'tayk AF-tur',
    exampleSentence: 'He takes after his father in both his intellect and calm demeanor.',
  },
};

// Register all offline seed words into the fast lookup dictionary
function registerWords(list: Word[]) {
  for (const item of list) {
    const key = item.english.toLowerCase().trim();
    if (!DICTIONARY[key]) {
      DICTIONARY[key] = {
        urduMeaning: item.urduMeaning,
        partOfSpeech: item.partOfSpeech || item.category || 'word',
        pronunciation: item.pronunciation || item.english.toLowerCase(),
        exampleSentence: item.exampleSentence || `Practice using "${item.english}" in your conversations.`,
      };
    }
  }
}
registerWords(SEED_COLLOCATIONS);
registerWords(SEED_AFFIXES);
registerWords(SEED_CONFUSED_WORDS);
registerWords(SEED_HOMOPHONES);
registerWords(SEED_PRONOUNS);

const COMMON_SENTENCES: Record<string, string> = {
  'the meeting was postponed': 'میٹنگ ملتوی کر دی گئی۔',
  'she speaks with great confidence': 'وہ بڑے اعتماد کے ساتھ بات کرتی ہے۔',
  'hard work always pays off': 'محنت کا پھل ہمیشہ ملتا ہے۔',
  'consistency is the key to success': 'استقلال اور تسلسل ہی کامیابی کی کلید ہے۔',
  'never give up on your goals': 'اپنے مقاصد کے حصول کے لیے کبھی ہار نہ مانیں۔',
  'what do you do every day': 'آپ ہر روز کیا کرتے ہیں؟',
  'where do you go every day': 'آپ ہر روز کہاں جاتے ہیں؟',
  'when do you wake up': 'آپ کب جاگتے ہیں؟',
  'why do you want to learn english': 'آپ انگریزی کیوں سیکھنا چاہتے ہیں؟',
  'how do you solve this problem': 'آپ اس مسئلے کو کیسے حل کرتے ہیں؟',
  'how often do you practice': 'آپ کتنی بار مشق کرتے ہیں؟',
  'how long does it take': 'کتنا وقت لگتا ہے؟',
  'how much does this cost': 'اس کی قیمت کتنی ہے؟',
  'how many hours do you work': 'آپ کتنے گھنٹے کام کرتے ہیں؟',
  'i want to improve my vocabulary': 'میں اپنی ذخیرہ الفاظ کو بہتر بنانا چاہتا ہوں۔',
  'practice makes a man perfect': 'مشق انسان کو کامل بناتی ہے۔',
  'where are you going': 'آپ کہاں جا رہے ہیں؟',
  'what is your name': 'آپ کا نام کیا ہے؟',
  'how are you': 'آپ کیسے ہیں؟',
};

function guessPartOfSpeech(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.includes(' ')) return 'phrase';
  if (w.endsWith('ly')) return 'adverb';
  if (
    w.endsWith('tion') ||
    w.endsWith('sion') ||
    w.endsWith('ment') ||
    w.endsWith('ness') ||
    w.endsWith('ity') ||
    w.endsWith('ance') ||
    w.endsWith('ence')
  ) {
    return 'noun';
  }
  if (
    w.endsWith('able') ||
    w.endsWith('ible') ||
    w.endsWith('al') ||
    w.endsWith('ful') ||
    w.endsWith('ic') ||
    w.endsWith('ive') ||
    w.endsWith('ous') ||
    w.endsWith('less')
  ) {
    return 'adjective';
  }
  if (
    w.endsWith('ed') ||
    w.endsWith('ing') ||
    w.endsWith('ize') ||
    w.endsWith('ise') ||
    w.endsWith('ate') ||
    w.endsWith('en')
  ) {
    return 'verb';
  }
  return 'word';
}

function offlineSentenceTranslate(sentence: string): string {
  const clean = sentence.trim().replace(/[.,!?;]+$/, '');
  const lower = clean.toLowerCase();

  if (COMMON_SENTENCES[lower]) {
    return COMMON_SENTENCES[lower];
  }

  // Common Question pattern heuristics for offline translation
  if (lower.startsWith('what do you')) {
    return `آپ کیا کرتے ہیں؟ ("${clean}")`;
  }
  if (lower.startsWith('where do you')) {
    return `آپ کہاں جاتے ہیں یا کرتے ہیں؟ ("${clean}")`;
  }
  if (lower.startsWith('when do you')) {
    return `آپ کب کرتے ہیں؟ ("${clean}")`;
  }
  if (lower.startsWith('why do you')) {
    return `آپ کیوں کرتے ہیں؟ ("${clean}")`;
  }
  if (lower.startsWith('how do you')) {
    return `آپ کیسے کرتے ہیں؟ ("${clean}")`;
  }
  if (lower.startsWith('how often do you')) {
    return `آپ کتنی بار کرتے ہیں؟ ("${clean}")`;
  }
  if (lower.startsWith('how long does')) {
    return `کتنا وقت لگتا ہے؟ ("${clean}")`;
  }
  if (lower.startsWith('how much')) {
    return `کتنی مقدار یا قیمت ہے؟ ("${clean}")`;
  }
  if (lower.startsWith('how many')) {
    return `کتنے یا کتنی تعداد ہے؟ ("${clean}")`;
  }
  if (lower.startsWith('can you')) {
    return `کیا آپ کر سکتے ہیں؟ ("${clean}")`;
  }

  return `اس جملے کا بامعنی اردو ترجمہ: "${clean}"`;
}

export class MockAIService implements AIService {
  async enrichWord(word: string): Promise<WordEnrichment> {
    const cleanWord = word.trim();
    const normalized = cleanWord.toLowerCase();
    if (DICTIONARY[normalized]) {
      return DICTIONARY[normalized];
    }

    // Try without trailing punctuation or dashes
    const stripped = normalized.replace(/^[-_]+|[-_]+$/g, '');
    if (DICTIONARY[stripped]) {
      return DICTIONARY[stripped];
    }

    const pos = guessPartOfSpeech(cleanWord);
    return {
      urduMeaning: `${cleanWord} کا بامعنی اردو ترجمہ`,
      partOfSpeech: pos,
      pronunciation: cleanWord.toLowerCase(),
      exampleSentence: `Practice using "${cleanWord}" in your daily conversations.`,
    };
  }

  async translateSentence(sentence: string): Promise<string> {
    return offlineSentenceTranslate(sentence);
  }
}
