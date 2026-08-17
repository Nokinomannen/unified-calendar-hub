# Desktop-appen: uppdaterad och en mini-timer som funkar

## Varför appen känns gammal

Desktop-appen visar den **publicerade** versionen av kalendern, inte förhandsvisningen du jobbar i. Alla nya funktioner finns i preview men har aldrig publicerats, så skrivbordsappen laddar en äldre version. Det är inte ett fel i appen — den hämtar bara det som ligger publicerat.

Åtgärd: publicera projektet, och gör publicering till en fast del av flödet efter varje förändring. Direkt efter publicering hämtar appen den nya versionen (⌘⌥R eller menyn *One → Hämta senaste versionen*), och jag lägger till en tydlig versionskoll så du ser i appen om den kör en gammal version.

## Mini-timern

Fyra saker fixas:

1. **Går att få tillbaka.** En tydlig knapp i kalender-UI:t (bredvid timern) som öppnar/stänger mini-fönstret, plus högerklicksmeny på Dock-ikonen. Menyradsikonen och ⌘⇧T behålls.
2. **Layouten byggs om.** Fönstret är för trångt idag: källa, tid och knappar konkurrerar om samma rad och texten klipps. Ny layout med rätt fönsterstorlek, läsbar tid, alltid synliga knappar (inte bara vid hover) och en riktig stängknapp.
3. **Visar rätt data.** Mini-fönstret får samma inloggning som huvudfönstret så det inte fastnar på "Logga in i huvudfönstret först", och timern uppdateras direkt när du startar/pausar i något av fönstren.
4. **Flyttbart och alltid överst.** Hela ytan blir dragbar utom knapparna, och fönstret sätts som flytande panel så det ligger kvar över andra appar och följer med mellan skrivbord.

## Teknisk sammanfattning

- Publicera projektet så `unified-flow-time.lovable.app` matchar preview; verifiera att appens `appUrl` svarar med den nya bundlen.
- `src/routes/mini-timer.tsx`: ny layout (grid i stället för enradig flex), större `MINI_SIZE` i `electron/main.cjs`, knappar utan opacity-hover, egen stängknapp.
- Delad session: mini-fönstret använder samma Electron-`partition` som huvudfönstret så Supabase-sessionen delas; `useActiveTimer` får realtidsprenumeration/kortare `refetchInterval` så båda fönstren är i synk.
- Drag: `WebkitAppRegion: drag` på hela containern, `no-drag` endast på interaktiva element.
- `electron/main.cjs`: `app.dock.setMenu()` med "Visa/dölj mini-timer" och "Öppna kalendern"; ny IPC `toggle-mini` som webb-UI:t kan anropa via `preload.cjs`.
- `src/components/timer-widget.tsx`: knapp som visas endast när `window.oneDesktop` finns.
- Nya bundlar (Apple Silicon + Intel) byggs och levereras som nedladdning när allt är klart.

Kalender, event, tidsregistrering, Notion och påminnelser rörs inte.
