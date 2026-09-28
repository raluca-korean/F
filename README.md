# Korean by Hanja

Aplicație web independentă de învățat coreeana prin 214 rădăcini sino-coreene (hanja) — citirea lor în Hangul, sensul lor, și cuvintele coreene reale formate combinându-le cu alte silabe.

**Nu e o aplicație de învățat caracterele chinezești ca scriere.** Caracterul hanja (ex. 水) nu e niciodată subiectul unei întrebări — apare doar ca etichetă mică, gri, lângă silaba coreeană, doar ca să distingă rădăcini omofone (ex. 수 = apă/水, mână/手, cine/誰, trebuie/須 — fără etichetă, cele 4 ar arăta identic). Tot ce se testează e coreeana: citirea, sensul, cuvântul.

Fără build tools, fără server, fără cont — vanilla HTML/CSS/JS. Progresul (scor, XP, repetiție spațiată) se salvează local, în browser-ul fiecărui utilizator.

## Structură

- `index.html` / `style.css` / `app.js` — aplicația (o singură pagină)
- `data/hanja.json` — cele 214 hanja, cu citire, sens (ro/en), etimologie și cuvinte de exemplu

## Cum funcționează

Trei moduri, ca niște tab-uri:

**Învață** — parcurgi cele 214 rădăcini secvențial, una câte una: citirea în Hangul, sensul, apoi cuvintele coreene reale care o folosesc, fiecare cu propoziție de exemplu și traducere, și la final etimologia caracterului — context cultural/istoric, marcat clar ca informativ, niciodată testat. Fără test, doar studiu, în ritmul tău, cu navigare prev/next.

Pentru cuvintele unde fiecare silabă corespunde clar unui singur hanja din cele 214 (fără ambiguitate), cuvântul e arătat descompus — ex. `대 + 학 = 대학` și `mare + învățare = universitate` — ca să se vadă exact cum se combină rădăcinile. Pentru restul (silabă în afara celor 214, sau omofonă cu mai multe hanja), rămâne formatul obișnuit: cuvântul întreg, cu silaba rădăcinii evidențiată. Nu se ghicește niciodată sensul unei silabe nesigure.

**Exersează** — 4 tipuri de întrebări, alese aleatoriu, cu prioritate pentru rădăcinile noi sau „due" pentru recapitulare (repetiție spațiată tip SM-2):

- **Silabă → sens**: ce înseamnă această silabă coreeană
- **Sens → silabă**: care silabă coreeană are acest sens
- **Cuvânt → sens**: ce înseamnă silaba evidențiată dintr-un cuvânt coreean real
- **Sens → cuvânt**: care e cuvântul coreean corect pentru un anumit sens

**Puzzle** — formează cuvântul: pornind de la sensul unui cuvânt real, atingi silabele corecte, în ordinea corectă, ca să-l reconstitui. Rădăcina hanja din care pornește cuvântul apare doar ca indiciu mic (silabă + etichetă hanja) — nu e niciodată dată de-a gata. Tava are mereu ~6 silabe (silabele cuvântului + „momeli" — silabe reale din alte cuvinte, care nu se folosesc), ca puzzle-ul să nu fie banal nici la un cuvânt de 2 silabe: trebuie mai întâi să recunoști care silabe aparțin cuvântului, apoi în ce ordine.

## Deploy

```bash
git add .
git commit -m "descriere"
git push -u origin main
```
