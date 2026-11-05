# Naiboli

Forecast for fun: an island-scene weather app for the Maldives (Expo SDK 58, iOS and Android). Pick an island
or let it find you; the scene, headline and activity verdicts follow the weather, tide and time of day.

## Develop

```bash
npm install
npx expo start               # dev build (press s for Expo Go)
npm test                     # unit + parity tests
npx tsc --noEmit && npx expo lint
```

The API base URL comes from `EXPO_PUBLIC_API_URL`: `.env` for `expo start`, `build.<profile>.env` in `eas.json`
for builds.

## Build and update

```bash
npx eas-cli@latest build --profile development --platform android
npm run update:preview -- "What changed"       # OTA update with the preview profile's env
npm run update:production -- "What changed"
```

Native changes (new native library, native config in `app.json`, plugins, icon / splash) need a new build;
JS-only changes can ship as an update.

## Where things are

- `src/app/` — screens (Expo Router)
- `src/data/` — API client, parsing, moods, scoring, copy (`src/data/copy/`)
- `src/state/` — data store, view models for the HUD, sheets and bubbles
- `src/scene/` — the Skia island scene and frosted glass
- `src/ui/` — HUD, sheets, theme, fonts, icons
- `PROGRESS.md` — status, pending work, decisions and gotchas
