# Mjukare swipe i kalendern

## Mål
Kalendern ska följa fingret/trackpaden medan du swipar och sedan glida mjukt till nästa eller föregående månad, vecka eller dag, i stället för att hoppa direkt.

## Vad som ändras
- **Följer rörelsen live:** Kalendern flyttar sig i sidled medan du drar (på mobilen) eller scrollar sidled på trackpaden. Utan att släppa ser du den röra sig.
- **Mjuk övergång:** När du släpper glider den nuvarande perioden ut och den nya glider in från rätt håll, med en kort fjädrande animation (cirka 250 ms).
- **Avbryt naturligt:** Drar du bara lite och släpper glider kalendern tillbaka och inget byts.
- **Snabba svep räknas:** Ett snabbt kort svep byter också period, inte bara ett långt drag.
- **Inget dubbelhopp på trackpad:** Ett trackpad-svep ger ett byte, även med eftersläpande rörelse.
- Pilarna och tangentbordet får samma glid-animation.
- Rörelsen respekterar inställningen "Reducera rörelse" i telefonen/datorn (då byts det direkt).

## Tekniska detaljer
- Bygg om `src/hooks/use-swipe-nav.ts` till att returnera ett live-offset och en riktning. Uppdatera via `requestAnimationFrame` och sätt `transform: translate3d` direkt på elementet (ingen React-rendering per frame), med `will-change: transform`.
- Använd `touchmove` med axellåsning: horisontellt drag blockerar vertikal scroll först efter riktningen är bestämd.
- Tröskel: 25 % av bredden eller hastighet > 0,4 px/ms.
- Byt period när ut-animationen är klar och animera sedan in med en CSS-transition (`cubic-bezier(0.22, 1, 0.36, 1)`). Datan för intilliggande perioder hämtas redan via befintlig cache, så det blir ingen extra bakgrundstrafik.
- Ändringen görs bara i hooken och i omslutande element i `src/routes/index.tsx`. Layouten för dator och mobil i övrigt lämnas orörd.
- Verifiera med Playwright: simulera touch-drag på 390 px och wheel-händelser på dator, och kontrollera att det blir exakt ett byte per svep och inga konsolfel.
