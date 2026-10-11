'use strict';

/* ═══════════════════════════════════════════════════════════
   KOREAN BY HANJA — standalone quiz app
   Învață coreeana prin 214 rădăcini sino-coreene: citirea în
   Hangul a fiecărei rădăcini, sensul ei, și cuvintele coreene
   reale formate combinând-o cu alte silabe. Caracterul chinezesc
   (hanja) NU e niciodată subiectul unei întrebări — apare doar ca
   etichetă mică, pentru a distinge rădăcini omofone (ex. 수 = apă/
   mână/cine/trebuie, după hanja de origine). Nu învățăm caracterele
   ca scriere chinezească, doar coreeana pe care o construiesc.
   Complet independentă — nu are legătură cu alte proiecte,
   propriile chei localStorage, propriul motor de scor și SRS.
   ═══════════════════════════════════════════════════════════ */

/* ── tiny storage helper ─────────────────────────────────── */
var Store = {
  get: function(key, def) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? def : JSON.parse(raw);
    } catch (e) { return def; }
  },
  set: function(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
};

/* Câteva hanja (年, 力, 金, 老) au două citiri valide în coreeană,
   stocate ca "년 연" (regulă de sunet inițial / 두음법칙). Prima
   listată e citirea principală, folosită pentru quiz și vorbire;
   la evidențiere încercăm toate citirile, ca să găsim cea folosită
   efectiv în cuvântul curent. */
function readingList(item) {
  return item.ko_reading.split(' ').filter(Boolean);
}
function primaryReading(item) {
  return readingList(item)[0];
}

/* Evidențiază silaba din cuvânt care corespunde citirii acestui hanja —
   nu presupunem NICIODATĂ care hanja e cealaltă silabă (multe silabe
   coreene au 3-5 hanja omofone posibile în acest set; o presupunere
   greșită ar preda o asociere hanja greșită). Evidențiem doar silaba
   verificată, cea a hanja-ului curent. */
function highlightSyllable(word, item) {
  if (!word) return word;
  var readings = readingList(item);
  for (var i = 0; i < readings.length; i++) {
    var syllable = readings[i];
    if (word.indexOf(syllable) >= 0) {
      return word.replace(syllable, '<span class="hl">' + syllable + '</span>');
    }
  }
  return word;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Silaba coreeană mare, cu hanja-ul de origine ca etichetă mică, gri —
   NICIODATĂ ca subiect de recunoscut/ales, doar ca dezambiguare vizuală
   pentru omofone (ex. 수 = 水/apă, 手/mână, 誰/cine, 須/trebuie — fără
   etichetă, cele 4 ar arăta identic într-un quiz). */
function rootDisplay(item) {
  return '<span class="rootMain">' + escapeHtml(primaryReading(item)) + '</span>' +
         '<span class="rootTag">' + escapeHtml(item.hanja) + '</span>';
}

/* Index every hanja character across the 214 entries, keyed by the
   character itself (not by reading — a Korean syllable is very often a
   homophone for 3-5 different hanja, so "this syllable has only one
   match in our 214-entry set" does NOT prove that match is the word's
   true source hanja; it only proves no collision inside our small
   reference set, while the real character is often a different one we
   don't even have). We learned this the hard way: an earlier version of
   this feature resolved 학교 as 學+交 (school as "learn"+"exchange")
   instead of the true 學+校, because 校 simply isn't in our 214 set —
   the auto-heuristic couldn't tell "unique here" apart from "correct". */
function buildHanjaIndex() {
  hanjaIndex = {};
  DATA.forEach(function(item) { hanjaIndex[item.hanja] = item; });
}

/* Un hanja poate veni fie din cele 214 rădăcini (hanjaIndex, cu etimologie
   completă), fie din EXTRA_HANJA (data/extra-hanja.js) — un mic set
   suplimentar, verificat la fel de atent, folosit DOAR ca să completăm
   descompunerea unor cuvinte ale căror silabe nu se rezolvă toate în cele
   214. Întoarce mereu aceeași formă {hanja, reading, meaning}, indiferent
   de sursă, sau null dacă hanja-ul nu e cunoscut din niciuna. */
function resolveHanja(h) {
  var core = hanjaIndex[h];
  if (core) return { hanja: h, reading: primaryReading(core), meaning: core.meaning };
  var extra = (typeof EXTRA_HANJA !== 'undefined') ? EXTRA_HANJA[h] : null;
  if (extra) return { hanja: h, reading: extra.reading.split(' ')[0], meaning: extra.meaning };
  return null;
}

/* Descompunerea unui cuvânt: DOAR pentru cuvintele din VERIFIED_BREAKDOWNS
   (data/verified-breakdowns.js) — o listă verificată manual, silabă cu
   silabă, hanja cu hanja, nu dedusă automat din unicitatea în set.
   Pentru orice alt cuvânt întoarcem null și rămâne formatul obișnuit
   (silabă evidențiată + traducere) — nu ghicim niciodată. */
function wordBreakdown(word) {
  var hanjaChars = VERIFIED_BREAKDOWNS[word.ko];
  if (!hanjaChars) return null;
  var chars = word.ko.split('');
  if (chars.length !== hanjaChars.length) return null;
  var syllables = hanjaChars.map(resolveHanja);
  if (syllables.some(function(s) { return !s; })) return null;
  return {
    chars: chars,
    syllables: syllables,
    meanings: syllables.map(function(s) { return s.meaning[lang] || s.meaning.ro; })
  };
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

/* ── spaced repetition (SM-2 with short early learning steps) ── */
function srsStep(current, correct) {
  var MIN = 60000, DAY = 86400000;
  var s = Object.assign({ reps: 0, ease: 2.5, interval: 1, due: 0 }, current || {});
  if (correct) {
    s.reps++;
    if      (s.reps === 1) { s.interval = 1; s.due = Date.now() + 10 * MIN; }
    else if (s.reps === 2) { s.interval = 1; s.due = Date.now() + DAY; }
    else {
      s.interval = Math.round(s.interval * s.ease);
      s.ease     = Math.min(2.9, s.ease + 0.05);
      s.due      = Date.now() + s.interval * DAY;
    }
  } else {
    s.ease = Math.max(1.3, s.ease - 0.15);
    s.reps = 0;
    s.interval = 1;
    s.due  = Date.now() + MIN;
  }
  return s;
}

/* ── speech ───────────────────────────────────────────────── */
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  var voices = speechSynthesis.getVoices().filter(function(v) {
    return v.lang && v.lang.toLowerCase().indexOf('ko') === 0;
  });
  if (voices.length) u.voice = voices[0];
  speechSynthesis.cancel();
  setTimeout(function() { speechSynthesis.speak(u); }, 30);
}

/* ── XP / level economy (self-contained, no external module) ── */
var XP_LEVELS = [
  { level: 1, min: 0,    title_ro: '🌱 Începător',        title_en: '🌱 Beginner' },
  { level: 2, min: 100,  title_ro: '📖 Ucenic Hanja',      title_en: '📖 Hanja Apprentice' },
  { level: 3, min: 300,  title_ro: '🖌 Caligraf',          title_en: '🖌 Calligrapher' },
  { level: 4, min: 700,  title_ro: '🏛 Cărturar',          title_en: '🏛 Scholar' },
  { level: 5, min: 1400, title_ro: '⛩ Maestru Hanja',      title_en: '⛩ Hanja Master' }
];
function xpLevel(total) {
  var info = XP_LEVELS[0];
  for (var i = 0; i < XP_LEVELS.length; i++) if (total >= XP_LEVELS[i].min) info = XP_LEVELS[i];
  return info;
}
function xpGain(streak) {
  if (streak >= 20) return 30;
  if (streak >= 10) return 25;
  if (streak >= 5)  return 20;
  if (streak >= 3)  return 15;
  return 10;
}

/* ── app state ────────────────────────────────────────────── */
var DATA = [];
var hanjaIndex = {}; // hanja character -> DATA entry
var lang = Store.get('KBH_LANG', 'ro');
var srsData = Store.get('KBH_SRS', {});
var xpData = Store.get('KBH_XP', { total: 0 });

var queue = [];       // array of DATA indices, prioritized by SRS due date
var current = null;   // { item, di, type, correctVal, options, wordUsed }
var locked = false;

var session = { correct: 0, total: 0, streak: 0 };

var mode = 'learn';   // 'learn' | 'practice' | 'puzzle'
var learnPos = Store.get('KBH_LEARN_POS', 0);

/* "Recapitulare greșeli" — when on, both queues below pull only from
   roots currently at reps===0 (attempted before, not yet recovered to
   mastery) instead of the normal SRS-due pool. Derived live from
   srsData, no separate tracking needed. */
var reviewMode = false;

var puzzleQueue = [];      // array of DATA indices, prioritized by SRS due date (own queue, independent of Practice's)
var puzzleCurrent = null;  // { di, item, word, tiles: [{id,ch}], placed: [id,...] }
var puzzleLocked = false;

/* Decoy tile count per answer length, by difficulty — 'normal' is the
   original fixed values. */
var PUZZLE_DECOYS = {
  easy:   { 2: 2, 3: 2, more: 1 },
  normal: { 2: 4, 3: 3, more: 2 },
  hard:   { 2: 6, 3: 5, more: 4 }
};
var puzzleDifficulty = Store.get('KBH_PUZZLE_DIFF', 'normal');
if (!PUZZLE_DECOYS[puzzleDifficulty]) puzzleDifficulty = 'normal';

/* "Exersează lecția" — a bounded, non-repeating round of (word, type)
   question combinations drawn only from the root currently open in
   Learn (learnPos), instead of Practice's normal open-ended SRS-wide
   stream. Every word under that root gets its chance (via
   word-meaning + meaning-word for each, plus breakdown-word for the
   ones with a verified breakdown), shuffled and capped at
   LESSON_ROUND_SIZE so repeats within one round are impossible until
   the pool itself is exhausted. */
var LESSON_ROUND_SIZE = 20;
var lessonRoundActive = false;
var lessonRoundMode = null;   // 'single' (just this root) | 'cumulative' (every root so far)
var lessonRoundDi = null;     // for 'single'
var lessonRoundMaxDi = null;  // for 'cumulative'
var lessonRoundQueue = [];
var lessonRoundIndex = 0;
var lessonRoundScore = { correct: 0, total: 0 };

var TYPES = ['root-meaning', 'meaning-root', 'word-meaning', 'meaning-word', 'breakdown-word'];

var UI = {
  ro: {
    title: 'Korean by Hanja',
    sub: 'Învață coreeana prin 214 rădăcini sino-coreene',
    correct: 'Corecte', total: 'Total', streak: 'Streak', mastered: 'Stăpânite',
    prompts: {
      'root-meaning': 'Ce înseamnă această silabă coreeană?',
      'meaning-root': 'Care silabă coreeană are acest sens?',
      'word-meaning': 'Ce înseamnă silaba evidențiată din acest cuvânt?',
      'meaning-word': 'Care e cuvântul coreean corect?',
      'breakdown-word': 'Ce cuvânt formează aceste sensuri?'
    },
    correctMsg: 'Corect!', wrongMsg: 'Greșit',
    next: 'Următorul →',
    hlHint: 'Silaba evidențiată e cea din întrebare',
    tabLearn: 'Învață', tabPractice: 'Exersează', tabPuzzle: 'Puzzle',
    learnWords: 'Cuvinte care folosesc această silabă',
    learnEtym: 'Etimologie (context, nu se testează)',
    puzzleType: 'Formează cuvântul',
    puzzleRoot: 'rădăcină',
    puzzleWrongMsg: 'Cuvântul corect era',
    footer: 'Aplicație independentă · fără cont, fără server · progresul se salvează local, în acest browser',
    statsTitle: 'Statistici', statsToday: 'Azi', statsStreak: 'Cel mai bun streak',
    statsTotal: 'Total răspunsuri', statsAccuracy: 'Acuratețe', statsMastered: 'Rădăcini stăpânite',
    statsLevel: 'Nivel', statsNoData: 'Niciun răspuns încă — începe din Exersează sau Puzzle.',
    review: 'Recapitulare',
    reviewOnHint: 'Recapitulare activă — exersezi doar greșelile. Apasă ca să oprești.',
    reviewOffHint: 'Exersează doar rădăcinile greșite recent',
    diffEasy: 'Ușor', diffNormal: 'Normal', diffHard: 'Greu',
    lessonRoundBtn: '🎯 Exersează lecția asta ({n} întrebări)',
    lessonRoundProgress: 'Lecție: {i} / {n}',
    lessonRoundExit: 'Ieși din lecție',
    roundDoneMsg: 'Lecție terminată!',
    roundAgain: '↺ Din nou',
    roundExit: '← Exersare liberă',
    cumulativeRoundBtn: '📚 Recapitulare generală ({n} întrebări)',
    cumulativeRoundProgress: 'Recapitulare generală: {i} / {n}'
  },
  en: {
    title: 'Korean by Hanja',
    sub: 'Learn Korean through 214 Sino-Korean roots',
    correct: 'Correct', total: 'Total', streak: 'Streak', mastered: 'Mastered',
    prompts: {
      'root-meaning': 'What does this Korean syllable mean?',
      'meaning-root': 'Which Korean syllable has this meaning?',
      'word-meaning': 'What does the highlighted syllable mean in this word?',
      'meaning-word': 'Which is the correct Korean word?',
      'breakdown-word': 'Which word do these meanings form?'
    },
    correctMsg: 'Correct!', wrongMsg: 'Wrong',
    next: 'Next →',
    hlHint: 'The highlighted syllable is the one being asked about',
    tabLearn: 'Learn', tabPractice: 'Practice', tabPuzzle: 'Puzzle',
    learnWords: 'Words that use this syllable',
    learnEtym: 'Etymology (background, not tested)',
    puzzleType: 'Build the word',
    puzzleRoot: 'root',
    puzzleWrongMsg: 'The correct word was',
    footer: 'Standalone app · no account, no server · progress is saved locally in this browser',
    statsTitle: 'Statistics', statsToday: 'Today', statsStreak: 'Best streak',
    statsTotal: 'Total answers', statsAccuracy: 'Accuracy', statsMastered: 'Roots mastered',
    statsLevel: 'Level', statsNoData: 'No answers yet — start in Practice or Puzzle.',
    review: 'Review',
    reviewOnHint: 'Review mode active — only recent mistakes. Click to stop.',
    reviewOffHint: 'Practice only your recently-missed roots',
    diffEasy: 'Easy', diffNormal: 'Normal', diffHard: 'Hard',
    lessonRoundBtn: '🎯 Practice this lesson ({n} questions)',
    lessonRoundProgress: 'Lesson: {i} / {n}',
    lessonRoundExit: 'Exit lesson',
    roundDoneMsg: 'Lesson complete!',
    roundAgain: '↺ Again',
    roundExit: '← Free practice',
    cumulativeRoundBtn: '📚 General review ({n} questions)',
    cumulativeRoundProgress: 'General review: {i} / {n}'
  }
};
function t() { return UI[lang]; }

/* ── DOM refs ─────────────────────────────────────────────── */
var elCorrect  = document.getElementById('bCorrect');
var elTotal    = document.getElementById('bTotal');
var elStreak   = document.getElementById('bStreak');
var elXP       = document.getElementById('bXP');
var elMastered = document.getElementById('bMastered');
var elReview     = document.getElementById('bReview');
var elReviewText = document.getElementById('bReviewText');
var elBarFill  = document.getElementById('barFill');
var elTypeLbl  = document.getElementById('typeLabel');
var elPrompt   = document.getElementById('promptText');
var elPromptSub= document.getElementById('promptSub');
var elPromptHint = document.getElementById('promptHint');
var elSpeakBtn = document.getElementById('speakBtn');
var elAnswers  = document.getElementById('answers');
var elFeedback = document.getElementById('feedback');
var elNextBtn  = document.getElementById('nextBtn');
var elTitle    = document.getElementById('pgTitle');
var elSub      = document.getElementById('pgSub');
var elLangBtn  = document.getElementById('langBtn');
var elDarkBtn  = document.getElementById('darkBtn');
var elFooter   = document.getElementById('footerNote');

var elTabLearn    = document.getElementById('tabLearn');
var elTabPractice = document.getElementById('tabPractice');
var elTabPuzzle   = document.getElementById('tabPuzzle');
var elLearnView   = document.getElementById('learnView');
var elPracticeView= document.getElementById('practiceView');
var elPuzzleView  = document.getElementById('puzzleView');
var elLearnPrev   = document.getElementById('learnPrev');
var elLearnNext   = document.getElementById('learnNext');
var elLearnPos    = document.getElementById('learnPos');
var elLearnRoot   = document.getElementById('learnRoot');
var elLearnSpeak  = document.getElementById('learnSpeak');
var elLearnMeaning= document.getElementById('learnMeaning');
var elLearnWordsLabel = document.getElementById('learnWordsLabel');
var elLearnWords  = document.getElementById('learnWords');
var elLearnEtymLabel = document.getElementById('learnEtymLabel');
var elLearnEtym   = document.getElementById('learnEtym');

var elPuzzleTypeLabel = document.getElementById('puzzleTypeLabel');
var elPuzzleHintChip  = document.getElementById('puzzleHintChip');
var elPuzzlePrompt    = document.getElementById('puzzlePrompt');
var elPuzzleSpeak     = document.getElementById('puzzleSpeak');
var elAnswerSlots     = document.getElementById('answerSlots');
var elTileBank        = document.getElementById('tileBank');
var elPuzzleFeedback  = document.getElementById('puzzleFeedback');
var elPuzzleNextBtn   = document.getElementById('puzzleNextBtn');
var elPuzzleDiffBtns  = document.querySelectorAll('.puzzleDiffBtn');

var elLessonRoundBtn      = document.getElementById('lessonRoundBtn');
var elCumulativeRoundBtn  = document.getElementById('cumulativeRoundBtn');
var elLessonRoundBar      = document.getElementById('lessonRoundBar');
var elLessonRoundProgress = document.getElementById('lessonRoundProgress');
var elLessonRoundExit     = document.getElementById('lessonRoundExit');
var elRoundSummary        = document.getElementById('roundSummary');
var elRoundSummaryEmoji   = document.getElementById('roundSummaryEmoji');
var elRoundSummaryMsg     = document.getElementById('roundSummaryMsg');
var elRoundSummaryScore   = document.getElementById('roundSummaryScore');
var elRoundSummaryAgain   = document.getElementById('roundSummaryAgain');
var elRoundSummaryExit    = document.getElementById('roundSummaryExit');

var elSearchBtn     = document.getElementById('searchBtn');
var elSearchOverlay = document.getElementById('searchOverlay');
var elSearchInput   = document.getElementById('searchInput');
var elSearchClear   = document.getElementById('searchClear');
var elSearchResults = document.getElementById('searchResults');

var elStrokeBtn     = document.getElementById('strokeBtn');
var elStrokePanel   = document.getElementById('strokePanel');
var elStrokeClose   = document.getElementById('strokeClose');
var elStrokeTitle   = document.getElementById('strokeTitle');
var elStrokeWriter  = document.getElementById('strokeWriter');
var elStrokeAnimate = document.getElementById('strokeAnimate');
var elStrokeQuiz    = document.getElementById('strokeQuiz');

var elStatsBtn   = document.getElementById('statsBtn');
var elStatsPanel = document.getElementById('statsPanel');
var elStatsClose = document.getElementById('statsClose');
var elStatsTitle = document.getElementById('statsTitle');
var elStatsGrid  = document.getElementById('statsGrid');
var elStatsExport    = document.getElementById('statsExport');
var elStatsImport     = document.getElementById('statsImport');
var elStatsImportFile = document.getElementById('statsImportFile');

/* ── boot ─────────────────────────────────────────────────── */
fetch('./data/hanja.json')
  .then(function(r) { return r.json(); })
  .then(function(data) { DATA = data; boot(); })
  .catch(function() { if (elPrompt) elPrompt.textContent = '⚠️'; });

function boot() {
  applyTheme();
  buildHanjaIndex();
  renderStatic();
  updateBadges();
  buildQueue();
  nextQuestion();
  buildPuzzleQueue();
  nextPuzzle();
  setMode('learn');
  renderLearn();

  elLangBtn.addEventListener('click', function() {
    lang = lang === 'ro' ? 'en' : 'ro';
    Store.set('KBH_LANG', lang);
    renderStatic();
    updateBadges();
    if (current) renderQuestion();
    renderLearn();
    if (puzzleCurrent) renderPuzzle();
    renderLessonRoundProgress();
    if (!elRoundSummary.classList.contains('hidden')) showRoundSummary();
  });
  elDarkBtn.addEventListener('click', function() {
    var isDark = !document.body.classList.contains('dark-mode');
    document.body.classList.toggle('dark-mode', isDark);
    Store.set('KBH_THEME', isDark ? 'dark' : 'light');
    elDarkBtn.textContent = isDark ? '◑' : '◐';
  });
  elSpeakBtn.addEventListener('click', function() {
    if (current && current.item) speak(primaryReading(current.item) || current.item.hanja);
  });
  elNextBtn.addEventListener('click', function() {
    if (locked) nextQuestion();
  });

  elTabLearn.addEventListener('click', function() { setMode('learn'); });
  elTabPractice.addEventListener('click', function() { setMode('practice'); });
  elTabPuzzle.addEventListener('click', function() { setMode('puzzle'); });
  elLearnPrev.addEventListener('click', function() { goLearn(-1); });
  elLearnNext.addEventListener('click', function() { goLearn(1); });
  elLearnSpeak.addEventListener('click', function() {
    speak(primaryReading(DATA[learnPos]));
  });
  elLearnWords.addEventListener('click', function(e) {
    var btn = e.target.closest('.lwSpeak');
    if (btn) speak(btn.dataset.say);
  });

  elPuzzleSpeak.addEventListener('click', function() {
    if (puzzleCurrent) speak(puzzleCurrent.word.ko);
  });
  elPuzzleNextBtn.addEventListener('click', function() {
    if (puzzleLocked) nextPuzzle();
  });
  elTileBank.addEventListener('click', function(e) {
    var btn = e.target.closest('.tile');
    if (btn && !btn.classList.contains('used')) placeTile(Number(btn.dataset.id));
  });
  elAnswerSlots.addEventListener('click', function(e) {
    var slot = e.target.closest('.slot.filled');
    if (slot && !puzzleLocked) removeTile(Number(slot.dataset.id));
  });

  elSearchBtn.addEventListener('click', openSearch);
  elSearchClear.addEventListener('click', function() {
    elSearchInput.value = '';
    elSearchResults.innerHTML = '';
    elSearchInput.focus();
  });
  elSearchInput.addEventListener('input', function() { doSearch(this.value); });
  elSearchOverlay.addEventListener('click', function(e) {
    if (e.target === elSearchOverlay) closeSearch();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeSearch(); closeStroke(); closeStats(); return; }
    if (e.key !== '/') return;
    if (!elSearchOverlay.classList.contains('hidden')) return;
    if (e.target === elSearchInput) return;
    e.preventDefault();
    openSearch();
  });

  elStrokeBtn.addEventListener('click', openStroke);
  elStrokeClose.addEventListener('click', closeStroke);
  elStrokePanel.addEventListener('click', function(e) {
    if (e.target === elStrokePanel) closeStroke();
  });
  elStrokeAnimate.addEventListener('click', function() { if (hwWriter) hwWriter.animateCharacter(); });
  elStrokeQuiz.addEventListener('click', function() { if (hwWriter) hwWriter.quiz(); });

  elStatsBtn.addEventListener('click', openStats);
  elStatsClose.addEventListener('click', closeStats);
  elStatsPanel.addEventListener('click', function(e) {
    if (e.target === elStatsPanel) closeStats();
  });
  elStatsExport.addEventListener('click', exportProgress);
  elStatsImport.addEventListener('click', function() { elStatsImportFile.click(); });
  elStatsImportFile.addEventListener('change', function() {
    if (this.files[0]) importProgressFile(this.files[0]);
    this.value = '';
  });

  elReview.addEventListener('click', toggleReviewMode);

  elPuzzleDiffBtns.forEach(function(btn) {
    btn.addEventListener('click', function() { setPuzzleDifficulty(btn.dataset.diff); });
  });
  syncPuzzleDiffButtons();

  elLessonRoundBtn.addEventListener('click', function() { startLessonRound(learnPos); });
  elCumulativeRoundBtn.addEventListener('click', function() { startCumulativeRound(learnPos); });
  elLessonRoundExit.addEventListener('click', exitLessonRound);
  elRoundSummaryAgain.addEventListener('click', restartRound);
  elRoundSummaryExit.addEventListener('click', exitLessonRound);
}

/* ── search — jump straight to any of the 214 roots ──────────
   Matches on the hanja itself, its Hangul reading(s), or its
   meaning in either language; ranked so an exact/prefix match on
   the reading beats a loose meaning match. */
function openSearch() {
  elSearchOverlay.classList.remove('hidden');
  elSearchInput.value = '';
  elSearchResults.innerHTML = '';
  setTimeout(function() { elSearchInput.focus(); }, 60);
}

function closeSearch() {
  elSearchOverlay.classList.add('hidden');
}

function doSearch(q) {
  elSearchResults.innerHTML = '';
  if (!q.trim()) return;
  var ql = q.trim().toLowerCase();
  var hits = [];
  for (var i = 0; i < DATA.length; i++) {
    var d = DATA[i];
    var reading = primaryReading(d);
    var meaningL = (d.meaning[lang] || d.meaning.ro).toLowerCase();
    var meaningRo = d.meaning.ro.toLowerCase();
    var meaningEn = d.meaning.en.toLowerCase();
    var score = 0;
    if (d.hanja === q)                          score = 100;
    else if (readingList(d).indexOf(ql) >= 0)   score = 80;
    else if (reading.indexOf(ql) === 0)         score = 70;
    else if (meaningL.indexOf(ql) === 0)        score = 60;
    else if (meaningRo.indexOf(ql) >= 0)        score = 40;
    else if (meaningEn.indexOf(ql) >= 0)        score = 35;
    else if (reading.indexOf(ql) >= 0)          score = 30;
    if (score > 0) hits.push({ i: i, score: score });
  }
  hits.sort(function(a, b) { return b.score - a.score; });
  hits = hits.slice(0, 20);
  if (!hits.length) {
    elSearchResults.innerHTML = '<div class="searchEmpty">' + (lang === 'ro' ? 'Niciun rezultat' : 'No results') + '</div>';
    return;
  }
  hits.forEach(function(h) {
    var d  = DATA[h.i];
    var el = document.createElement('div');
    el.className = 'searchItem';
    el.innerHTML =
      '<span class="si-glyph">' + escapeHtml(d.hanja) + '</span>' +
      '<span class="si-info">' +
        '<span class="si-reading">' + escapeHtml(primaryReading(d)) + ' · ' + escapeHtml(d.meaning[lang] || d.meaning.ro) + '</span>' +
        '<span class="si-pos">#' + (h.i + 1) + '</span>' +
      '</span>';
    el.addEventListener('click', function() {
      closeSearch();
      learnPos = h.i;
      Store.set('KBH_LEARN_POS', learnPos);
      setMode('learn');
      renderLearn();
    });
    elSearchResults.appendChild(el);
  });
}

/* ── stroke order — HanziWriter for the current Learn-mode root ──
   Writing/stroke order is never tested elsewhere in the app (this
   app teaches the Hangul reading, not Chinese calligraphy) — it's
   purely an optional reference/practice tool for the curious. */
var hwWriter = null;

function openStroke() {
  if (!DATA.length) return;
  var item = DATA[learnPos];
  var isDark = document.body.classList.contains('dark-mode');

  elStrokeTitle.textContent = item.hanja + '  ·  ' + primaryReading(item) + '  ·  ' + (item.meaning[lang] || item.meaning.ro);

  elStrokeWriter.innerHTML = '';
  hwWriter = null;

  if (typeof HanziWriter !== 'undefined') {
    hwWriter = HanziWriter.create('strokeWriter', item.hanja, {
      width: 200, height: 200, padding: 16,
      showOutline: true,
      strokeColor: isDark ? '#f2e9d8' : '#211c14',
      outlineColor: isDark ? 'rgba(242,233,216,.1)' : 'rgba(33,28,20,.12)',
      drawingColor: '#b3402c',
      highlightColor: '#c9973a',
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 180
    });
    hwWriter.animateCharacter();
  } else {
    elStrokeWriter.style.cssText = 'font-size:140px;line-height:200px;text-align:center;font-family:"Noto Sans KR",sans-serif;color:var(--ink)';
    elStrokeWriter.textContent = item.hanja;
  }

  elStrokePanel.classList.remove('hidden');
}

function closeStroke() {
  elStrokePanel.classList.add('hidden');
  hwWriter = null;
}

/* ── STATS ─────────────────────────────────────────────── */
function openStats() {
  renderStats();
  elStatsPanel.classList.remove('hidden');
}

function closeStats() {
  elStatsPanel.classList.add('hidden');
}

function renderStats() {
  var l = t();
  elStatsTitle.textContent = l.statsTitle;

  var s = Store.get('KBH_STATS', null);
  var mastered = masteredCount();
  var lvl = xpLevel(xpData.total);

  if (!s || s.total === 0) {
    elStatsGrid.innerHTML = '<div class="statRow statWide"><div class="statLabel">' + escapeHtml(l.statsNoData) + '</div></div>';
    return;
  }

  var todayPct = s.todayTotal ? Math.round((s.todayCorrect / s.todayTotal) * 100) : 0;
  var totalPct = s.total ? Math.round((s.correct / s.total) * 100) : 0;

  function row(label, value, sub) {
    return '<div class="statRow"><span class="statLabel">' + escapeHtml(label) + '</span>' +
      '<span class="statValue">' + escapeHtml(String(value)) + (sub ? '<span class="statSub">' + escapeHtml(sub) + '</span>' : '') + '</span></div>';
  }
  function barRow(label, value, pct) {
    return '<div class="statRow statWide">' +
      '<div style="display:flex;justify-content:space-between"><span class="statLabel">' + escapeHtml(label) + '</span>' +
      '<span class="statValue">' + escapeHtml(String(value)) + '</span></div>' +
      '<div class="statBarBg"><div class="statBarFill" style="width:' + pct + '%"></div></div></div>';
  }

  elStatsGrid.innerHTML =
    barRow(l.statsToday, s.todayCorrect + '/' + s.todayTotal + ' (' + todayPct + '%)', todayPct) +
    barRow(l.statsTotal, s.correct + '/' + s.total + ' (' + totalPct + '%)', totalPct) +
    row(l.statsStreak, s.bestStreak) +
    row(l.statsMastered, mastered + '/' + DATA.length) +
    row(l.statsLevel, '⭐ ' + xpData.total + ' XP · ' + (lvl['title_' + lang] || lvl.title_ro));
}

/* ── BACKUP (export/import progress) ──────────────────────
   Everything lives only in this browser's localStorage, so clearing
   site data or switching devices loses it all with no warning. This
   lets a user save a snapshot and restore it elsewhere, with no
   server involved — the file never leaves their machine except by
   their own choice. */
var BACKUP_KEYS = ['KBH_LANG', 'KBH_THEME', 'KBH_LEARN_POS', 'KBH_SRS', 'KBH_XP', 'KBH_STATS'];

function exportProgress() {
  var payload = { app: 'korean-by-hanja', version: 1, exportedAt: new Date().toISOString(), data: {} };
  BACKUP_KEYS.forEach(function(k) {
    var raw = localStorage.getItem(k);
    if (raw !== null) {
      try { payload.data[k] = JSON.parse(raw); } catch (e) {}
    }
  });
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'korean-by-hanja-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importProgressFile(file) {
  var isRo = lang === 'ro';
  var reader = new FileReader();
  reader.onload = function() {
    var parsed;
    try { parsed = JSON.parse(reader.result); } catch (e) {
      alert(isRo ? 'Fișierul nu e un JSON valid.' : 'That file is not valid JSON.');
      return;
    }
    if (!parsed || parsed.app !== 'korean-by-hanja' || !parsed.data) {
      alert(isRo ? 'Acesta nu pare un fișier de backup Korean by Hanja.' : 'This doesn\'t look like a Korean by Hanja backup file.');
      return;
    }
    var msg = isRo
      ? 'Importul va înlocui tot progresul curent din acest browser (XP, repetiție spațiată, statistici). Continui?'
      : 'Importing will replace all current progress in this browser (XP, spaced repetition, stats). Continue?';
    if (!confirm(msg)) return;
    BACKUP_KEYS.forEach(function(k) {
      if (parsed.data[k] !== undefined) localStorage.setItem(k, JSON.stringify(parsed.data[k]));
    });
    location.reload();
  };
  reader.readAsText(file);
}

function setMode(m) {
  mode = m;
  elTabLearn.classList.toggle('active', m === 'learn');
  elTabPractice.classList.toggle('active', m === 'practice');
  elTabPuzzle.classList.toggle('active', m === 'puzzle');
  elLearnView.classList.toggle('hidden', m !== 'learn');
  elPracticeView.classList.toggle('hidden', m !== 'practice');
  elPuzzleView.classList.toggle('hidden', m !== 'puzzle');
}

function applyTheme() {
  var theme = Store.get('KBH_THEME', 'dark');
  var isDark = theme !== 'light';
  document.body.classList.toggle('dark-mode', isDark);
  if (elDarkBtn) elDarkBtn.textContent = isDark ? '◑' : '◐';
}

function renderStatic() {
  var l = t();
  elTitle.textContent = l.title;
  elSub.textContent = l.sub;
  elNextBtn.textContent = l.next;
  elLangBtn.textContent = lang;
  elFooter.textContent = l.footer;
  elTabLearn.textContent = l.tabLearn;
  elTabPractice.textContent = l.tabPractice;
  elTabPuzzle.textContent = l.tabPuzzle;
  elLearnWordsLabel.textContent = l.learnWords;
  elLearnEtymLabel.textContent = l.learnEtym;
  elPuzzleTypeLabel.textContent = l.puzzleType;
  elPuzzleNextBtn.textContent = l.next;
  elPuzzleDiffBtns.forEach(function(btn) {
    var key = 'diff' + btn.dataset.diff.charAt(0).toUpperCase() + btn.dataset.diff.slice(1);
    btn.textContent = l[key];
  });

  var isRo = lang === 'ro';
  elSearchBtn.title = isRo ? 'Caută (/)' : 'Search (/)';
  elSearchBtn.setAttribute('aria-label', isRo ? 'Caută' : 'Search');
  elSearchInput.placeholder = isRo ? 'Caută hanja, citire, sens…' : 'Search hanja, reading, meaning…';
  elSearchInput.setAttribute('aria-label', isRo ? 'Caută hanja, citire, sens' : 'Search hanja, reading, meaning');
  elSearchClear.setAttribute('aria-label', isRo ? 'Șterge căutarea' : 'Clear search');
  elStrokeBtn.title = isRo ? 'Ordinea trăsăturilor' : 'Stroke order';
  elStrokeBtn.setAttribute('aria-label', isRo ? 'Arată ordinea trăsăturilor' : 'Show stroke order');
  elStrokeClose.setAttribute('aria-label', isRo ? 'Închide' : 'Close');
  elDarkBtn.setAttribute('aria-label', isRo ? 'Schimbă tema' : 'Toggle theme');
  elLangBtn.setAttribute('aria-label', isRo ? 'Schimbă limba' : 'Switch language');
  elLearnPrev.setAttribute('aria-label', isRo ? 'Hanja anterior' : 'Previous hanja');
  elLearnNext.setAttribute('aria-label', isRo ? 'Hanja următor' : 'Next hanja');
  elLearnSpeak.setAttribute('aria-label', isRo ? 'Ascultă citirea' : 'Listen to reading');
  elSpeakBtn.setAttribute('aria-label', isRo ? 'Ascultă' : 'Listen');
  elPuzzleSpeak.setAttribute('aria-label', isRo ? 'Ascultă cuvântul' : 'Listen to word');
  elStatsBtn.title = isRo ? 'Statistici' : 'Statistics';
  elStatsBtn.setAttribute('aria-label', isRo ? 'Statistici' : 'Statistics');
  elStatsClose.setAttribute('aria-label', isRo ? 'Închide' : 'Close');
  if (!elStatsPanel.classList.contains('hidden')) renderStats();
}

/* ── mastery / progress ──────────────────────────────────── */
function masteredCount() {
  var n = 0;
  for (var k in srsData) if (srsData[k] && srsData[k].reps >= 2) n++;
  return n;
}

function updateBadges() {
  var l = t();
  elCorrect.querySelector('span:last-child').textContent = l.correct + ': ' + session.correct;
  elTotal.querySelector('span:last-child').textContent = l.total + ': ' + session.total;
  elStreak.querySelector('span:last-child').textContent = l.streak + ': ' + session.streak;
  var lvl = xpLevel(xpData.total);
  elXP.querySelector('span:last-child').textContent = '⭐ ' + xpData.total + ' XP · ' + (lvl['title_' + lang] || lvl.title_ro);
  var m = masteredCount();
  elMastered.querySelector('span:last-child').textContent = l.mastered + ': ' + m + '/' + DATA.length;
  elBarFill.style.width = (DATA.length ? Math.round(m / DATA.length * 100) : 0) + '%';

  var weakCount = weakRoots().length;
  elReviewText.textContent = l.review + ': ' + weakCount;
  elReview.disabled = weakCount === 0;
  elReview.classList.toggle('active', reviewMode);
  elReview.title = reviewMode ? l.reviewOnHint : l.reviewOffHint;
}

function toggleReviewMode() {
  if (!reviewMode && weakRoots().length === 0) return;
  reviewMode = !reviewMode;
  queue = [];
  puzzleQueue = [];
  updateBadges();
  if (mode === 'practice') nextQuestion();
  else if (mode === 'puzzle') nextPuzzle();
}

/* ── learn mode — sequential, one hanja at a time ──────────────
   Reading + meaning first, then the real words that use it, each
   with its example sentence — the same order the user asked to
   study in, browsed at their own pace (not SRS-prioritized; that's
   what Practice mode is for). */
function goLearn(delta) {
  learnPos = Math.max(0, Math.min(DATA.length - 1, learnPos + delta));
  Store.set('KBH_LEARN_POS', learnPos);
  renderLearn();
}

function renderLearn() {
  if (!DATA.length) return;
  var item = DATA[learnPos];

  elLearnPos.textContent = (learnPos + 1) + ' / ' + DATA.length;
  elLearnPrev.disabled = learnPos === 0;
  elLearnNext.disabled = learnPos === DATA.length - 1;

  elLearnRoot.innerHTML = rootDisplay(item);
  elLearnMeaning.textContent = item.meaning[lang] || item.meaning.ro;

  var roundSize = buildRoundQueue([learnPos]).length;
  elLessonRoundBtn.textContent = t().lessonRoundBtn.replace('{n}', roundSize);

  var cumulativeSize = buildRoundQueue(rangeTo(learnPos)).length;
  elCumulativeRoundBtn.textContent = t().cumulativeRoundBtn.replace('{n}', cumulativeSize);

  elLearnWords.innerHTML = item.words.map(function(w) {
    var sentence = highlightSyllable(w.sentence, item);
    var breakdown = wordBreakdown(w);

    var head, panel = '';
    if (breakdown) {
      var hanjaSpelling = breakdown.syllables.map(function(s) { return s.hanja; }).join('');
      var wordTr = w[lang] || w.ro;

      head =
        '<div class="lwHead">' +
          '<div class="lwBreak">' +
            '<div class="lwBreakKo">' + breakdown.chars.map(escapeHtml).join(' + ') + ' = ' + escapeHtml(w.ko) + '</div>' +
            '<div class="lwBreakMeaning">' + breakdown.meanings.map(escapeHtml).join(' + ') + ' = ' + escapeHtml(wordTr) + '</div>' +
          '</div>' +
          '<button type="button" class="lwSpeak" data-say="' + escapeHtml(w.ko) + '">▶</button>' +
        '</div>';

      var rows = breakdown.syllables.map(function(s, i) {
        return '<tr>' +
          '<td class="hj">' + escapeHtml(s.hanja) + '</td>' +
          '<td class="syll">' + escapeHtml(breakdown.chars[i]) + '</td>' +
          '<td>' + escapeHtml(breakdown.meanings[i]) + '</td>' +
        '</tr>';
      }).join('');

      panel =
        '<div class="lwBreakPanel">' +
          '<div class="lwBreakPanelTitle">' + escapeHtml(w.ko) + ' (' + escapeHtml(hanjaSpelling) + ') = ' + escapeHtml(wordTr) + '</div>' +
          '<table class="lwBreakTable">' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>';
    } else {
      head =
        '<div class="lwHead">' +
          '<span class="lwKo">' + highlightSyllable(w.ko, item) + '</span>' +
          '<button type="button" class="lwSpeak" data-say="' + escapeHtml(w.ko) + '">▶</button>' +
        '</div>' +
        '<div class="lwTr">' + escapeHtml(w[lang] || w.ro) + '</div>';
    }

    return '' +
      '<div class="learnWord' + (breakdown ? ' hasBreak' : '') + '">' +
        '<div class="lwMain">' +
          head +
          '<div class="lwSentenceRow">' +
            '<div class="lwSentence">' + sentence + '</div>' +
            '<button type="button" class="lwSpeak lwSentenceSpeak" data-say="' + escapeHtml(w.sentence) + '">▶</button>' +
          '</div>' +
          '<div class="lwSentenceTr">' + escapeHtml(w['sentence_' + lang] || w.sentence_ro) + '</div>' +
        '</div>' +
        panel +
      '</div>';
  }).join('');

  elLearnEtym.textContent = item.etymology[lang] || item.etymology.ro;
}

/* Roots attempted at least once but not yet back at full strength —
   the pool reviewMode draws from. */
function weakRoots() {
  var out = [];
  for (var i = 0; i < DATA.length; i++) {
    if (srsData[i] && srsData[i].reps === 0) out.push(i);
  }
  return out;
}

/* ── question queue — SRS-aware ──────────────────────────────
   Prioritizează hanja "due" sau noi; dacă nu mai e nimic due,
   reciclează toată colecția, ca practica să nu se blocheze. */
function buildQueue() {
  if (reviewMode) { queue = shuffle(weakRoots()); return; }
  var now = Date.now();
  var due = [];
  for (var i = 0; i < DATA.length; i++) {
    var s = srsData[i];
    if (!s || !s.due || s.due <= now) due.push(i);
  }
  if (!due.length) for (var j = 0; j < DATA.length; j++) due.push(j);
  queue = shuffle(due);
}

function pickItem() {
  if (!queue.length) buildQueue();
  if (!queue.length && reviewMode) { reviewMode = false; buildQueue(); updateBadges(); } // ran out of mistakes to review — fall back to the normal pool
  return queue.pop(); // DATA index
}

/* Own queue for Puzzle mode — same SRS-due priority as Practice,
   but tracked separately so switching tabs mid-question doesn't
   consume or reshuffle the other mode's queue. */
function buildPuzzleQueue() {
  if (reviewMode) { puzzleQueue = shuffle(weakRoots()); return; }
  var now = Date.now();
  var due = [];
  for (var i = 0; i < DATA.length; i++) {
    var s = srsData[i];
    if (!s || !s.due || s.due <= now) due.push(i);
  }
  if (!due.length) for (var j = 0; j < DATA.length; j++) due.push(j);
  puzzleQueue = shuffle(due);
}

function pickPuzzleItem() {
  if (!puzzleQueue.length) buildPuzzleQueue();
  if (!puzzleQueue.length && reviewMode) { reviewMode = false; buildPuzzleQueue(); updateBadges(); }
  return puzzleQueue.pop();
}

/* ── question builders ───────────────────────────────────────
   Fiecare opțiune e {key, label, tag?}. `key` identifică unic
   opțiunea (index/hanja pentru rădăcini, text pentru sensuri/cuvinte)
   — esențial la 'meaning-root', unde omofone diferite (ex. 수/水 vs
   수/手) ar arăta identic ca text și s-ar dedupe greșit dacă am
   compara după label. */
function distractMeanings(di, n) {
  var correct = DATA[di].meaning[lang] || DATA[di].meaning.ro;
  var indices = shuffle(DATA.map(function(_, i) { return i; }).filter(function(i) { return i !== di; }));
  var seen = {}; seen[correct] = true;
  var out = [];
  for (var i = 0; i < indices.length && out.length < n; i++) {
    var m = DATA[indices[i]].meaning[lang] || DATA[indices[i]].meaning.ro;
    if (m && !seen[m]) { seen[m] = true; out.push({ key: m, label: m }); }
  }
  return out;
}

function distractRoots(di, n) {
  var indices = shuffle(DATA.map(function(_, i) { return i; }).filter(function(i) { return i !== di; }));
  var out = [];
  for (var i = 0; i < indices.length && out.length < n; i++) {
    var idx = indices[i];
    out.push({ key: idx, label: primaryReading(DATA[idx]), tag: DATA[idx].hanja });
  }
  return out;
}

function distractWords(correctKey, n) {
  var flat = [];
  DATA.forEach(function(e, idx) {
    e.words.forEach(function(w) {
      var key = idx + '_' + w.ko;
      if (key !== correctKey) flat.push({ key: key, label: w.ko });
    });
  });
  var pool = shuffle(flat);
  var seen = {}; var out = [];
  for (var i = 0; i < pool.length && out.length < n; i++) {
    if (!seen[pool[i].label]) { seen[pool[i].label] = true; out.push(pool[i]); }
  }
  return out;
}

function buildQuestion() {
  if (lessonRoundActive) {
    var entry = lessonRoundQueue[lessonRoundIndex];
    return buildQuestionFor(entry.di, entry.type, entry.word);
  }
  var di = pickItem();
  var item = DATA[di];
  var breakdownWords = item.words.filter(function(w) { return !!wordBreakdown(w); });
  var types = breakdownWords.length ? TYPES : TYPES.filter(function(ty) { return ty !== 'breakdown-word'; });
  var type = types[Math.floor(Math.random() * types.length)];
  return buildQuestionFor(di, type, null);
}

/* Builds one question for a known (di, type) — shared by normal
   practice (random di/type, no forced word) and lesson/cumulative
   rounds (di, type and word spelled out by buildRoundQueue). */
function buildQuestionFor(di, type, forcedWord) {
  var item = DATA[di];
  var breakdownWords = item.words.filter(function(w) { return !!wordBreakdown(w); });

  var correctKey, correctLabel, options, wordUsed = null, breakdownMeanings = null;

  if (type === 'root-meaning') {
    correctLabel = item.meaning[lang] || item.meaning.ro;
    correctKey = correctLabel;
    options = distractMeanings(di, 3).concat([{ key: correctKey, label: correctLabel }]);
  } else if (type === 'meaning-root') {
    correctLabel = primaryReading(item);
    correctKey = di;
    options = distractRoots(di, 3).concat([{ key: di, label: correctLabel, tag: item.hanja }]);
  } else if (type === 'word-meaning') {
    wordUsed = forcedWord || item.words[Math.floor(Math.random() * item.words.length)];
    correctLabel = item.meaning[lang] || item.meaning.ro;
    correctKey = correctLabel;
    options = distractMeanings(di, 3).concat([{ key: correctKey, label: correctLabel }]);
  } else if (type === 'breakdown-word') {
    wordUsed = forcedWord || breakdownWords[Math.floor(Math.random() * breakdownWords.length)];
    breakdownMeanings = wordBreakdown(wordUsed).meanings.join(' + ');
    correctKey = di + '_' + wordUsed.ko;
    correctLabel = wordUsed.ko;
    options = distractWords(correctKey, 3).concat([{ key: correctKey, label: correctLabel }]);
  } else { // meaning-word
    wordUsed = forcedWord || item.words[Math.floor(Math.random() * item.words.length)];
    correctKey = di + '_' + wordUsed.ko;
    correctLabel = wordUsed.ko;
    options = distractWords(correctKey, 3).concat([{ key: correctKey, label: correctLabel }]);
  }

  return {
    type: type,
    item: item,
    di: di,
    wordUsed: wordUsed,
    breakdownMeanings: breakdownMeanings,
    correctKey: correctKey,
    correctLabel: correctLabel,
    options: shuffle(options)
  };
}

/* All (di, word, type) combinations available across a set of roots,
   shuffled and capped at LESSON_ROUND_SIZE. For a typical 6-8 word
   root this is comfortably above 20 per root alone (2 root-level + 2
   per word + 1 breakdown-word per word with a verified breakdown);
   a sparse 4-word root falls a little short rather than repeating —
   "about 20", not padded. Used both for a single-root lesson round
   and for the cumulative round across every root studied so far. */
function buildRoundQueue(diList) {
  var combos = [];
  diList.forEach(function(di) {
    var item = DATA[di];
    var breakdownWords = item.words.filter(function(w) { return !!wordBreakdown(w); });
    combos.push({ di: di, type: 'root-meaning' });
    combos.push({ di: di, type: 'meaning-root' });
    item.words.forEach(function(w) {
      combos.push({ di: di, type: 'word-meaning', word: w });
      combos.push({ di: di, type: 'meaning-word', word: w });
    });
    breakdownWords.forEach(function(w) {
      combos.push({ di: di, type: 'breakdown-word', word: w });
    });
  });
  return shuffle(combos).slice(0, LESSON_ROUND_SIZE);
}

function rangeTo(maxDi) {
  var out = [];
  for (var i = 0; i <= maxDi; i++) out.push(i);
  return out;
}

function startLessonRound(di) {
  lessonRoundActive = true;
  lessonRoundMode = 'single';
  lessonRoundDi = di;
  lessonRoundQueue = buildRoundQueue([di]);
  lessonRoundIndex = 0;
  lessonRoundScore = { correct: 0, total: 0 };
  hideRoundSummary();
  setMode('practice');
  nextQuestion();
}

/* "Recapitulare generală" — a round drawn from every root studied so
   far (index 0 through the current Learn position), not just the
   most recent one, so review doesn't stop at yesterday's lesson. */
function startCumulativeRound(maxDi) {
  lessonRoundActive = true;
  lessonRoundMode = 'cumulative';
  lessonRoundMaxDi = maxDi;
  lessonRoundQueue = buildRoundQueue(rangeTo(maxDi));
  lessonRoundIndex = 0;
  lessonRoundScore = { correct: 0, total: 0 };
  hideRoundSummary();
  setMode('practice');
  nextQuestion();
}

function restartRound() {
  if (lessonRoundMode === 'cumulative') startCumulativeRound(lessonRoundMaxDi);
  else startLessonRound(lessonRoundDi);
}

function exitLessonRound() {
  lessonRoundActive = false;
  hideRoundSummary();
  nextQuestion();
}

function renderLessonRoundProgress() {
  var l = t();
  elCumulativeRoundBtn.classList.toggle('hidden', lessonRoundActive);
  if (!lessonRoundActive) {
    elLessonRoundBar.classList.add('hidden');
    return;
  }
  elLessonRoundBar.classList.remove('hidden');
  var label = lessonRoundMode === 'cumulative' ? l.cumulativeRoundProgress : l.lessonRoundProgress;
  elLessonRoundProgress.textContent = label
    .replace('{i}', Math.min(lessonRoundIndex + 1, lessonRoundQueue.length))
    .replace('{n}', lessonRoundQueue.length);
  elLessonRoundExit.textContent = l.lessonRoundExit;
}

function showRoundSummary() {
  var l = t();
  var pct = lessonRoundScore.total ? Math.round((lessonRoundScore.correct / lessonRoundScore.total) * 100) : 0;
  var msgs = pct === 100
    ? { emoji: '🏆' } : pct >= 80
    ? { emoji: '🎉' } : pct >= 60
    ? { emoji: '💪' } : { emoji: '📚' };
  elRoundSummaryEmoji.textContent = msgs.emoji;
  elRoundSummaryMsg.textContent = l.roundDoneMsg;
  elRoundSummaryScore.textContent = lessonRoundScore.correct + ' / ' + lessonRoundScore.total;
  elRoundSummaryAgain.textContent = l.roundAgain;
  elRoundSummaryExit.textContent = l.roundExit;
  elRoundSummary.classList.remove('hidden');
}

function hideRoundSummary() {
  elRoundSummary.classList.add('hidden');
}

function nextQuestion() {
  if (lessonRoundActive && lessonRoundIndex >= lessonRoundQueue.length) {
    showRoundSummary();
    return;
  }
  locked = false;
  current = buildQuestion();
  elFeedback.textContent = '';
  elFeedback.className = 'feedback';
  elNextBtn.classList.remove('show');
  renderQuestion();
  renderLessonRoundProgress();
}

function renderQuestion() {
  var l = t();
  var c = current;
  elTypeLbl.textContent = l.prompts[c.type];

  elPromptHint.classList.add('hidden');
  elSpeakBtn.classList.add('hidden');
  elPrompt.classList.remove('root');

  if (c.type === 'root-meaning') {
    elPrompt.innerHTML = rootDisplay(c.item);
    elPrompt.classList.add('root');
    elPromptSub.textContent = '';
    elSpeakBtn.classList.remove('hidden');
  } else if (c.type === 'meaning-root') {
    elPrompt.textContent = c.item.meaning[lang] || c.item.meaning.ro;
    elPromptSub.textContent = '';
  } else if (c.type === 'word-meaning') {
    elPrompt.innerHTML = highlightSyllable(c.wordUsed.ko, c.item);
    elPromptSub.textContent = c.wordUsed[lang] || c.wordUsed.ro;
    elPromptHint.textContent = l.hlHint;
    elPromptHint.classList.remove('hidden');
    elSpeakBtn.classList.remove('hidden');
  } else if (c.type === 'breakdown-word') {
    elPrompt.textContent = c.breakdownMeanings;
    elPromptSub.textContent = '';
  } else { // meaning-word
    elPrompt.textContent = c.wordUsed[lang] || c.wordUsed.ro;
    elPromptSub.textContent = '';
  }

  elAnswers.innerHTML = '';
  c.options.forEach(function(opt) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'answerBtn' + (opt.tag ? ' rootOpt' : '');
    if (opt.tag) {
      btn.innerHTML = '<span class="optMain">' + escapeHtml(opt.label) + '</span>' +
                       '<span class="optTag">' + escapeHtml(opt.tag) + '</span>';
    } else {
      btn.textContent = opt.label;
    }
    btn.dataset.key = opt.key;
    btn.addEventListener('click', function() { submitAnswer(opt.key, btn); });
    elAnswers.appendChild(btn);
  });
}

function submitAnswer(key, btn) {
  if (locked) return;
  locked = true;
  var c = current;
  var isCorrect = String(key) === String(c.correctKey);

  Array.prototype.forEach.call(elAnswers.children, function(b) {
    b.disabled = true;
    if (String(b.dataset.key) === String(c.correctKey)) b.classList.add('correct');
    else if (b === btn) b.classList.add('wrong');
  });

  srsData[c.di] = srsStep(srsData[c.di], isCorrect);
  Store.set('KBH_SRS', srsData);

  updateSession(isCorrect);
  updateBadges();

  if (lessonRoundActive) {
    lessonRoundScore.total++;
    if (isCorrect) lessonRoundScore.correct++;
    lessonRoundIndex++;
  }

  var l = t();
  elFeedback.textContent = isCorrect ? '✓ ' + l.correctMsg : '✕ ' + l.wrongMsg + ' — ' + c.correctLabel;
  elFeedback.className = 'feedback show ' + (isCorrect ? 'ok' : 'bad');
  elNextBtn.classList.add('show');

  if (isCorrect) {
    var say = (c.type === 'word-meaning' || c.type === 'meaning-word' || c.type === 'breakdown-word') ? c.wordUsed.ko : primaryReading(c.item);
    speak(say);
  }

  setTimeout(function() { if (locked) nextQuestion(); }, 1600);
}

/* ── puzzle mode — word builder ────────────────────────────────
   Pick a real example word for a (SRS-prioritized) hanja root,
   break it into its Hangul syllable tiles, mix in a few decoy
   syllables pulled from other real words, shuffle, and have the
   learner tap the CORRECT tiles back in the correct order — the
   decoys stay unused in the bank. This is what makes a 2-syllable
   word non-trivial too: with only its own 2 tiles, order is a
   coin flip; mixed into ~6 tiles you first have to recognize which
   ones belong. The root is still shown only as a small hint chip
   (syllable + hanja tag) — never a recognition target, just
   disambiguation. Decoys are real syllables from real words, so
   nothing fabricated ever appears, even among the wrong choices. */
function randomDecoySyllables(excludeWord, n) {
  var pool = [];
  DATA.forEach(function(e) {
    e.words.forEach(function(w) {
      if (w.ko !== excludeWord) {
        w.ko.split('').forEach(function(ch) { pool.push(ch); });
      }
    });
  });
  return shuffle(pool).slice(0, n);
}

function buildPuzzleQuestion() {
  var di = pickPuzzleItem();
  var item = DATA[di];
  var word = item.words[Math.floor(Math.random() * item.words.length)];
  var answerChars = word.ko.split('');
  var decoyTable = PUZZLE_DECOYS[puzzleDifficulty];
  var decoyCount = answerChars.length <= 2 ? decoyTable[2] : (answerChars.length === 3 ? decoyTable[3] : decoyTable.more);
  var pool = answerChars.concat(randomDecoySyllables(word.ko, decoyCount));
  var tiles = pool.map(function(ch, i) { return { id: i, ch: ch }; });
  return { di: di, item: item, word: word, answerLen: answerChars.length, tiles: shuffle(tiles), placed: [] };
}

function nextPuzzle() {
  puzzleLocked = false;
  puzzleCurrent = buildPuzzleQuestion();
  elPuzzleFeedback.textContent = '';
  elPuzzleFeedback.className = 'feedback';
  elPuzzleNextBtn.classList.remove('show');
  elPuzzleSpeak.classList.add('hidden');
  renderPuzzle();
}

function setPuzzleDifficulty(d) {
  if (!PUZZLE_DECOYS[d] || d === puzzleDifficulty) return;
  puzzleDifficulty = d;
  Store.set('KBH_PUZZLE_DIFF', d);
  syncPuzzleDiffButtons();
  if (puzzleCurrent) nextPuzzle();
}

function syncPuzzleDiffButtons() {
  elPuzzleDiffBtns.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.diff === puzzleDifficulty);
  });
}

function renderPuzzle() {
  var c = puzzleCurrent;
  var item = c.item;

  elPuzzleHintChip.innerHTML =
    '<span class="hcRoot">' + escapeHtml(primaryReading(item)) + '</span>' +
    '<span class="hcTag">' + escapeHtml(item.hanja) + '</span>';
  elPuzzlePrompt.textContent = c.word[lang] || c.word.ro;

  var slots = [];
  for (var i = 0; i < c.answerLen; i++) {
    if (i >= c.placed.length) { slots.push('<div class="slot"></div>'); continue; }
    var id = c.placed[i];
    var t = c.tiles.filter(function(x) { return x.id === id; })[0];
    slots.push('<div class="slot filled" data-id="' + t.id + '">' + escapeHtml(t.ch) + '</div>');
  }
  elAnswerSlots.innerHTML = slots.join('');

  elTileBank.innerHTML = c.tiles.map(function(tile) {
    var used = c.placed.indexOf(tile.id) >= 0;
    return '<button type="button" class="tile' + (used ? ' used' : '') + '" data-id="' + tile.id + '">' +
      escapeHtml(tile.ch) + '</button>';
  }).join('');
}

function placeTile(id) {
  if (puzzleLocked) return;
  var c = puzzleCurrent;
  if (c.placed.indexOf(id) >= 0 || c.placed.length >= c.answerLen) return;
  c.placed.push(id);
  renderPuzzle();
  if (c.placed.length === c.answerLen) checkPuzzle();
}

function removeTile(id) {
  var c = puzzleCurrent;
  var i = c.placed.indexOf(id);
  if (i >= 0) { c.placed.splice(i, 1); renderPuzzle(); }
}

function checkPuzzle() {
  puzzleLocked = true;
  var c = puzzleCurrent;
  var attempt = c.placed.map(function(id) {
    return c.tiles.filter(function(t) { return t.id === id; })[0].ch;
  }).join('');
  var isCorrect = attempt === c.word.ko;

  Array.prototype.forEach.call(elAnswerSlots.children, function(slotEl) {
    slotEl.classList.add(isCorrect ? 'correct' : 'wrong');
  });
  Array.prototype.forEach.call(elTileBank.children, function(tileEl) {
    tileEl.disabled = true;
  });

  srsData[c.di] = srsStep(srsData[c.di], isCorrect);
  Store.set('KBH_SRS', srsData);

  updateSession(isCorrect);
  updateBadges();

  var l = t();
  elPuzzleFeedback.textContent = isCorrect ? '✓ ' + l.correctMsg : '✕ ' + l.wrongMsg + ' — ' + c.word.ko;
  elPuzzleFeedback.className = 'feedback show ' + (isCorrect ? 'ok' : 'bad');
  elPuzzleNextBtn.classList.add('show');
  elPuzzleSpeak.classList.remove('hidden');

  speak(c.word.ko);

  setTimeout(function() { if (puzzleLocked) nextPuzzle(); }, 2200);
}

function updateSession(isCorrect) {
  session.total++;
  if (isCorrect) {
    session.correct++;
    session.streak++;
    var gain = xpGain(session.streak);
    xpData.total += gain;
    Store.set('KBH_XP', xpData);
  } else {
    session.streak = 0;
  }

  var s = Store.get('KBH_STATS', null);
  var today = new Date().toISOString().slice(0, 10);
  if (!s) s = { total: 0, correct: 0, bestStreak: 0, today: today, todayTotal: 0, todayCorrect: 0 };
  if (s.today !== today) { s.today = today; s.todayTotal = 0; s.todayCorrect = 0; }
  s.total++; s.todayTotal++;
  if (isCorrect) { s.correct++; s.todayCorrect++; }
  if (session.streak > s.bestStreak) s.bestStreak = session.streak;
  Store.set('KBH_STATS', s);
}
