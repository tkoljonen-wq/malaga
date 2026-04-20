# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekti

**Malaga 2026** — neljän miehen yhteisloman kustannusten jakosovellus. PWA, ajetaan GitHub Pagesilta, tietokanta Firebase Realtime Databasessa.

## Teknologia

- Vanilla JS (ES modules), ei frameworkkeja
- Firebase Realtime Database (CDN-versio 10.12.2)
- Google Fonts: Bebas Neue (otsikot) + Inter (teksti)
- PWA: manifest.json + sw.js (network-first)
- Väripaletti (CSS-muuttujat): `--bg: #1a1a2e`, `--surface: #16213e`, `--card: #0f3460`, `--accent: #f0a500`, `--accent-dim: #c98a00`, `--text: #fff`, `--text-muted: #8899bb`, `--positive: #48bb78`, `--negative: #fc8181`, `--border: #1e3a5f`, `--radius: 14px`

## Rakenne

```
index.html          ← koko sovellus (HTML + CSS + JS inline)
manifest.json       ← PWA-manifest (viittaa SVG-ikoneihin)
sw.js               ← Service worker (network-first), välimuistittaa SVG-ikonit
icons/              ← sekä SVG- että PNG-ikonit (192, 512, maskable)
```

## Käyttäjät ja Firebase-konfiguraatio

Käyttäjät tulevat Firebasesta ryhmäkohtaisesti — ei kovakoodattu. Admin on ryhmän perustaja (tallennettu `meta.admin`-kenttään).

Firebase-konfiguraatio on `index.html` rivillä ~830 (projekti `malaga2026-322ea`, Realtime Database europe-west1). Konfiguraatio on jo asetettu — ei tarvitse vaihtaa.

## Paikallinen kehitys

ES-moduulit eivät toimi `file://`-protokollalla. Käynnistä paikallinen HTTP-palvelin esim.:
```
python -m http.server 8080
```
Avaa sitten `http://localhost:8080` selaimessa. Firebase-yhteys toimii normaalisti myös paikallisesti.

## Service worker -päivitys

Kun muokkaat välimuistissa olevia tiedostoja (index.html, manifest.json, ikonit), bumppaa `sw.js`:n `CACHE_NAME` (esim. `malaga-2026-v2`) — muuten selain käyttää vanhaa välimuistia.


## JS-koodin rakenne (`index.html` rivi ~830 eteenpäin)

Koko sovelluslogiikka on yhdessä `<script type="module">` -lohkossa. Avainmuuttujat:
- `currentUser` — localStorage:sta ladattu, avain `malaga_user`
- `groupCode` — 6-merkkinen ryhmäkoodi, localStorage-avain `malaga_group`
- `groupMeta` — `{ name, admin, createdAt }`, ladataan Firebasesta
- `groupMembers` — `string[]`, ladataan Firebasesta (`groups/<code>/members`)
- `allExpenses` — `{ id: expenseObj }`, pidetään synkronoituna Firebasen `onValue`-kuuntelijalla
- `splitMode` — `'equal'` | `'custom'`, hallitsee kulu-jako-UI:ta
- `memberInputs` — `string[]`, väliaikainen tila "Luo ryhmä" -lomakkeelle

Splash-näkymät (tilakoneen tavoin, hallitaan `showSplash(state)`-funktiolla):
- `loading` — näytetään Firebase-tarkistuksen aikana
- `choice` — valitse: luo uusi / liity
- `create` — ryhmän luomislomake (nimi + jäsenlista)
- `created` — koodi näytetään + oman nimen valinta
- `join` — ryhmäkoodin syöttö + jäsenen valinta
- `relogin` — vaihda käyttäjä saman ryhmän sisällä

Avaintoiminnot:
- `initUser()` — async, hakee Firebasesta, kutsuu `showApp()` tai `showSplash()`
- `generateCode()` — palauttaa satunnaisen 6-merkkisen koodin (A-Z ilman sekoittuvat, 2-9)
- `isAdmin()` — `currentUser === groupMeta.admin`
- `showApp()` → `renderSplitCheckboxes()` + `loadExpenses()` + `renderSummary()`
- `loadExpenses()` — `onValue(ref(db, \`groups/${groupCode}/expenses\`))`, kutsuu `renderExpenses()` + `renderSummary()`
- `renderExpenses()` — renderöi kulut uusimmasta vanhimpaan (`createdAt`-järjestys)
- `renderSummary()` — laskee jokaisen käyttäjän maksaman kokonaissumman
- `showSettlement()` — laskee nettosaldot ja greedy-siirrot (`calcTransactions`), näyttää modaalin
- `setSplitAll()` / `setSplitCustom()` — hallitsee jaettavat henkilöt (kaikki vs. valitut)
- `setSplitEqual()` / `setSplitUnequal()` — hallitsee jako-tapaa (tasan / oma jako)
- `addLog(action, details)` — kirjoittaa lokimerkinnän Firebasen `logs`-haaraan
- `openLog()` — admin-vain, hakee ja näyttää `logs`-haaran (vain `get`, ei reaaliaikainen)

Apufunktiot: `formatEur(n)` (fi-FI-muoto + €), `formatDate(d)` (ISO → pp.kk.vvvv), `escHtml(s)` (XSS-suoja kaikessa innerHTML:ssä).

Window-globaalit (inline `onclick`-käyttö): `setSplitAll`, `setSplitCustom`, `setSplitEqual`, `setSplitUnequal`, `confirmDelete`, `openModal`, `closeModal`, `openLog`.

## Firebase-tietorakenne

```json
groups/<KOODI>/meta: {
  "name": "Malaga 2026",
  "admin": "Timppa",
  "createdAt": 1710000000000
}

groups/<KOODI>/members: ["Timppa", "Matti", "Petteri", "Tatu"]

groups/<KOODI>/expenses/<push_id>: {
  "paidBy": "Timppa",
  "amount": 45.50,
  "description": "Ravintola El Patio",
  "date": "2026-03-15",
  "splitBetween": ["Timppa", "Matti"],
  "customSplit": { "Timppa": 30.00, "Matti": 15.50 },  // vain jos oma jako
  "createdAt": 1710000000000
}

groups/<KOODI>/logs/<push_id>: {
  "timestamp": 1710000000000,
  "user": "Timppa",
  "action": "Kulu lisätty",
  "details": "45,50 € — Ravintola — jaettu: Timppa, Matti"
}
```

Vanha `/expenses`- ja `/logs`-data (Malaga 2026 -reissu) on jätetty Firebaseen koskemattomana — uusi sovellus ei lue sitä.

## Loppulaskelma-algoritmi

`calcTransactions(balances)`: nettosaldo = `sum(paidBy==user) - sum(osuus)`. Jos `customSplit` on asetettu, käytetään sen arvoja; muuten tasan `amount / splitBetween.length`. Greedy-paritus: suurin velallinen maksaa suurimmalle saatavaa olevalle, minimoi siirtojen määrän.

Firebase voi palauttaa `splitBetween`-taulukon objektina `{0:'Timppa', 1:'Petteri'}`. Sekä `showSettlement` että `renderExpenses` normalisoivat tämän `Array.isArray()`-tarkistuksella. Tuntematon `paidBy` tai tyhjä `splitBetween` ohitetaan kaatumatta.

## Lokikirjoitus

`addLog` on `async`. Sitä kutsutaan aina `await`-lla (`addExpense`, poiston vahvistus), jotta lokimerkintä ei häviä verkkoviiveen takia. Funktion `catch`-lohko on tarkoituksella tyhjä (lokivirhe ei saa estää pääoperaatiota).

## Modaalit

Kolme modaalia HTML:ssä: `modal-settlement` (loppulaskelma), `modal-confirm` (poistovahvistus), `modal-log` (loki). `openModal(id)` / `closeModal(id)` lisäävät/poistavat `.open`-luokan. Taustaklikkauksella sulkeminen on kytketty kaikkiin `.modal-overlay`-elementteihin.

## GitHub Pages -käyttöönotto

1. Luo GitHub-repo, push kaikki tiedostot
2. Settings → Pages → Source: `main` branch, `/ (root)`
3. Sivusto toimii osoitteessa `https://<käyttäjä>.github.io/<repo>/`
