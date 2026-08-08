# DJ-spelningar som en riktig kalenderkälla (+ förbättringar)

## Problemet idag
DJ-spelningar lever i en egen lista (t.ex. 7 augusti) och syns aldrig i kalendern. Event och spelningar är två separata världar som måste hållas i synk för hand.

## Lösning: "DJ" blir en source som Mannaz, A-hub och School

En ny kalender **DJ** (egen färg) läggs till bland källorna. Varje spelning är då ett vanligt event i kalendern — och samtidigt en rad i intäktslistan. De två hålls automatiskt i synk åt båda hållen.

```text
Lägg till event i kalendern "DJ"  ──►  skapar/uppdaterar DJ-spelning (gage, plats, längd)
Lägg till DJ-spelning i Insikter  ──►  skapar/uppdaterar event i DJ-kalendern
Ta bort på ena stället            ──►  tas bort på andra
```

### Så känns det i appen
- I "Nytt event" väljer du kalendern **DJ**. Då dyker extra fält upp: **Gage (kr)** och **Plats/klubb**. Titel och tider är samma som vanligt.
- Sparar du får du både ett event i kalendern och en spelning i intäktsöversikten — en enda inmatning.
- Lägger du in en spelning från Insikter-vyn (som idag) skapas eventet automatiskt på rätt dag och tid.
- Timmarna räknas från eventets längd, så DJ-timmar syns i statistiken tillsammans med Mannaz/A-hub.
- Redan registrerade spelningar (inklusive 7 augusti) backfillas: de får varsitt event i DJ-kalendern på rätt datum, med kl 22:00–03:00 som standardtid när ingen tid finns. Du kan sedan justera tiden direkt i kalendern.

## Övriga förbättringar i samma omgång

1. **Intäktsöversikt per källa** — DJ-gager och timlön från jobb i samma graf i Insikter, uppdelat per månad.
2. **Kommande-lista** — en kompakt "Nästa 7 dagar"-panel överst med nästa pass/spelning och total inplanerad tid.
3. **Snabb-fyllning av gage** — nytt gage föreslås utifrån senaste spelningen på samma plats.
4. **Konfliktvarning vid DJ-pass** — om en spelning krockar med jobb eller skola markeras det direkt när du sparar.
5. **Tangentbord** — `N` för nytt event, `D` för ny DJ-spelning, `T` för idag.

## Teknisk sammanfattning

- Migration:
  - `calendars.kind text not null default 'other'` (`'job' | 'dj' | 'school' | 'other'`), sätt `kind='dj'` på den nya DJ-kalendern och `'job'` på Mannaz/A-hub.
  - `dj_sets.event_id uuid references public.events(id) on delete set null`, unikt index på `event_id`.
  - Skapa DJ-kalendern för användaren, backfilla events för befintliga `dj_sets` och koppla `event_id`.
- `src/hooks/use-dj-sets.ts`: upsert/delete skriver även till `events` (samma transaktionslogik i klienten: skapa event → koppla `event_id`), soft-delete av event vid borttagen spelning.
- `src/hooks/use-calendar-data.ts`: exponera `kind`; `useCreateEvent`/`useUpdateEvent` får valfri `dj` payload (`amount_sek`, `venue`) som synkas till `dj_sets`.
- `src/components/add-event-dialog.tsx`: villkorade fält när vald kalender har `kind === 'dj'`; laddar befintlig `dj_set` vid redigering.
- `src/components/hours-tracker.tsx` + `src/routes/dashboard.tsx`: DJ-timmar och gager i timmar-/intäktsberäkning per källa.
- Nya småkomponenter: `upcoming-panel.tsx`, kortkommandon i `app-shell.tsx`.
- Befintlig kalendervy, event-aggregering och tidsregistrering rörs inte i övrigt.
