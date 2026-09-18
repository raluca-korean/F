'use strict';

/* ═══════════════════════════════════════════════════════════
   KOREAN BY HANJA — standalone quiz app
   Practică pură pe cele 214 hanja de bază: citire, sens, cuvinte.
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
var lang = Store.get('KBH_LANG', 'ro');
var srsData = Store.get('KBH_SRS', {});
var xpData = Store.get('KBH_XP', { total: 0 });

var queue = [];       // array of DATA indices, prioritized by SRS due date
var current = null;   // { item, di, type, correctVal, options, wordUsed }
var locked = false;

var session = { correct: 0, total: 0, streak: 0 };

var TYPES = ['hanja-meaning', 'hanja-reading', 'word-hanja', 'meaning-hanja'];

var UI = {
  ro: {
    title: 'Korean by Hanja',
    sub: 'Învață coreeana prin cele 214 hanja de bază',
    correct: 'Corecte', total: 'Total', streak: 'Streak', mastered: 'Stăpânite',
    prompts: {
      'hanja-meaning': 'Ce înseamnă acest hanja?',
      'hanja-reading': 'Care este citirea acestui hanja?',
      'word-hanja':    'Ce hanja apare în acest cuvânt?',
      'meaning-hanja': 'Care hanja are acest sens?'
    },
    correctMsg: 'Corect!', wrongMsg: 'Greșit',
    next: 'Următorul →',
    footer: 'Aplicație independentă · fără cont, fără server · progresul se salvează local, în acest browser'
  },
  en: {
    title: 'Korean by Hanja',
    sub: 'Learn Korean through the 214 core hanja',
    correct: 'Correct', total: 'Total', streak: 'Streak', mastered: 'Mastered',
    prompts: {
      'hanja-meaning': 'What does this hanja mean?',
      'hanja-reading': 'What is the reading of this hanja?',
      'word-hanja':    'Which hanja appears in this word?',
      'meaning-hanja': 'Which hanja has this meaning?'
    },
    correctMsg: 'Correct!', wrongMsg: 'Wrong',
    next: 'Next →',
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
var elSpeakBtn = document.getElementById('speakBtn');
var elAnswers  = document.getElementById('answers');
var elFeedback = document.getElementById('feedback');
var elNextBtn  = document.getElementById('nextBtn');
var elTitle    = document.getElementById('pgTitle');
var elSub      = document.getElementById('pgSub');
var elLangBtn  = document.getElementById('langBtn');
var elDarkBtn  = document.getElementById('darkBtn');
var elFooter   = document.getElementById('footerNote');

/* ── boot ─────────────────────────────────────────────────── */
fetch('./data/hanja.json')
  .then(function(r) { return r.json(); })
  .then(function(data) { DATA = data; boot(); })
  .catch(function() { if (elPrompt) elPrompt.textContent = '⚠️'; });

function boot() {
  applyTheme();
  renderStatic();
  updateBadges();
  buildQueue();
  nextQuestion();

  elLangBtn.addEventListener('click', function() {
    lang = lang === 'ro' ? 'en' : 'ro';
    Store.set('KBH_LANG', lang);
    renderStatic();
    updateBadges();
    if (current) renderQuestion();
  });
  elDarkBtn.addEventListener('click', function() {
    var isDark = !document.body.classList.contains('dark-mode');
    document.body.classList.toggle('dark-mode', isDark);
    Store.set('KBH_THEME', isDark ? 'dark' : 'light');
    elDarkBtn.textContent = isDark ? '◑' : '◐';
  });
  elSpeakBtn.addEventListener('click', function() {
    if (current && current.item) speak(current.item.ko_reading || current.item.hanja);
  });
  elNextBtn.addEventListener('click', function() {
    if (locked) nextQuestion();
  });
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

/* ── question builders ───────────────────────────────────── */
function distractorValues(di, valueFn, n) {
  var indices = shuffle(DATA.map(function(_, i) { return i; }).filter(function(i) { return i !== di; }));
  var correctVal = valueFn(DATA[di]);
  var seen = {}; seen[correctVal] = true;
  var out = [];
  for (var i = 0; i < indices.length && out.length < n; i++) {
    var v = valueFn(DATA[indices[i]]);
    if (v && !seen[v]) { seen[v] = true; out.push(v); }
  }
  return out;
}

function buildQuestion() {
  var di = pickItem();
  var item = DATA[di];
  var possibleTypes = TYPES.filter(function(ty) {
    return ty !== 'word-hanja' || (item.words && item.words.length);
  });
  var type = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];

  var correctVal, options, wordUsed = null;

  if (type === 'hanja-meaning') {
    var meaningOf = function(h) { return h.meaning[lang] || h.meaning.ro; };
    correctVal = meaningOf(item);
    options = distractorValues(di, meaningOf, 3).concat([correctVal]);
  } else if (type === 'hanja-reading') {
    var readingOf = function(h) { return h.ko_reading; };
    correctVal = readingOf(item);
    options = distractorValues(di, readingOf, 3).concat([correctVal]);
  } else if (type === 'word-hanja') {
    wordUsed = item.words[Math.floor(Math.random() * item.words.length)];
    correctVal = item.hanja;
    options = distractorValues(di, function(h) { return h.hanja; }, 3).concat([correctVal]);
  } else { // meaning-hanja
    correctVal = item.hanja;
    options = distractorValues(di, function(h) { return h.hanja; }, 3).concat([correctVal]);
  }

  return {
    type: type,
    item: item,
    di: di,
    wordUsed: wordUsed,
    correctVal: correctVal,
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

  var isGlyphOption = (c.type === 'word-hanja' || c.type === 'meaning-hanja');

  if (c.type === 'hanja-meaning' || c.type === 'hanja-reading') {
    elPrompt.textContent = c.item.hanja;
    elPrompt.classList.add('glyph');
    elPromptSub.textContent = '';
    elSpeakBtn.classList.toggle('hidden', c.type !== 'hanja-reading');
  } else if (c.type === 'word-hanja') {
    elPrompt.textContent = c.wordUsed.ko;
    elPrompt.classList.remove('glyph');
    elPromptSub.textContent = c.wordUsed[lang] || c.wordUsed.ro;
    elSpeakBtn.classList.remove('hidden');
  } else { // meaning-hanja
    elPrompt.textContent = c.item.meaning[lang] || c.item.meaning.ro;
    elPrompt.classList.remove('glyph');
    elPromptSub.textContent = '';
    elSpeakBtn.classList.add('hidden');
  }

  elAnswers.innerHTML = '';
  c.options.forEach(function(opt) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'answerBtn' + (isGlyphOption ? ' glyphOpt' : '');
    btn.textContent = opt;
    btn.addEventListener('click', function() { submitAnswer(opt, btn); });
    elAnswers.appendChild(btn);
  });
}

function submitAnswer(chosen, btn) {
  if (locked) return;
  locked = true;
  var c = current;
  var isCorrect = chosen === c.correctVal;

  Array.prototype.forEach.call(elAnswers.children, function(b) {
    b.disabled = true;
    if (b.textContent === c.correctVal) b.classList.add('correct');
    else if (b === btn) b.classList.add('wrong');
  });

  srsData[c.di] = srsStep(srsData[c.di], isCorrect);
  Store.set('KBH_SRS', srsData);

  updateSession(isCorrect);
  updateBadges();

  var l = t();
  elFeedback.textContent = isCorrect ? '✓ ' + l.correctMsg : '✕ ' + l.wrongMsg + ' — ' + c.correctVal;
  elFeedback.className = 'feedback show ' + (isCorrect ? 'ok' : 'bad');
  elNextBtn.classList.add('show');

  if (isCorrect) {
    var say = c.type === 'word-hanja' ? c.wordUsed.ko : c.item.ko_reading;
    speak(say);
  }

  setTimeout(function() { if (locked) nextQuestion(); }, 1600);
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
