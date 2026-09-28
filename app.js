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
    if (current && current.item) speak(primaryReading(current.item) || current.item.hanja);
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
