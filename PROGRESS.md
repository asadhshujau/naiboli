# Naiboli — implementation progress

Porting `design_handoff_naiboli/` (HTML prototype) to native Expo SDK 58. Brief: `design_handoff_naiboli/PROMPT.md`,
spec: `design_handoff_naiboli/README.md`. Work is in 5 phases with a review stop after each.

| Phase | Scope | Status |
|---|---|---|
| 1 | Data layer, types, tests | ✅ done (`92ea374`) |
| 2 | Scene canvas, scrubber, bottom panel, top HUD | ✅ done (this commit) |
| 3 | Info bubbles and all bottom sheets | ⏭ **resume here** |
| 4 | Location / first-run flow, persistence, splash | — |
| 5 | Polish: side-by-side with the prototype, list of unmatched differences | — |

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

## Phase 3 — what to build next
1. Extend `src/state/view.ts` with the rest of `renderVals()`: bubble content (`B` object), `groups` (All
   activities), `d` (activity detail), `islandList` + `geoRow` + `wel` (picker/welcome), `wx` (weather sheet), `td`
   (tide sheet), `isle` (`isleView`). The prototype script is lines ~1300–1480 of the HTML.
2. `Bubble` (README §3): 268 wide, positioned from the tap (`bub` maths), open/close animation, glass blur 14 —
   add a `'bubble'` alpha + scale to `src/scene/glass.tsx`. Same object tapped again closes it.
3. Sheet shell (README §4): scrim, translateY 105%→0 over 450 ms `bezier(.2,.85,.25,1)`, max 86 %, grabber,
   header, focus-ring scrolling for the weather sheet.
4. Sheets: All activities, Activity detail, Weather, Tide, About the island, Island picker (search + prefetch
   weather 250 ms after typing), Menu. Welcome sheet UI too (its flow is Phase 4).
5. Wire the stubs in `src/app/index.tsx`.
6. Icons: if a sheet needs a name that isn't generated, add it to `scripts/gen-icons.mjs` and run `npm run gen:icons`.

## Open items carried forward
- **Performance is unverified on a real device.** CPU-only emulator: ~7 fps (not representative; blur isn't the
  cost). Pure JS per frame ≈ 4.6 ms on desktop V8 (`SCENE_PERF=1 npx jest -c scripts/scene-compare/jest.config.js perf`);
  Hermes will be slower. Check on a phone in Expo Go; if it stutters: cache static layers as pictures, reuse paints.
- Headline `text-wrap: balance` has no RN equivalent (uses platform "balanced" strategies).
- Native splash is still the template's (Phase 4 sets `#FBF6EC`).

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
