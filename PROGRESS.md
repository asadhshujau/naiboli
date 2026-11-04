# Naiboli — implementation progress

Porting `design_handoff_naiboli/` (HTML prototype) to native Expo SDK 58.

**Testing plan:** no device/build testing between phases. When all 5 phases are done, the user tests an EAS build;
the fix round starts after that, working from the "Open items" list below. Brief: `design_handoff_naiboli/PROMPT.md`,
spec: `design_handoff_naiboli/README.md`. Work is in 5 phases with a review stop after each.

| Phase | Scope | Status |
|---|---|---|
| 1 | Data layer, types, tests | ✅ done (`92ea374`) |
| 2 | Scene canvas, scrubber, bottom panel, top HUD | ✅ done (`c85e8a9`) |
| 3 | Info bubbles and all bottom sheets | ✅ done (`d72a164`) |
| 4 | Location / first-run flow, persistence, splash | ✅ done (this commit) |
| 5 | Polish: side-by-side with the prototype, list of unmatched differences | ⏭ **resume here** |

## Decisions already made
- iOS and Android only (no web target).
- Keep the local fallback scoring (`liveScore`) before activity scores load / on error.
- Best-window text stays as the prototype produces it: "7 AM–11 AM".
- "All N" is a live count of what the scores route returns (13 today).
- Libraries: Skia (scene), react-native-svg (icons/logo/charts), expo-location, AsyncStorage, Expo Google Fonts.
  No expo-blur (blur is drawn in Skia), no bottom-sheet library (custom Reanimated sheet planned), no state library.

## Where things are
- `src/data/` — pure logic ported from the prototype script: API client, parsing (`procWx`, `procTide`, `procActs`),
  moods, scoring, verdicts, islands search, where-am-i handling. Tests in `src/data/__tests__/`
  (`parity.test.ts` runs the prototype's own script from the HTML and compares outputs).
- `src/state/store.ts` — data store: caches, refresh/retry timers, midnight reset, `lastW`/`lastTide`.
  `src/state/storage.ts` — AsyncStorage keys. `src/state/view.ts` — port of `renderVals()` (HUD/panel part only).
- `src/scene/` — `paint.ts` (line-for-line port of `paint`/`palm`/`cloud`/`tick`), `ctx2d.ts` (Canvas2D-like adapter
  over Skia), `palette.ts` (`PAL`, `OBJ`, `lightOf`), `SceneCanvas.tsx` (frame loop, tap hit-test, glass blur),
  `glass.tsx` (registry of frosted-glass rects).
- `src/ui/` — fonts, theme tokens, `Icon` (generated Material Symbols paths), `ShellLogo`, `hud/` components.
- `src/app/index.tsx` — the scene screen. Phase 3 hooks are stubbed there (`openBubble`, `noop` handlers for
  menu / island chip / All / top-3 cards).

## Phase 3 — what was built
- `src/state/sheets.ts` — rest of `renderVals()`: bubble content `B` (actions as data: `SheetTarget`), `bubblePos`
  (`bub` maths in screen dp), `buildGroups`, `buildDetail`, `buildWx`, `buildTide`, `buildIsle`/`isleView`,
  `buildIslandList`, `geoRowOf`, `welcomeOf`. Parity-tested against the prototype's real `renderVals()`
  (`src/state/__tests__/sheets.parity.test.ts`, 8 scenarios incl. edge-case score/week payloads).
- `src/state/ui.ts` — reducer for bubble/sheet/query/geo state (`openSheet`, `closeSheet` + `sheetGone` after 450 ms,
  scene-tap toggle, `picked`). Tests in `ui.test.ts`.
- `src/ui/Bubble.tsx`, `src/ui/sheet/*` (shell `Sheet.tsx` + 8 sheets + `parts.tsx`), `src/ui/Wordmark.tsx`
  (shell as an inline view on the text baseline), `src/ui/MsroBadge.tsx` (bundled copy of the badge SVG),
  `assets/images/openweather-logo.png`.
- Glass: `'bubble'` alpha + `bubbleScale` around the bubble's origin. Glass rects are now measured relative to the
  screen root (`measureLayout`), not `measureInWindow` — the window offset on Android put the panel blur above
  the panel, over the front waves.
- Sheet conventions added: drag down from the top to dismiss, Android back closes sheet then bubble, keyboard
  lifts the sheet (minus any window resize).

## Phase 4 — what was built
- `src/state/locate.ts` — `createLocator(deps)`: port of `permState()` / `maybeWelcome()` / `locate()` with the README
  rules (silent locate on first run when granted, Welcome once with `locAsked`, ask only from the two buttons,
  blocked → "Location is off" then Settings on the next tap). Platform APIs injected; tests in `locate.test.ts`.
- `src/state/useLocator.ts` — singleton locator on expo-location (balanced accuracy, last fix ≤ 5 min, 15 s timeout),
  `/where-am-i`, AsyncStorage `locAsked`, `Linking.openSettings()`; re-reads the permission on app foreground.
- `src/ui/Splash.tsx` — README §1 timeline. The animated "naib" / shell / "li" are placed on an invisible copy of
  the real wordmark (measured), so the baseline matches the platform's text layout. Native splash is plain
  `#FBF6EC` (1×1 transparent image) so it hands over seamlessly; `SplashScreen.hide()` when fonts + data are ready.
- `app.json`: expo-location plugin (When-In-Use string only, no background, Always strings removed),
  `android.blockedPermissions: ACCESS_FINE_LOCATION` (coarse only), splash colour.

## Phase 5 — what to do next
Side-by-side with the prototype in a browser; list differences that can't be matched. Device checks below first.

## Open items carried forward
- **Performance is unverified on a real device.** CPU-only emulator: ~7 fps (not representative; blur isn't the
  cost). Pure JS per frame ≈ 4.6 ms on desktop V8 (`SCENE_PERF=1 npx jest -c scripts/scene-compare/jest.config.js perf`);
  Hermes will be slower. Check on a phone in Expo Go; if it stutters: cache static layers as pictures, reuse paints.
- Headline `text-wrap: balance` has no RN equivalent (uses platform "balanced" strategies).
- Native splash is still the template's (Phase 4 sets `#FBF6EC`).
- Status bar during the splash is dark text (prototype `dark={false}`), although the README says "light content".
- Phase 4 needs a development build (native config changed: location permission strings, splash). Check on Android
  that coarse-only location resolves with Balanced accuracy.
- Phase 3 UI not yet checked on a device (no simulator on the dev machine). Check: 92 px / .84 line-height
  verdict and temperature text clipping, wordmark baseline, sheet drag vs. scroll, keyboard lift on Android.
- Known small differences: tide hero "m" uses Bricolage 700 (no 600 instance); pressed states dim to .6
  (prototype is pointer-only); search placeholder colour #757575 (Chrome default).
- `scripts/scene-compare/proto.mjs` currently crashes under Node 26 (native step still works).

## Commands
```bash
npx expo start                 # then open in Expo Go (everything used is in Expo Go)
npm test                       # unit + parity tests
npx tsc --noEmit && npx expo lint
npm run scene:compare -- /tmp/scene   # native vs prototype pixel diff (needs Chrome + Python Pillow)
```

## Gotchas learned
- Worklet functions aren't hoisted after the worklets Babel plugin runs: define a worklet's callees above it
  (crashed on device once — see note at top of `src/scene/paint.ts`).
- Skia `<Canvas onLayout>` isn't supported on the new architecture — measure a wrapping `View`.
- Android edge-to-edge: `useWindowDimensions()` excludes the nav bar; size the scene from layout.
- React Compiler lint rejects `sv.value = …` on shared values from props/context — use `.set()` / `.get()`.
- In the CanvasKit Jest harness, colour arrays must come from CanvasKit's realm (`scripts/scene-compare/ckRealm.ts`).
- `git push` from the agent sandbox may fail with "Permission denied (publickey)"; it works outside the sandbox.
