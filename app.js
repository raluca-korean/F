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

var puzzleQueue = [];      // array of DATA indices, prioritized by SRS due date (own queue, independent of Practice's)
var puzzleCurrent = null;  // { di, item, word, tiles: [{id,ch}], placed: [id,...] }
var puzzleLocked = false;

var TYPES = ['root-meaning', 'meaning-root', 'word-meaning', 'meaning-word'];

var UI = {
  ro: {
    title: 'Korean by Hanja',
    sub: 'Învață coreeana prin 214 rădăcini sino-coreene',
    correct: 'Corecte', total: 'Total', streak: 'Streak', mastered: 'Stăpânite',
    prompts: {
      'root-meaning': 'Ce înseamnă această silabă coreeană?',
      'meaning-root': 'Care silabă coreeană are acest sens?',
      'word-meaning': 'Ce înseamnă silaba evidențiată din acest cuvânt?',
      'meaning-word': 'Care e cuvântul coreean corect?'
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
    footer: 'Aplicație independentă · fără cont, fără server · progresul se salvează local, în acest browser'
  },
  en: {
    title: 'Korean by Hanja',
    sub: 'Learn Korean through 214 Sino-Korean roots',
    correct: 'Correct', total: 'Total', streak: 'Streak', mastered: 'Mastered',
    prompts: {
      'root-meaning': 'What does this Korean syllable mean?',
      'meaning-root': 'Which Korean syllable has this meaning?',
      'word-meaning': 'What does the highlighted syllable mean in this word?',
      'meaning-word': 'Which is the correct Korean word?'
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
    footer: 'Standalone app · no account, no server · progress is saved locally in this browser'
  }
};
function t() { return UI[lang]; }

/* ── DOM refs ─────────────────────────────────────────────── */
var elCorrect  = document.getElementById('bCorrect');
var elTotal    = document.getElementById('bTotal');
var elStreak   = document.getElementById('bStreak');
var elXP       = document.getElementById('bXP');
var elMastered = document.getElementById('bMastered');
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
            '<thead><tr><th>Hanja</th><th>' + (lang === 'en' ? 'Korean' : 'Coreeană') + '</th><th>' + (lang === 'en' ? 'Meaning' : 'Sens') + '</th></tr></thead>' +
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
          '<div class="lwSentence">' + sentence + '</div>' +
          '<div class="lwSentenceTr">' + escapeHtml(w['sentence_' + lang] || w.sentence_ro) + '</div>' +
        '</div>' +
        panel +
      '</div>';
  }).join('');

  elLearnEtym.textContent = item.etymology[lang] || item.etymology.ro;
}

/* ── question queue — SRS-aware ──────────────────────────────
   Prioritizează hanja "due" sau noi; dacă nu mai e nimic due,
   reciclează toată colecția, ca practica să nu se blocheze. */
function buildQueue() {
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
  return queue.pop(); // DATA index
}

/* Own queue for Puzzle mode — same SRS-due priority as Practice,
   but tracked separately so switching tabs mid-question doesn't
   consume or reshuffle the other mode's queue. */
function buildPuzzleQueue() {
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
  var di = pickItem();
  var item = DATA[di];
  var type = TYPES[Math.floor(Math.random() * TYPES.length)];

  var correctKey, correctLabel, options, wordUsed = null;

  if (type === 'root-meaning') {
    correctLabel = item.meaning[lang] || item.meaning.ro;
    correctKey = correctLabel;
    options = distractMeanings(di, 3).concat([{ key: correctKey, label: correctLabel }]);
  } else if (type === 'meaning-root') {
    correctLabel = primaryReading(item);
    correctKey = di;
    options = distractRoots(di, 3).concat([{ key: di, label: correctLabel, tag: item.hanja }]);
  } else if (type === 'word-meaning') {
    wordUsed = item.words[Math.floor(Math.random() * item.words.length)];
    correctLabel = item.meaning[lang] || item.meaning.ro;
    correctKey = correctLabel;
    options = distractMeanings(di, 3).concat([{ key: correctKey, label: correctLabel }]);
  } else { // meaning-word
    wordUsed = item.words[Math.floor(Math.random() * item.words.length)];
    correctKey = di + '_' + wordUsed.ko;
    correctLabel = wordUsed.ko;
    options = distractWords(correctKey, 3).concat([{ key: correctKey, label: correctLabel }]);
  }

  return {
    type: type,
    item: item,
    di: di,
    wordUsed: wordUsed,
    correctKey: correctKey,
    correctLabel: correctLabel,
    options: shuffle(options)
  };
}

function nextQuestion() {
  locked = false;
  current = buildQuestion();
  elFeedback.textContent = '';
  elFeedback.className = 'feedback';
  elNextBtn.classList.remove('show');
  renderQuestion();
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

  var l = t();
  elFeedback.textContent = isCorrect ? '✓ ' + l.correctMsg : '✕ ' + l.wrongMsg + ' — ' + c.correctLabel;
  elFeedback.className = 'feedback show ' + (isCorrect ? 'ok' : 'bad');
  elNextBtn.classList.add('show');

  if (isCorrect) {
    var say = (c.type === 'word-meaning' || c.type === 'meaning-word') ? c.wordUsed.ko : primaryReading(c.item);
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
  var decoyCount = answerChars.length <= 2 ? 4 : (answerChars.length === 3 ? 3 : 2);
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
