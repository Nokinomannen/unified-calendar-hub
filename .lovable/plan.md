# One som riktig Mac-app med timer i menyraden

Målet: en färdig fil du bara laddar ner, drar till Program och kör — plus en timer du kan visa/dölja när du vill.

## Varför det inte gick förra gången

Appen byggdes aldrig färdigt till en nedladdningsbar fil. Instruktionerna beskrev hur man bygger själv i terminalen istället för att ge dig en klar app. Den här gången producerar jag själva filen och lägger den som en nedladdning direkt i chatten.

## Vad du får

1. **En nedladdningsbar Mac-app** (zip). Jag bygger både Apple Silicon (M1/M2/M3/M4) och Intel, så du kan ta rätt version oavsett dator. Öppna zip → dra `One.app` till Program → högerklick → Öppna första gången (osignerad app).
2. **Ikon i menyraden** överst på skärmen: vänsterklick växlar mini-timern på/av, högerklick ger meny med Öppna kalendern, Visa/dölj mini-timer, Starta vid inloggning och Avsluta.
3. **Mini-timer som flytande fönster**: alltid överst, dras dit du vill, kommer ihåg sin position, kan stängas med kryss och öppnas igen från menyraden. Visar aktiv källa, tid och knappar för start/paus/stopp.
4. **Levande tid i menyraden**: när timern går visas den räknande tiden bredvid ikonen så du ser den utan att öppna något.
5. **Global snabbtangent** (Cmd+Shift+T) som växlar mini-timern var du än är.
6. **Appen ligger kvar i menyraden** när kalenderfönstret stängs, så timern fortsätter räkna.

## Teknisk sammanfattning

- Bygger med `@electron/packager` för `darwin-arm64` och `darwin-x64`, zippar output och levererar via nedladdningsbar artefakt.
- `electron/main.cjs` utökas: sparad fönsterposition för mini-timern, `globalShortcut` för Cmd+Shift+T, `app.setLoginItemSettings` för autostart, `tray.setTitle` för tidstext i menyraden.
- Mini-timerfönstret får `visibleOnAllWorkspaces`, `alwaysOnTop` med `floating`-nivå och en egen liten stängknapp (fönstret är ramlöst).
- Renderern (`/mini-timer`) postar aktuell timerstatus till main-processen via en liten `preload.cjs` med `contextBridge`, så menyradens text kan uppdateras. Ingen ny backend-logik — den befintliga `active_timers`-tabellen och hookarna används oförändrade.
- Ny riktig app-ikon (`.icns`) genereras så appen inte visas med Electrons standardikon, plus en template-ikon i menyraden som funkar i ljust och mörkt läge.
- Appen laddar den publicerade adressen. Innan bygget kontrollerar jag att projektet är publicerat så appen har något att ladda; annars publicerar jag först.

Kalender, eventhantering och tidsregistrering rörs inte i övrigt.
