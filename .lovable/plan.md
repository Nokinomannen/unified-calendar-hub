# Timer för arbetstid + veckovis standup

## 1. Arbetstimer

En start/stopp-timer för jobbpassen (A-hub och Tiger of Sweden). När du stoppar den skapas ett vanligt kalenderpass, vilket betyder att timmarna automatiskt räknas in i "Work & earnings" precis som schemalagda pass.

**Så fungerar det**
- Ny "Timer"-rad överst i Work & earnings-kortet: väljare för jobb (A-hub / Tiger of Sweden) + "Starta"-knapp.
- När timern går visas den som en löpande klocka (00:42:13) med "Stoppa"-knapp, och den syns även som en liten indikator i appens header så du ser den från alla vyer.
- Timern överlever sidladdning, stängd flik och byte av enhet — den ligger i molnet, inte i webbläsaren.
- Vid stopp öppnas en bekräftelseruta med förifylld startid, sluttid, jobb och en valfri notering. Du kan justera tiderna innan du sparar, eller kasta passet.
- Sparat pass blir en händelse i vald jobbkalender med titel t.ex. "A-hub (timer)" och noteringen som beskrivning. Det syns i kalendern och räknas i timmar + intjänat (160 kr/h A-hub, 162 kr/h Tiger).

## 2. Weekly standup

Återkommande händelse i **A-hub**-kalendern:
- Måndagar 14:30–15:00, "Weekly standup – leveransteamet".
- Första: måndag 17 augusti. Sista: måndag 5 oktober (8 tillfällen).
- Eftersom den ligger på A-hub räknas 0,5h in i A-hub-timmarna varje måndag under perioden.

## Teknisk detalj

- Migration: ny tabell `active_timers` (`user_id` unik, `calendar_id`, `started_at`, `note`) med RLS + grants scopat till `auth.uid()`.
- Ny hook `src/hooks/use-timer.ts` — läs pågående timer, starta, stoppa, avbryt.
- Nya komponenter: `timer-widget.tsx` (i hours-tracker) och `stop-timer-dialog.tsx`.
- Header-indikator i `src/components/app-shell.tsx`.
- Standup-eventet läggs in som en rad i `events` med `rrule` = veckovis, avslutad efter 5 okt, kopplad till A-hub-kalendern.
- Passar även: rättar en importvarning för `rrule`-biblioteket som just nu loggar ett fel vid serverrendering.

Inget rörs i befintlig logik för DJ Sets, scheman eller earnings-beräkningen.
