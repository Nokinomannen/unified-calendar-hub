# Fixa kalenderfiltren (chipsen) på startsidan

## Vad som faktiskt är fel

Det beror inte på att event saknas. I databasen står School, DJ och Tiger of Sweden som globalt dolda (`visible = false`), medan A-hub, Personal och Mannaz är synliga. Det stämmer exakt med hur chipsen ser ut i din skärmbild.

Chipsen på startsidan skriver bara till det per-vy-sparade filtret — de rör aldrig den globala synligheten. Så för School och DJ: hur mycket du än klickar förblir chipet släckt och eventen dolda, eftersom den globala flaggan fortsatt är `false`. Den flaggan går idag bara att ändra under Källor (öga-ikonen).

Tiger of Sweden är dessutom arkiverad men visas ändå bland chipsen.

## Vad jag ändrar

- Ett klick på ett chip styr både den globala synligheten och per-vy-filtret: är kalendern globalt dold slås den på igen samtidigt som den tas bort ur vyns dolda lista. Ett klick = kalendern tänds, ett till = den släcks (per vy).
- "Alla" / "Inga" gör samma sak: "Alla" tänder även globalt dolda kalendrar.
- Arkiverade kalendrar (Tiger of Sweden) visas inte längre i chip-raden — de finns kvar under Källor.
- En engångsuppstädning: sätt School och DJ till synliga så att du ser dina skolhändelser direkt.

## Tekniskt

- `src/routes/index.tsx`: filtrera chip-listan på `!c.archived`; låt `toggleCalendar`/`setAll` anropa `useUpdateCalendar` (`visible: true`) när kalendern är globalt dold, utöver den befintliga `viewFilters`-uppdateringen.
- Migration: `update public.calendars set visible = true where name in ('School','DJ')`.
- Inget annat rörs — månad/vecka/dag-vyerna, eventdata och timregistrering är oförändrade.
