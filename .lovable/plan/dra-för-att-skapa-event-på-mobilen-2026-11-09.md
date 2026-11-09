# Dra för att skapa event på mobilen

Mobilens dag- och veckovy är listor utan timmar idag, så det finns inget att dra över ännu. Veckovyn behåller du som den är, eftersom du gillar den.

## Vad du får
- **Dagvyn på mobilen** får en knapp **Lista / Tider** högst upp. Lista är som idag. Tider visar dagen som en lodrät tidslinje 07–23 med dina events, och dina val sparas.
- Skapa ett event i Tider: **håll fingret still i ungefär en halv sekund** på en tom tid. Telefonen vibrerar lätt där det går och en ruta dyker upp, sedan **drar du nedåt eller uppåt**. Rutan fäster mot halvtimmar och visar tiden live, t.ex. "13:00–14:30".
- Släpp: "Nytt event" öppnas med start och slut ifyllda.
- Ett kort tryck på en tom tid skapar ett event på 30 minuter. Ett tryck på ett event öppnar det som vanligt.
- Vanlig scroll och svep mellan dagar fungerar som förut. Draget startar bara efter att du hållit fingret still, så rör du fingret direkt räknas det som scroll eller svep.
- Datorn ändras inte.

## Tekniska detaljer
- Ny `src/components/mobile-day-timeline.tsx`: pointer events med en long-press-timer på 450 ms (avbryts om fingret rör sig mer än 8 px). När den har löst ut görs `setPointerCapture`, `preventDefault`/`stopPropagation` så att varken scroll eller swipe-hooken kör, samt `navigator.vibrate?.(10)`. Komponenten återanvänder `yToSlotMinutes`/`slotRange` från `src/lib/drag-slot.ts`. Timhöjden är större, 56 px, så det blir lättare att träffa med fingret.
- `src/routes/index.tsx`: lägg till växeln Lista/Tider för mobil dagvy (localStorage `mobile-day-mode`) och skicka `onAddRange={openAdd}`.
- Utöka testet i `drag-slot.test.ts` med 56 px timhöjd.
- Lägg till en regel i AGENTS.md om att mobilens drag-för-att-skapa kräver long-press så att scroll och svep inte störs.
