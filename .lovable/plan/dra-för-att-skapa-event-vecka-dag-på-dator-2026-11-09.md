# Dra för att skapa event (vecka/dag på dator)

## Vad du får
- Håll inne musknappen i en tom yta i vecko- eller dagsvyn och dra nedåt (eller uppåt) över tiderna.
- En färgad "spökruta" följer pekaren och visar tiden live, t.ex. "13:00–14:30". Den fäster mot halvtimmar.
- Släpp: fönstret "Nytt event" öppnas med start och slut redan ifyllda. Skriv titel och spara som vanligt (synkas till Outlook som idag).
- Ett vanligt klick (utan drag) skapar ett 30-minuters event på den halvtimmen.
- Esc avbryter mitt i ett drag. Dubbelklick fungerar som förut.
- Att klicka på befintliga events öppnar dem som vanligt; drag startar inte på ett event.
- Mobilens agenda-vyer och månadsvyn ändras inte (svep mellan veckor fungerar som förut).

## Tekniska detaljer
- `src/components/week-view.tsx`: pointer events (pointerdown/move/up med pointer capture) per dagkolumn; y → minuter, avrundat till 30 min inom 07–23. Lokal state för drag-markering, renderad som absolut ruta. `stopPropagation` så swipe-hooken inte triggas; ignorera pointerdown på event-element.
- Ny prop `onAddRange(start, end)`; `onAdd` behålls för dubbelklick.
- `src/components/add-event-dialog.tsx`: ny valfri prop `defaultEnd`; används i stället för standardlängden när den finns.
- `src/routes/index.tsx`: `defaultEnd`-state, skickas till dialogen; nollställs i övriga öppningsvägar (N-genväg, quick-add).
- Liten ren hjälpfunktion för y→snappad tid med ett vitest-test (snäpp till halvtimme, min 30 min, gränser 07/23).
