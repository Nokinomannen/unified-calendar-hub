# Mannaz-events och påminnelser in i kalendern

Allt läggs i kalendern **Mannaz** (grön), i tidszonen Europe/Copenhagen. Inget skapas efter december 2026, och innan något skrivs kollas befintliga events på samma dag/titel så inga dubbletter uppstår.

## Enstaka events

| Datum | Tid | Titel |
|---|---|---|
| 31 aug | 09:00–10:00 | Producer role onboarding introduction |
| 3 sep | 15:00–15:30 | SharePoint walkthrough with Molly |
| 10 sep | 10:00–11:00 | Mannaz introduction |
| 21 sep | 10:00–10:50 | Consulting International Sales Meeting |
| 28 sep | 10:00–10:50 | Local Sales Meeting Sweden |
| 4 okt | 13:20–16:00 | Train from Aarhus to Copenhagen with Henrik |
| 5 okt | 09:00–09:50 | Local Sales Meeting Sweden |
| 28 okt | 09:00–16:00 | Preparation meeting for IDA Conference |
| 4 nov | 09:00–16:00 | Preparation meeting for IDA Conference |
| 11 nov | 09:00–16:00 | IDA Conference with Henrik |
| 12 nov | 09:00–16:00 | IDA Conference with Henrik |
| 16–19 nov | heldag | Horizon 8 — Emerging Directors F2F Learning Lab (Köpenhamn) |
| 4 dec | 15:00–23:00 | Mannaz Christmas Party |

Beskrivningar enligt din text (t.ex. tågresan: "Henrik Challis tar tåget Aarhus–Köpenhamn. Noah följer med").

## Återkommande events (slutar i december 2026)

- **Monthly Sales Meeting** — 10:00–11:00, första måndagen varje månad, 7 sep → 7 dec.
- **Consulting International Sales Meeting** — 10:00–10:50, andra måndagen, 14 sep → 14 dec.
- **Mannaz Sweden Check-in** — 11:00–11:50, andra måndagen, 14 sep → 14 dec.
- **Weekly check-in with Henrik and Molly** — 13:00–13:30, varje måndag, 5 okt → 14 dec.

## Påminnelser (i kalendern, inte events)

Läggs som heldagsposter i Mannaz-kalendern med prefix "Påminnelse:" så de syns överst på dagen utan att blockera tid:

1. **31 aug** — Slutför Mannaz Academy-modulen om producer-rollen (deadline före 31 aug, läggs 30 aug).
2. **9 sep** — Förbered Mannaz-introduktionen. Checklistan (vem är du, var studerar du, var placeras du, vad hoppas du få ut, frågor, kom ihåg presentationen) ligger i beskrivningen.
3. **9 nov** — Förbered Horizon 8 (ca en vecka innan programmet 16–19 nov).
4. **Ingen deadline** — Läs Patriks långa rapport från River om facilitering och AI-ledarskap ("Someday"-prioritet). Läggs som påminnelse 1 dec så den inte glöms bort.
5. **Ingen deadline** — Skapa ett konsult-CV för Mannaz (Mollys mall, kolla medarbetar-CV:n, ta med relevanta Kaospilot-projekt, vinkla mot Mannaz-uppdrag). Läggs som påminnelse 15 sep.
6. **4 okt** — Res med Henrik Aarhus→Köpenhamn (kopplad till tågresan ovan).

## Tekniskt

- Alla rader skapas som ett SQL-insert mot `events` med `calendar_id` för Mannaz och `user_id` för ditt konto.
- Tider konverteras från Europe/Copenhagen till UTC vid insert (CEST +2 fram till 25 okt, CET +1 därefter) — appen visar dem i lokal tid.
- Återkommande poster använder `rrule`: `FREQ=MONTHLY;BYDAY=1MO;UNTIL=…`, `BYDAY=2MO;UNTIL=…` respektive `FREQ=WEEKLY;BYDAY=MO;UNTIL=20261214T…Z`, vilket matchar hur `use-calendar-data.ts` expanderar serier.
- Horizon 8 skapas som ett `all_day`-event 16–19 nov; påminnelser skapas som `all_day`-events med "Påminnelse:"-prefix.
- Dedupe: innan insert körs en kontroll mot befintliga icke-raderade events med samma titel och startdag; träffar hoppas över.
- Inga schemaändringar och ingen kodändring behövs.
