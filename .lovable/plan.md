# Mannaz, paus i timern och desktop-app

## 1. Mannaz ersätter Tiger of Sweden

- Ny kalender **Mannaz** (praktik i höst), grön färg `#2f9e63` – tydligt skild från A-hubs `#10b981`.
- **Tiger of Sweden arkiveras, inte raderas.** Alla 33 pass (senaste 9/8 kl 12:00) ligger kvar, så timmar och intjänat i historiken är oförändrat.
  - Tiger döljs som val i timern, "Logga timmar" och "Nytt event".
  - I Work & earnings syns Tiger bara när du väljer en period som innehåller pass före 10/8, annars är kortet borta.
- Mannaz blir ett vanligt "job"-jobb: pass i kalendern räknas automatiskt som timmar, och earnings räknas med timlönen du anger.

Öppen punkt: säg vilken timlön Mannaz ska ha (kr/h) så sätter jag den. Tills dess sätts kalendern upp utan lön (timmar räknas, kr = 0).

## 2. Timer med paus/resume

- Paus- och fortsätt-knapp i både timerraden i Work & earnings och i header-indikatorn.
- Pausad tid dras av: sparas passet med rätt nettotid (t.ex. lunch 45 min räknas inte).
- Stopp-dialogen visar starttid, sluttid, total tid och pausad tid, och du kan justera innan du sparar.
- Allt ligger kvar i molnet, så paus överlever sidladdning och byte av enhet.

## 3. Desktop-app – vad det innebär

Jag paketerar samma app som ett riktigt program för din dator (Electron). Det ger:

**Fördelar**
- Egen ikon i Dock/Aktivitetsfältet, egen fönsterhantering, ingen browserflik som råkar stängas.
- **Flytande mini-timer**: ett litet alltid-överst-fönster i hörnet där du kan starta/pausa/stoppa utan att öppna kalendern.
- Timern fortsätter även om huvudfönstret är stängt, så länge appen körs; den kan startas automatiskt när du loggar in på datorn.
- Lokal cache: timerns tillstånd och senaste timmar/eventdata sparas på disk, så appen visar rätt även om nätet ligger nere, och synkar upp när du är online igen.
- Notiser via systemet (t.ex. "timern har gått i 8h").

**Nackdelar**
- Den installeras manuellt (nedladdad fil), och uppdateringar kräver att du laddar ner en ny version – webbversionen uppdateras automatiskt.
- Osignerad app: macOS varnar första gången och du måste tillåta den i Systeminställningar.
- Byggs per plattform (mac / Windows), och jag kan inte testa mac-bygget här – du testar det lokalt.
- Databasen ligger fortfarande i molnet; lokal lagring är cache och offline-kö, inte en helt fristående databas.

**Vad som INTE ändras:** webbversionen finns kvar och fungerar precis som nu. Desktop-appen laddar samma app, så allt du gör syns på båda ställena.

### Vad jag bygger i det steget
- Electron-skal med huvudfönster + separat "mini-timer"-fönster (alltid överst, frameless, ~220x70 px) med start/paus/stopp och löpande klocka.
- Tray-ikon (menyrad) som visar tiden och öppnar mini-timern.
- Lokal persistens av timerstate + offline-kö för timmar som skapats utan nät.
- Nedladdningsknapp i appen (Inställningar/Sources) samt installationsinstruktioner.

## Teknisk detalj

- Migration: ny rad i `calendars` (Mannaz, source `job`, färg, `hourly_rate`), `visible=false` på Tiger; ny kolumn `archived boolean default false` på `calendars` + `archived=true` på Tiger. `tg_create_default_calendars` uppdateras.
- `active_timers`: nya kolumner `paused_at timestamptz`, `paused_ms integer not null default 0`. Hook `use-timer.ts` får `pause`/`resume` och räknar nettotid.
- UI: `timer-widget.tsx`, header-indikator i `app-shell.tsx`, `stop-timer-dialog.tsx` (visar paus-summa), samt filtrering på `archived` i `hours-tracker.tsx`, `add-event-dialog.tsx`, `log-hours-dialog.tsx`.
- Electron: `electron/main.cjs` (huvudfönster + `BrowserWindow` för mini-timer + Tray), `electron/preload.cjs`, paketering med `@electron/packager`, artefakt i `public/` för nedladdning.
