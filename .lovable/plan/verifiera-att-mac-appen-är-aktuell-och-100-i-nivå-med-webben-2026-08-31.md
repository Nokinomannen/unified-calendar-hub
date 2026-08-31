# Verifiera att Mac-appen är aktuell och 100 % i nivå med webben

## Nuläge (kontrollerat)

- Den publicerade sidan som appen laddar (`unified-flow-time.lovable.app`) innehåller **senaste bygget** — tasks-togglen, separata Work/Personal-tavlor och Notion-kolumnfixen finns med i live-koden.
- `/mini-timer` svarar 200 på den publicerade sidan, så mini-timerfönstret har en fungerande sida att ladda.
- Bygget är grönt (inga fel) och appen hämtar automatiskt ny version vid fokus (efter 30 min), via menyn "Hämta senaste versionen" (⌘⌥R) och var 3:e timme i bakgrunden.

Slutsats: appen är redan up to date i dagens läge — den speglar alltid den publicerade webben. Det som återstår är att **bevisa** att allt funkar lika bra i appen och släppa en färsk installerare.

## 1. Funktionsverifiering i app-skal (Electron)

Testa i den faktiska Electron-miljön (inte bara webbläsaren) att det som byggts nyligen beter sig identiskt:

- Kalendern: vy, dagslåda, dra-och-släpp, quick add.
- Tasks: tavelväljaren Work/Personal/Alla, dra kort mellan kolumner, skapa/redigera/arkivera mot Notion.
- Tasks-panelen på startsidan under kalendern med Visa/Dölj-knappen.
- Chatt-agenten: text, bilduppladdning via dra-och-släpp och ⌘V.
- Timern: start/paus/stopp i huvudfönstret, mini-timern (⌘⇧T), menyradstext och dock-badge.
- Påminnelser: macOS-notiser begärs och visas, klick öppnar appen.
- Inställningar sparas och ligger kvar efter omstart (mörkt läge, zoom, showTasks).

## 2. Åtgärda det som brister

Eventuella avvikelser som hittas i steg 1 fixas direkt (t.ex. notis-behörighet i Electron eller drag-and-drop mot file://-skal).

## 3. Färsk installerare (v6)

- Bygg om zip-filerna för Apple Silicon (din M4) och Intel med nuvarande `electron/`-filer.
- Verifiera att `Installera One.command` fortfarande hanterar Gatekeeper-signering och att `app-config.json` pekar på rätt adress.
- Leverera ziparna som nedladdning i chatten med en kort uppdaterad instruktion: ersätt gamla One.app i Program, klar — all data ligger i molnet så inget går förlorat.

## Tekniska detaljer

- `electron/main.cjs` och `preload.cjs` rörs bara om steg 1–2 avslöjar brister.
- Paketering: `@electron/packager` + ad-hoc-signering (`codesign --force --deep --sign -`) + `ditto -c -k --keepParent`, som tidigare versioner.
- Inga ändringar i webbappens kod, databas eller Notion-koppling — detta är en ren verifierings- och paketeringsrunda.
