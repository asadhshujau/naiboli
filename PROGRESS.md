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
| 4 | Location / first-run flow, persistence, splash | ✅ done (`0e4e0f8`) |
| 5 | Polish: side-by-side with the prototype, list of unmatched differences | ✅ done (this commit) |
| — | EAS build test by the user, then the fix round | ⏭ **next** |

## Pending — start here when asked "what's pending?"
All 5 phases are done. Next steps, in order:
1. **User tests an EAS build** (development or preview profile — Phase 4 changed native config, so Expo Go is not
   representative). Nothing has been checked on a device yet.
2. **Fix round**, from the user's findings plus the known items below.

Known issues to bring up (reported by the user or found without a device):
- **Splash wordmark doesn't show** (reported 2026-11-04, seen in Expo Go): "naib", the shell and "li" never appear
  and don't animate; "FORECAST FOR FUN" does. Likely cause: `src/ui/Splash.tsx` renders the animated parts only
  after measuring an invisible copy of the wordmark (`onLayout` of the inline shell view inside the Text, plus the
  Text width). If the inline view's `onLayout` never fires (Expo Go / platform), nothing renders. Fix idea: render
  the parts with a computed fallback position (Bricolage baseline ≈ 0.83 em at line-height 1) and only refine
  from measurement, or animate the static `Wordmark` as a whole plus the shell. Re-check in the EAS build first.
- Device checks (see "Open items" below): big text with line-height < 1 (92 px / .84 verdict and temperature,
  40 px / .98 headline) clipping on Android; wordmark shell on the baseline (menu); `BalancedText` on iOS;
  sheet drag vs scroll; keyboard lift on Android; coarse-only location on Android; glass blur positions.

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

## Phase 5 — what was done
- Scene: `npm run scene:compare` (fixed Chrome detection on macOS; diff step now Node/pngjs instead of Python Pillow).
  All 11 scenarios match the prototype's `paint()` to anti-aliasing: < 0.15 % of pixels differ by > 8/255
  (only visible difference: the sign's text rasterisation).
- UI: element-by-element audit of HUD, panel, scrubber, bubble, splash, menu and all sheets against the markup.
  Fixed: HUD texts let taps through to the scene and the chip row (gaps included) catches them, like
  `pointer-events`; long island names truncate instead of clipping the chevron; wordmark shell sits on the
  baseline (no −.035em shift — the markup row is `align-items: baseline`); UV value/word gap 6; tide line caps
  and sun dot no longer clipped (react-native-svg ignores `overflow: visible`); `text-wrap: balance` on iOS
  (`src/ui/BalancedText.tsx`; Android uses its native balanced strategy).

## Differences from the prototype that can't be (or weren't) matched
- Bricolage is variable on the web (opsz = font size); native uses static instances per size bucket
  (`src/ui/fonts.ts`). The tide hero "m" is 700 instead of 600 (no 600 instance).
- Material Symbols: the web font adjusts optical size per icon size (20–48); the bundled SVG paths are one
  optical size, so strokes at 14–18 px and 38 px differ very slightly.
- `text-wrap: balance` on iOS is an approximation (average line width, one retry); `text-wrap: pretty` has no
  equivalent (the HUD sub uses iOS `standard` line breaking).
- Backdrop blur is drawn by Skia from the scene only: where the bubble overlaps HUD text, that text shows sharp
  through the bubble's 5 % transparency instead of blurred.
- Search placeholder colour: browser default → `#757575`. Hover styles don't apply on touch.
- MSRO badge: bundled copy of the SVG; its text uses the system font, as in the original.
- Copy/spec conflicts resolved toward the markup: wordmark is "naib" + shell + "li" (README says "oli"); status
  bar text is dark during the splash (README says "light content", invisible on #FBF6EC).
- Added platform conventions not in the prototype: pressed states dim, drag a sheet down to close, keyboard lifts
  the picker, Android back closes sheet then bubble.

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

## Commands
```bash
npx expo start                 # then open in Expo Go (everything used is in Expo Go)
npm test                       # unit + parity tests
npx tsc --noEmit && npx expo lint
npm run scene:compare -- /tmp/scene   # native vs prototype pixel diff (needs Google Chrome)
```

## Gotchas learned
- Worklet functions aren't hoisted after the worklets Babel plugin runs: define a worklet's callees above it
  (crashed on device once — see note at top of `src/scene/paint.ts`).
- Skia `<Canvas onLayout>` isn't supported on the new architecture — measure a wrapping `View`.
- Android edge-to-edge: `useWindowDimensions()` excludes the nav bar; size the scene from layout.
- React Compiler lint rejects `sv.value = …` on shared values from props/context — use `.set()` / `.get()`.
- In the CanvasKit Jest harness, colour arrays must come from CanvasKit's realm (`scripts/scene-compare/ckRealm.ts`).
- EAS Android build (2026-11-05): the Gradle daemon was killed (out of memory) while compiling C++ for 4 ABIs on the
  4 vCPU / 15.6 GB worker. The `development` profile in `eas.json` now builds arm64-v8a only
  (`ORG_GRADLE_PROJECT_reactNativeArchitectures`). That alone still ran out of memory (parallel CMake builds of
  Reanimated / Worklets / Skia / expo-modules-core), so `plugins/withEasGradleLimits.js` sets
  `org.gradle.workers.max=2` and a 2 GB Kotlin daemon heap, on EAS builds only (`EAS_BUILD=true`). If it still fails:
  `resourceClass: "large"` in `eas.json` (paid plans) or limit ninja jobs per CMake build.
- `git push` from the agent sandbox may fail with "Permission denied (publickey)"; it works outside the sandbox.
