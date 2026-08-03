# One — desktop

Electron-skal som kör kalendern som ett riktigt program på din dator, med en
flytande mini-timer och en ikon i menyraden/aktivitetsfältet.

## Installera (macOS)

1. Packa upp den nedladdade zip-filen.
2. Dra `One.app` till Program (Applications).
3. Första gången: högerklicka på appen → Öppna → Öppna (macOS varnar för att appen inte är signerad).

## Windows

Packa upp och kör `One.exe`.

## Fönster

- Huvudfönster: hela kalendern.
- Mini-timer: litet fönster alltid överst, dra i det för att flytta. Starta, pausa och stoppa timern utan att öppna kalendern.
- Menyrads-/systemfältsikon: klick växlar mini-timern; högerklick ger meny.

Stänger du kalenderfönstret ligger appen kvar i menyraden så timern fortsätter.

## Peka appen mot en annan adress

Appen laddar den publicerade webbadressen. Byt genom att sätta miljövariabeln
`ONE_APP_URL`, eller redigera `app-config.json` i appmappen.

## Bygga själv

```bash
npm install
npx @electron/packager . "One" --platform=darwin --arch=arm64 --out=electron-release --overwrite
```
