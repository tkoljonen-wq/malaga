# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekti

**Kulujen jako** — geneerinen matkojen yhteisten kulujen jakosovellus. Kuka tahansa voi luoda ryhmän ja kutsua jäsenet 6-merkkisellä koodilla. PWA, ajetaan GitHub Pagesilta, tietokanta Firebase Realtime Databasessa.

## Teknologia

- Vanilla JS (ES modules), ei frameworkkeja
- Firebase Realtime Database (CDN-versio 10.12.2) — käytetään `set`, `push`, `onValue`, `remove`, `get`
- Google Fonts: Bebas Neue (otsikot) + Inter (teksti)
- PWA: manifest.json + sw.js (network-first)
- Väripaletti (CSS-muuttujat): `--bg: #1a1a2e`, `--surface: #16213e`, `--card: #0f3460`, `--accent: #f0a500`, `--accent-dim: #c98a00`, `--text: #fff`, `--text-muted: #8899bb`, `--positive: #48bb78`, `--negative: #fc8181`, `--border: #1e3a5f`, `--radius: 14px`

## Rakenne

```
index.html          ← koko sovellus (HTML + CSS + JS inline)
manifest.json       ← PWA-manifest (viittaa SVG-ikoneihin)
sw.js               ← Service worker (network-first), CACHE_NAME tällä hetkellä malaga-2026-v3
icons/              ← SVG-ikonit (192, 512, maskable) — GitHubissa vain SVG, ei PNG
```

## Ryhmät ja tunnistus

Käyttäjät ja ryhmät tulevat Firebasesta — ei kovakoodattu. Ryhmän perustaja on admin (`meta.admin`). Ryhmäkoodi on 6 merkkiä, isot kirjaimet + numerot (sekoittuvat merkit poistettu: O/0, I/1 jne.).

localStorage-avaimet:
- `malaga_group` — ryhmäkoodi
- `malaga_user` — käyttäjänimi

Firebase-konfiguraatio on `index.html` rivillä ~830 (projekti `malaga2026-322ea`, Realtime Database europe-west1). Konfiguraatio on jo asetettu — ei tarvitse vaihtaa.

## Paikallinen kehitys

ES-moduulit eivät toimi `file://`-protokollalla. Käynnistä paikallinen HTTP-palvelin:
```
npx serve .
```
Avaa `http://localhost:3000` selaimessa. Firebase-yhteys toimii normaalisti myös paikallisesti.

## Service worker -päivitys

Kun muokkaat välimuistissa olevia tiedostoja (index.html, manifest.json, ikonit), bumppaa `sw.js`:n `CACHE_NAME` (esim. `malaga-2026-v4`) — muuten selain käyttää vanhaa välimuistia.

**Tärkeää:** `cache.addAll` on korvattu `Promise.allSettled`-pohjaisella silmukalla — yksittäinen 404 ei enää kaada SW-asennusta.

## JS-koodin rakenne (`index.html` rivi ~830 eteenpäin)

Koko sovelluslogiikka on yhdessä `<script type="module">` -lohkossa. Avainmuuttujat:
- `currentUser` — localStorage:sta ladattu, avain `malaga_user`
- `groupCode` — 6-merkkinen ryhmäkoodi, localStorage-avain `malaga_group`
- `groupMeta` — `{ name, admin, createdAt }`, ladataan Firebasesta
- `groupMembers` — `string[]`, ladataan Firebasesta (`groups/<code>/members`)
- `allExpenses` — `{ id: expenseObj }`, pidetään synkronoituna Firebasen `onValue`-kuuntelijalla
- `splitMode` — `'equal'` | `'custom'`, hallitsee kulu-jako-UI:ta
- `memberInputs` — `string[]`, väliaikainen tila "Luo ryhmä" -lomakkeelle

Splash-näkymät (`showSplash(state)`-tilakoneen avulla):
- `loading` — Firebase-tarkistuksen aikana
- `choice` — valitse: luo uusi / liity
- `create` — ryhmän luomislomake (nimi + dynaaminen jäsenlista)
- `created` — koodi näytetään isolla + oman nimen valinta
- `join` — ryhmäkoodin syöttö + jäsenen valinta
- `relogin` — vaihda käyttäjä saman ryhmän sisällä (ei kysy koodia uudelleen)

Avaintoiminnot:
- `initUser()` — async, hakee Firebasesta, offline-fallback localStorage:sta
- `generateCode()` — satunnainen 6-merkkinen koodi
- `isAdmin()` — `currentUser === groupMeta.admin`
- `showApp()` → `renderSplitCheckboxes()` + `loadExpenses()` + `renderSummary()`
- `loadExpenses()` — `onValue(ref(db, \`groups/${groupCode}/expenses\`))`
- `renderExpenses()` — kulut uusimmasta vanhimpaan (`createdAt`)
- `renderSummary()` — jokaisen käyttäjän maksettu yhteensä
- `showSettlement()` — nettosaldot + greedy-siirrot (`calcTransactions`)
- `setSplitAll/Custom/Equal/Unequal()` — jako-UI:n hallinta
- `addLog(action, details)` — async, `groups/<code>/logs`
- `openLog()` — admin-vain, `get` (ei reaaliaikainen)

Apufunktiot: `formatEur(n)`, `formatDate(d)`, `escHtml(s)` (XSS-suoja kaikessa innerHTML:ssä).

Window-globaalit (inline `onclick`): `setSplitAll`, `setSplitCustom`, `setSplitEqual`, `setSplitUnequal`, `confirmDelete`, `openModal`, `closeModal`, `openLog`.

## Firebase-tietorakenne

```
groups/<KOODI>/meta:      { name, admin, createdAt }
groups/<KOODI>/members:   ["Nimi1", "Nimi2", ...]
groups/<KOODI>/expenses/<id>: { paidBy, amount, description, date,
                                splitBetween, customSplit?, createdAt }
groups/<KOODI>/logs/<id>: { timestamp, user, action, details }
```

`splitBetween` voi palautua Firebasesta objektina `{0:'X', 1:'Y'}` — normalisoidaan `Array.isArray()`-tarkistuksella kaikkialla missä käytetään. Tuntematon `paidBy` tai tyhjä `splitBetween` ohitetaan kaatumatta.

Vanha `/expenses`- ja `/logs`-data (Malaga 2026) on jätetty Firebaseen koskemattomana.

## Loppulaskelma-algoritmi

`calcTransactions(balances)`: nettosaldo = `sum(paidBy==user) - sum(osuus)`. Jos `customSplit` asetettu, käytetään sen arvoja; muuten tasan `amount / splitBetween.length`. Greedy-paritus minimoi siirtojen määrän.

## Lokikirjoitus

`addLog` on `async`, kutsutaan `await`-lla. `catch`-lohko on tarkoituksella tyhjä — lokivirhe ei saa estää pääoperaatiota.

## Modaalit

Kolme modaalia: `modal-settlement`, `modal-confirm`, `modal-log`. `openModal(id)` / `closeModal(id)` lisäävät/poistavat `.open`-luokan. Taustaklikkauksella sulkeminen kytketty `.modal-overlay`-elementteihin.

## GitHub Pages -käyttöönotto

1. Push kaikki tiedostot GitHubiin (**muista:** GitHubissa on vain SVG-ikonit, ei PNG)
2. Settings → Pages → Source: `main` branch, `/ (root)`
3. Sivusto: `https://<käyttäjä>.github.io/<repo>/`
