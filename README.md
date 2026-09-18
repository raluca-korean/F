# Korean by Hanja

Aplicație web independentă de învățat coreeana prin cele 214 caractere hanja de bază — citire, sens și cuvinte coreene reale care le conțin.

Fără build tools, fără server, fără cont — vanilla HTML/CSS/JS. Progresul (scor, XP, repetiție spațiată) se salvează local, în browser-ul fiecărui utilizator.

## Structură

- `index.html` / `style.css` / `app.js` — aplicația (o singură pagină)
- `data/hanja.json` — cele 214 hanja, cu citire, sens (ro/en), etimologie și cuvinte de exemplu

## Cum funcționează

4 tipuri de întrebări, alese aleatoriu, cu prioritate pentru caracterele noi sau „due" pentru recapitulare (repetiție spațiată tip SM-2):

- **Hanja → sens**: ce înseamnă acest caracter
- **Hanja → citire**: cum se citește în coreeană
- **Cuvânt → hanja**: ce hanja apare într-un cuvânt coreean real
- **Sens → hanja**: care hanja are un anumit sens

## Deploy

```bash
git add .
git commit -m "descriere"
git push -u origin main
```
