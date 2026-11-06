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
for builds. Everything points at `https://naiboli.shujau.dev/api` (also the fallback in `src/data/api.ts`); to try
a local API, change `.env` for that session only.

## Build and update

Two EAS profiles:

- `development` — dev client APK (internal distribution, arm64 only), loads JS from `npx expo start`.
- `production` — Play Store AAB (armeabi-v7a + arm64), release JS, build number auto-incremented.

```bash
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile production --platform android
npm run update:production -- "What changed"   # OTA update to production builds, with eas.json's env
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
