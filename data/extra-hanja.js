'use strict';

/* Hanja suplimentare, DOAR pentru afișarea detaliată "silabă cu silabă"
   a descompunerii cuvintelor (vezi data/verified-breakdowns.js) — NU fac
   parte din cele 214 rădăcini pe care le înveți în tab-ul Învață/Exersează/
   Puzzle. Multe cuvinte reale au silabe al căror hanja adevărat nu e
   printre cele 214 (ex. 학교=學校, dar 校 nu era în set — de-asta era
   exclus înainte). Aici adăugăm, TREPTAT și verificat unul câte unul,
   exact hanja-ul necesar pentru cuvintele pe care le confirmăm corecte,
   ca să putem arăta descompunerea completă și pentru ele. Fiecare intrare
   e verificată contra etimologiei reale, la fel de atent ca cele 214.

   Format: hanja -> { reading: citirea coreeană folosită în cuvintele
   noastre, meaning: { ro, en } }. */
var EXTRA_HANJA = {
  '校': { reading: '교', meaning: { ro: 'școală', en: 'school' } },
  '都': { reading: '도', meaning: { ro: 'capitală, centru urban', en: 'capital, metropolis' } },
  '度': { reading: '도', meaning: { ro: 'grad, măsură', en: 'degree, measure' } },
  '院': { reading: '원', meaning: { ro: 'instituție, curte', en: 'institution, courtyard' } },
  '園': { reading: '원', meaning: { ro: 'grădină, parc', en: 'garden, park' } },
  '聞': { reading: '문', meaning: { ro: 'a auzi; știre', en: 'to hear; news' } },
  '議': { reading: '의', meaning: { ro: 'a discuta', en: 'to discuss' } },
  '發': { reading: '발', meaning: { ro: 'a porni, a emite, a dezvolta', en: 'to emit, depart, develop' } },
  '眞': { reading: '진', meaning: { ro: 'adevărat', en: 'true, real' } },
  '衛': { reading: '위', meaning: { ro: 'a păzi, a apăra', en: 'to guard, defend' } },
  '銀': { reading: '은', meaning: { ro: 'argint', en: 'silver' } },
  '旅': { reading: '여', meaning: { ro: 'călătorie', en: 'journey, travel' } },
  '流': { reading: '유', meaning: { ro: 'a curge; curent', en: 'to flow; current, trend' } },
  '留': { reading: '유', meaning: { ro: 'a rămâne, a sta', en: 'to stay, remain' } },
  '由': { reading: '유', meaning: { ro: 'motiv; din, prin', en: 'reason; from, via' } },
  '然': { reading: '연', meaning: { ro: 'așa; natură', en: 'so, thus; nature' } },
  '身': { reading: '신', meaning: { ro: 'corp, trup', en: 'body' } },
  '神': { reading: '신', meaning: { ro: 'zeu, spirit', en: 'god, spirit' } },
  '進': { reading: '진', meaning: { ro: 'a avansa, a înainta', en: 'to advance, progress' } },
  '口': { reading: '구', meaning: { ro: 'gură, deschidere', en: 'mouth, opening' } },
  '具': { reading: '구', meaning: { ro: 'unealtă, instrument', en: 'tool, utensil' } },
  '舊': { reading: '구', meaning: { ro: 'vechi, fost', en: 'old, former' } },
  '功': { reading: '공', meaning: { ro: 'merit, realizare', en: 'merit, achievement' } },
  '共': { reading: '공', meaning: { ro: 'comun, împreună', en: 'common, shared, together' } },
  '告': { reading: '고', meaning: { ro: 'a anunța, a spune', en: 'to announce, tell' } },
  '古': { reading: '고', meaning: { ro: 'antic, vechi', en: 'ancient, old' } },

  '分': { reading: '분', meaning: { ro: 'a împărți; parte', en: 'to divide; part, portion' } },
  '部': { reading: '부', meaning: { ro: 'parte, departament', en: 'part, department' } },
  '性': { reading: '성', meaning: { ro: 'natură, fire; gen', en: 'nature; gender, -ness' } },
  '路': { reading: '로 노', meaning: { ro: 'drum, cale', en: 'road, way' } },
  '者': { reading: '자', meaning: { ro: 'cel/cea care...; persoană', en: 'one who...; person' } },
  '每': { reading: '매', meaning: { ro: 'fiecare', en: 'every, each' } },
  '對': { reading: '대', meaning: { ro: 'față în față, opus', en: 'facing, opposite' } },
  '期': { reading: '기', meaning: { ro: 'perioadă, termen', en: 'period, term' } },
  '今': { reading: '금', meaning: { ro: 'acum, prezent', en: 'now, present' } },
  '極': { reading: '극', meaning: { ro: 'extrem, pol', en: 'extreme, pole' } },
  '向': { reading: '향', meaning: { ro: 'spre, direcție', en: 'toward, direction' } },
  '紙': { reading: '지', meaning: { ro: 'hârtie', en: 'paper' } },
  '己': { reading: '기', meaning: { ro: 'sine, eu însumi', en: 'oneself, self' } },
  '目': { reading: '목', meaning: { ro: 'ochi; obiect, punct', en: 'eye; item, point' } },
  '謝': { reading: '사', meaning: { ro: 'a mulțumi', en: 'to thank' } },
  '變': { reading: '변', meaning: { ro: 'a se schimba', en: 'to change' } },
  '復': { reading: '부', meaning: { ro: 'a restabili, din nou', en: 'to restore, again' } },
  '貿': { reading: '무', meaning: { ro: 'comerț', en: 'trade, commerce' } },
  '訪': { reading: '방', meaning: { ro: 'a vizita', en: 'to visit' } },
  '島': { reading: '도', meaning: { ro: 'insulă', en: 'island' } },
  '敎': { reading: '교', meaning: { ro: 'a preda, a învăța pe cineva', en: 'to teach' } },
  '聲': { reading: '성', meaning: { ro: 'voce, sunet', en: 'voice, sound' } },
  '信': { reading: '신', meaning: { ro: 'încredere', en: 'trust, faith' } }
};
