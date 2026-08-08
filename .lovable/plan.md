# Påminnelser för events — notiser + mejl

Idag finns fältet "reminder" på ett event, men ingenting läser det: inga notiser, inga mejl skickas. Planen gör påminnelser verkliga, med egna standardinställningar per kalender (DJ, Mannaz, A-hub, School, Personal).

## 1. Inställningar per kalenderkälla

Under **Sources** (bredvid färgvalen) får varje kalender ett litet påminnelsekort:

- Notis: av / 15 min / 30 min / 1 h / 2 h / kvällen innan
- Mejl: av / dagen innan (kl 18) / samma dag på morgonen (kl 08)
- Extra för DJ och jobb-kalendrar: "Påminn mig att logga timmar" — en påminnelse *efter* att eventet slutat (t.ex. 30 min efteråt) med direktlänk till loggningen.

Exempel: DJ = mejl dagen innan + notis 2 h före + loggpåminnelse efteråt. Mannaz/A-hub = notis 30 min före + loggpåminnelse. School = notis 30 min före, inget mejl.

När du skapar ett event ärvs kalenderns inställning automatiskt, men i event-dialogen kan du ändra per event: notistid, samt kryssrutor för "Mejla mig dagen innan" och "Mejla mig samma dag".

## 2. Att du faktiskt får notifikationerna

Tre lager, så att inget faller mellan stolarna:

1. **Webbnotiser** — en engångsruta "Slå på notiser" i appen (Notification API). En service worker gör att notisen visas även när fliken ligger i bakgrunden.
2. **Skrivbordsappen** — Electron visar native macOS-notiser och håller dem igång så länge appen kör.
3. **Mejl** — enda kanalen som funkar när dator och app är avstängda. Skickas från servern enligt schema, inte från din webbläsare.

En liten statusrad i Sources visar om notiser är tillåtna i webbläsaren, med knapp för att aktivera.

## 3. Serverdelen (mejl + robusthet)

- Ny tabell `event_reminders` som kö: en rad per event-tillfälle och kanal, med planerad tid och status. Det gör att samma påminnelse aldrig skickas två gånger, och att återkommande events (skolan, weekly standup) hanteras korrekt per tillfälle.
- Ett schemalagt jobb kör var 5:e minut, plockar förfallna rader och skickar.
- Mejlen skickas till din inloggade mejladress via Lovables e-posttjänst (kräver ett litet uppsättningssteg för avsändardomän — jag sätter upp det).
- Mejlet innehåller titel, tid, plats/venue, kalender och — för DJ/jobb — gage respektive förväntade timmar, plus en länk rakt in i appen.

## 4. Kommande-vy

En "Kommande 7 dagar"-lista på startsidan som visar nästa events med en liten klock-ikon som markerar vilka påminnelser som är satta, så du ser direkt om något saknar påminnelse.

## Tekniska detaljer

- Migration: `calendars` får `reminder_minutes`, `email_reminder` (`none|day_before|same_day`), `log_reminder_minutes`; `events` får `email_reminder`; ny tabell `event_reminders` (event_id, occurrence_date, channel, scheduled_at, sent_at, status) med RLS + GRANTs.
- Kön fylls på av en serverfunktion som expanderar RRULE 14 dagar framåt och körs vid varje event-ändring samt en gång per natt.
- Utskick via TanStack server route `src/routes/api/public/hooks/send-reminders.ts`, schemalagd med pg_cron/pg_net var 5:e minut.
- Webbnotiser: ny `useReminderNotifications`-hook + `public/sw.js`; Electron-läget använder native notiser via main-processen.
- Befintlig kalender-, event- och tidsregistreringsfunktionalitet rörs inte.
