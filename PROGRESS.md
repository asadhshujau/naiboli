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
| — | EAS build test by the user, then the fix round | ✅ round 1 done; round 2 built, dev build ready for device checks |

## Pending — start here when asked "what's pending?"

### Where we are (2026-11-06)
- All 5 phases + fix round 1 done; Android dev build tested on device 2026-11-05: all good.
- Round 2 is built (list under "Done in round 2" below), all JS-tested (332 tests, typecheck, lint, expo-doctor),
  **not yet checked on a device**.
- **The round 2 dev build failed on EAS twice** (2026-11-05, builds `b48c8a59`, `80850bda`): Gradle killed for
  out of memory while Worklets and Skia compiled C++ side by side (see Gotchas). Fixed 2026-11-06:
  `plugins/withEasGradleLimits.js` now runs Gradle with 1 worker on EAS. The native batch (iOS export compliance,
  `web` block removed) rides along with this build. **Dev build `035a8d18` succeeded** (2026-11-06, 13 min with
  1 worker): APK https://expo.dev/artifacts/eas/gyYhpLHz1ez11QqTodl0acZ-3siKAPNgDOkyrkWQ8fI.apk
- Command: `npx eas-cli@latest build --profile development --platform android` (package `dev.shujau.naiboli`,
  EAS-managed keystore, channel `development`). Runtime fingerprint now: `c2fe716a839dbcbdecee5fd6924703013117148e`
  (check with `npx expo-updates runtimeversion:resolve --platform android`; if it differs from the build's, OTA
  updates won't reach that build).

### Next steps, in order
1. **Install the dev build `035a8d18` and run the device checks.** Uninstall the old `com.anonymous.naiboli` app,
   install the APK above, `npx expo start`, go through "Device checks" below; the user's findings become the fix
   list. **When resuming, ask the user** whether it's installed and what they found.
   - A future dev build that fails → logs: `npx eas-cli@latest build:list --platform android --limit 1 --json` →
     `logFiles[0]` (signed URL, 15 min; brotli-compressed JSON lines, `msg` per line). See Gotchas.
2. **Store prep drafts** (offered by Claude, waiting for the user's go; no code): Play listing (short / long
   description), Data safety + content rating answers, privacy policy text for
   `https://naiboli.shujau.dev/privacy-policy` (must be live before release).
3. **Next native batch** — do all together right before a build, never alone (app.json and native libraries
   are in the runtime fingerprint; changing them cuts OTA updates off from the installed build):
   - ✅ iOS export compliance: `ios.config.usesNonExemptEncryption: false` in `app.json` (2026-11-06).
   - ✅ `web` block and `extra.router.asyncRoutes` removed from `app.json` (2026-11-06). Left for the user to decide:
     `react-native-web` / `react-dom` deps, the `web` npm script and `favicon.png` (from `gen-app-icons.mjs`).
   - Crash reporting (Sentry, `@sentry/react-native`) — if wanted; before real users / the closed test. Not in the
     build being resubmitted (more native C++ = more build memory).

### Still open (optional, JS only — say which to do)
- **Messages from the API:** API sends a `category` + optional message override; the app keeps its pools as the
  fallback. Needs API work first.
- Release checklist below (accounts, listings, iOS build, release-build performance).
- Not wanted (user, 2026-11-05): Dhivehi copy.

### Device checks (next dev build)
- New package name: installs as a separate app — uninstall the old `com.anonymous.naiboli` build first.
- Splash wordmark shows (fixed in JS after the last device test).
- Sheets open without delay / glitch (scene pauses behind sheets, separate animated styles, stale-height fix).
- Day theme: scrub to dusk / night and open every sheet and bubble; morning / late-afternoon warmth; overcast day.
- Launcher icon and themed icon (Android 13+); name under the icon reads "Naiboli".
- Menu: no "Activity scores" row; Privacy Policy opens `https://moodhu.dev/privacy-policy` (dev build).
- Activity sheets: no "Activity scores from moodhu.dev" line once scores load.
- Island picker: pick a few islands, reopen the picker (current + recents + popular), kill and relaunch.
- Data refresh: airplane mode on → launch → offline line; off → data arrives within seconds (reconnect); tap
  the line → reloads at once; background / foreground while offline → no errors.
- Immersive mode: expand button on the panel → thin bar; scrub in the bar (no stutter), "All" opens the list,
  back-to-now shows when scrubbed ahead, collapse button brings the panel back; blur fades with it; kill and relaunch
  keeps the mode; bubbles near the bottom don't sit under the bar.
- Tap the time line above the headline → "· Updating" briefly, then fresh data; it doesn't steal sky taps much.
- Tide sheet: "Towel room" / "Extra sand" fit the Beach stat column (26 pt) or wrap nicely.
- Messages: headline length on a small phone (longest ~36 chars); a storm / alert day shows calm "stay ashore"
  lines; About the island chips and surf / snorkel tags; the headline changes hour to hour without repeating.

### Done in round 2 (2026-11-05) — details
- ✅ App identity: package / bundle ID `dev.shujau.naiboli`, display name "Naiboli".
- ✅ Island picker: current island + recents + popular padding (see "History of the fix round").
- ✅ Varied, friendly-silly messages with safety-first rules; copy approved by the user; no repeats (below).
- ✅ Data refresh: backoff retries, tap-to-retry offline line, retry on foreground (see "History").
- ✅ Tide sheet "Beach" stat reworded: "Cosy" / "Extra sand" / "Towel room" (`beachStat`), never Narrow / Wide / Average.
- ✅ Production API: `https://naiboli.shujau.dev/api` (user; may change → `eas.json`).
- ✅ **Environment config for the API** (2026-11-05). `EXPO_PUBLIC_API_URL` (inlined by Metro at bundle time):
   `.env` for `expo start`, `build.<profile>.env` in `eas.json` for builds — development + preview
   `https://moodhu.dev/api`, production `https://naiboli.shujau.dev/api` (user, may change). `src/data/api.ts`:
   `API = apiBaseOf(env)` (trailing slash dropped, falls back to `DEFAULT_API` = moodhu.dev when unset / not a URL).
   - Activity-score source is never shown: no "Activity scores from moodhu.dev" line (the "our own estimate" notice
     still shows while scores are loading / failed — it doesn't name a source), no Menu row.
   - Privacy Policy = `PRIVACY_URL` = `<origin of API>/privacy-policy`.
   - **OTA updates bundle with the env of the machine running `eas update`**: use the `update:*` scripts (OTA entry below)
     so an update never points a production build at the wrong API.
   - Preview builds use moodhu.dev until the production API is live; switch in `eas.json` when it is.
- ✅ **Immersive mode** (2026-11-05, design agreed with the user). An "expand" button (`open_in_full`) on the
   bottom panel's header hides the panel; a thin glass bar takes its place (`src/ui/hud/MiniBar.tsx`): compact
   scrubber (no axis labels), back to now (when scrubbed ahead), all activities (`format_list_bulleted`), and
   `close_fullscreen` to bring the panel back. Top HUD stays. Crossfade 250 ms on `alphas.immersive` (0 → 1), which
   also fades the glass blur (`GlassAlpha` `panel` / `mini`); the hidden one lets touches through. Remembered in
   AsyncStorage `naiboli.immersive.v1`, read before the first render (`launchPrefs`) so it doesn't flash. Bubbles may
   go lower in immersive mode (bottom limit = bar height + 30 instead of 210). JS only.
- ✅ **🔧 native · OTA updates** (2026-11-05): `expo-updates` ~58.0.21; `updates.url` = EAS Update for the project,
   `runtimeVersion.policy: "fingerprint"`, channels `development` / `preview` / `production` (= profile names) in
   `eas.json`. Default behaviour: release builds check on launch, download in the background, apply on the next
   cold start. **Publish with `npm run update:preview -- "message"` / `npm run update:production -- "message"`**
   (`scripts/eas-update.mjs`: takes `EXPO_PUBLIC_*` + channel from `eas.json` → `build.<profile>`, runs
   `npx eas-cli@latest update --channel … --environment …`; needs `eas login`). Dev builds load JS from Metro;
   an update can be opened there from the dev menu's Extensions tab. `fingerprint.config.js` skips package.json
   scripts and .gitignore on top of Expo's defaults (see Gotchas). **Rule from now on: a native change (new native
   library, app.json native config, plugin, icon / splash asset) = new build; JS-only changes can go out as an update.**
- ✅ **🔧 native · Refetch on network reconnect** (2026-11-05): `@react-native-community/netinfo` 12.0.1;
   `onReconnect` (`src/state/network.ts`, offline → online transitions only) → `dataStore.retryNow()` in
   `_layout.tsx`. Native module: works from the next build (Expo Go also has it).
- ✅ **Messages: no repeats** (2026-11-05): each copy category remembers its last line and the island / date / hour
   it was for (`CopyMemory`, AsyncStorage `naiboli.copyMemory.v1`, saved 1 s after a change); the same moment keeps
   its line, the next moment never repeats it.
- ✅ **Tap the time line to refresh** (2026-11-05): the HUD eyebrow ("Today · Wed 5 · 2:00 PM", now only) is a
   button: `dataStore.refresh()` refetches weather + scores unless fetched < 30 s ago (`REFRESH_MIN_MS`), retries
   failures, and shows "· Updating" until done (`DataState.refreshing`); data stays on screen. Scrubbed ahead, the
   line lets taps through to the scene as before.
- ✅ Template leftovers removed (`scripts/reset-project.js`, template images, `tabIcons/`); README rewritten.

### Before a production release (Google Play + App Store)
App identity and config
- [x] **Android package name**: `dev.shujau.naiboli` (user, 2026-11-05; reverse of the owned domain `shujau.dev`).
      Can never change after the first Play upload. The installed dev build is still `com.anonymous.naiboli`: the
      next dev build installs as a separate app (uninstall the old one), and EAS makes a new Android keystore for
      the new package. A local `android/` folder (ignored) needs `npx expo prebuild --clean`.
- [x] **iOS bundle identifier**: `dev.shujau.naiboli` (same rule for App Store Connect).
- [x] **Display name**: "Naiboli".
- [ ] **Version policy**: `version` 1.0.0 is the user-facing version; build numbers are remote + auto-increment
      (`eas.json` production). Bump `version` per release.
- [x] **iOS export compliance**: `usesNonExemptEncryption: false` (2026-11-06).
- [x] Template leftovers: files and `web` block removed (web deps kept, see Pending).
- [x] API URL via environment config (round 2). Before release: production API + `/privacy-policy` live.

Builds
- [ ] **iOS has never been built or tested.** Needs an Apple Developer account, then a dev/preview build. Unchecked
      on iOS: `BalancedText`, wordmark baseline, keyboard lift, location prompt, glass blur, performance.
- [ ] **Release-build performance**: test a `preview` build (release JS, no dev tools) on a mid-range Android phone.
      Scene frame rate is still unmeasured on real hardware outside dev mode.
- [ ] **Production Android build** builds all four ABIs (only `development` is arm64-only). The Gradle limits plugin
      applies, but watch for the out-of-memory failure; options if it happens: `resourceClass: "large"` (paid), or
      `reactNativeArchitectures` = `armeabi-v7a,arm64-v8a` (phones only, no x86).
- [ ] Production profile builds an AAB (Play) / store IPA by default; signing keys are EAS-managed.
      Keep the Play upload key backed up in EAS credentials.

Google Play
- [ ] Google Play developer account. **Personal accounts created after Nov 2023 must run a closed test with at least
      12 testers for 14 days before they can publish to production.** Start that early.
- [ ] Create the app in Play Console; the **first AAB is uploaded by hand**, after that `eas submit` with a Google
      service-account key.
- [ ] Store listing: short/long description, 512² icon (from `scripts/gen-app-icons.mjs`), 1024×500 feature graphic,
      phone screenshots (day, dusk and night look great here), category (Weather), contact email, privacy policy URL.
- [ ] **Data safety form**: location (approximate and precise) is sent to the API's `/where-am-i` to find the island,
      used for app functionality only, not shared or used for ads; no account, no analytics. Confirm what the
      server logs/stores before filling it in.
- [ ] Content rating questionnaire, target audience (not for children), ads: none.
- [ ] Privacy policy URL that works: `<API origin>/privacy-policy` (in the app since round 2); the store listings need the
      production one, `https://naiboli.shujau.dev/privacy-policy`, to be live.

App Store
- [ ] Apple Developer Program membership; App Store Connect app record (bundle ID, SKU); `ascAppId` for `eas submit`.
- [ ] Screenshots for the required iPhone sizes, description, keywords, support URL, privacy policy URL, category.
- [ ] **App Privacy ("nutrition label")**: Location (precise + coarse) → App Functionality, not linked to identity,
      not used for tracking. Same server-side check as Play.
- [ ] Privacy manifest: Expo modules ship their own; confirm the build's `PrivacyInfo.xcprivacy` covers AsyncStorage
      (UserDefaults) and file timestamps, add `ios.privacyManifests` if the build warns.
- [ ] Location permission string is set (When-In-Use only). Review guideline 5.1.1: location is only requested from
      the two buttons, never on launch (already the behaviour).
- [ ] TestFlight round before review.

Nice to have (not required)
- [x] OTA updates (round 2).
- [ ] Crash reporting — Pending → "Next native batch".
- [ ] Attribution check: OpenWeather (logo + link in the Weather sheet), MSRO badge (Tide), font licences (OFL).

### History of the fix round

**Varied messages (2026-11-05, planned feature 4):** `src/data/copy/` — pools in `weather.ts` / `activities.ts`,
builders in `index.ts`, hash pick + `{slot}` filling in `pick.ts`. App side, no API, works offline.
- Current-weather headline (live moods only; sample moods keep the canned line): pool per mood key, plus hot
  (feels ≥ 36°), breezy (≥ 20 km/h), morning (5–10) and island lines. Storm → `STORM`, any forecast alert → `WARN`:
  calm, every line says "stay ashore". Scrubbed hour: pool per verdict word; thunder or gusts ≥ 50 km/h at that
  hour → `HOUR_DANGER` (calm, "stay ashore"). `View.copyKey` / `View.danger`.
- Activity detail: only the leading verdict sentence varies (`ActDetail.lead`); the reason / "Sunrise is at" part is
  untouched. Go / ideal draw from generic + per-activity lines; maybe from generic + per-factor; skip for harmless
  reasons (UV, heat, tide, rain) can be playful; skip for wind / haze / darkness, or any thunder / strong gusts at
  that hour, uses calm pools (`SKIP_SAFE`, `CAUTION`). Safety tips, `warningOf` text and sub-lines unchanged.
- Pick = hash(category, island id, local date, hour): stable while you look, varies by hour, day, island.
- About the island: beach chip is a tide fact ("Tide’s in · cosy beach" / "Tide’s out · bonus beach" / "Mid tide ·
  towel room"); surf / snorkel tags describe right now ("Surf’s on now", "OK to snorkel", "Surf later",
  "Snorkel after sunrise"), with "later" tags in a neutral sand colour instead of verdict red.
- Tests: `src/data/__tests__/copy.test.ts` (pool sizes, slots, length ≤ 36, uniqueness, determinism, variety,
  calm pools free of jokes / "!" / "?", "ashore" in every storm / alert line, routing of danger cases) and view
  checks in the sheets parity test; parity tests compare the factual part of `line` with the prototype.
**Check on device:** headline length on small phones (longest lines ~36 chars), storm / alert days.

**Data refresh (2026-11-05, planned feature 5):** a failed *first* load of weather, tide or the island list used to
stay failed until island change / midnight / restart. Now (`src/state/store.ts`):
- The 60 s clock retries them for the current island with a backoff: 1, 2, 4, 8 min after each failure, then every
  10 min (`RETRY_MS`). Only fetch failures retry; a tide payload too short to use (no feed) doesn't. A failed refresh
  with data on screen behaves as before (stale data keeps refreshing, last good data stays).
- `retryNow()` retries everything failed (weather, tide, scores, island details, list) at once: from the HUD sub
  line when it shows the offline message ("… Tap to try again.", `View.retry`, dims while pressed; otherwise the
  line still lets taps through to the scene), and on every return to the foreground.
- No pull-to-refresh: the main screen doesn't scroll and a pull would fight the scene taps and the scrubber.
- Tests: store tests for the backoff sequence, recovery, `retryNow`, no-feed tide.
**Check on device:** airplane mode on → launch → offline line; airplane mode off → data arrives by itself within
a minute or two; tap the line → reloads at once; background/foreground while offline → no errors.

**Island picker recents (2026-11-05, planned feature 2):** empty search lists the current island (highlighted,
`my_location`), then up to 5 recently loaded islands (most recent first, current left out), padded at the end with
popular islands (`POP`) not already listed — always 6 rows. `defaultIslands` / `pickerIslands` / `addRecent` in
`src/data/islands.ts`; recents kept in `DataState.recents` and AsyncStorage `naiboli.recents.v1` (full island
objects, current included, cap 6), updated by `pickIsland` (manual and location picks); the saved island counts as
recent at launch. The weather prefetch uses the same list. Tests: `src/data/__tests__/recents.test.ts`, store and
picker tests. **Check on device:** pick a few islands, reopen the picker, kill + relaunch the app.

**Android dev build tested 2026-11-05** (user's findings):
- OK on device: no big-text clipping, menu wordmark baseline, sheet drag to close, keyboard lift in the picker,
  glass blur positions, scene/scrubber performance acceptable, nothing else off vs the prototype.
- **Splash wordmark didn't show** (also in Expo Go). Cause: the animated parts waited for `onLayout` of the inline
  shell view inside the Text, which never fires on Android. Fixed (JS): the shell now animates in place inside the
  real (transparent-letter) wordmark layout; "naib" / "li" copies are pinned to its left / right edges, no
  measuring. **Re-check on device.**
- **Precise location wanted** (user decision): `ACCESS_FINE_LOCATION` is no longer blocked; request stays
  Balanced accuracy. **Native change: needs a new dev build** to take effect.
- **Sheets open with a noticeable delay / glitchy slide.** Fixes kept (JS):
  1. `SceneCanvas` takes `paused` (= a sheet is open) and skips painting once the bubble/hint glass fades are still
     — the scene repainted every frame (tick + Skia recording + blur) on the UI thread the sheet's slide, scroll and
     mount also need. The last frame stays behind the scrim; painting resumes as soon as the sheet starts closing.
  2. `Sheet` keeps the keyboard lift (`bottom`, `maxHeight`) and the slide transform in separate animated styles.
  3. "Opened twice" after another sheet had closed: the closed position was 105 % of the *measured* height, which
     drops to the grabber (~60 dp) when the content unmounts (`sheetGone`), so the next sheet showed almost open
     at that stale offset, jumped off-screen when its height arrived, then slid in. Now 105 % of the max sheet height.
  Tried and reverted: deferring Weather's below-the-fold content until after the slide (`Later`). With 1–3 in place
  the full mount is fast enough (sun bubble → Weather, which mounted everything, felt right), and the deferred
  pop-in made the temp pill → Weather path feel slow. **Re-check on device**; if it ever needs more, icons as a
  font instead of one SVG view each is the next idea.

**New feature (user request 2026-11-05): "the day is the theme"** — sheets and bubbles follow the scene's light
at the selected hour (`src/ui/dayTheme.ts`; provided in `src/app/index.tsx` from `lightOf(hSel, gloom, sun)`).
- Light/dark switches exactly with the bottom panel (`lightPanel`). Light = the prototype's cream at clear midday,
  warming toward peach as the sun gets low (from elevation .5) and cooling toward grey under cloud. Dark = surfaces
  on the sky's hue at fixed lightness (dusk plum, night navy, storm slate).
- Builder colours (verdict chips, tags, hourly cells, hero tints) are light-design hexes; `t.bg()` / `t.fg()` map
  them (identity in light; token lookups, then hue-preserving muted grounds / lightened inks in dark).
  OpenWeather logo gets a light pill in dark mode; MSRO badge is already a dark badge.
- Tests: `src/ui/__tests__/dayTheme.test.ts` — clear midday = prototype tokens, switch matches the panel, cache,
  WCAG contrast (ink ≥ 7, secondary ≥ 4.5, chips ≥ 4.5) at every half hour × 6 gloom levels.
- Performance pass: styles are built once per theme look (`themed()` cache by quantised key, ≤ ~30 looks);
  all inline `T.*()` text styles in sheets/bubble hoisted into those cached sheets; data colours use cached style
  objects (`t.fgS()` / `t.bgS()`), so re-renders (typing in the picker, data updates) allocate no new style
  objects and Fabric sees unchanged props. Theme objects are cached, so the context only changes when the look does.
- **Check on device:** scrub to dusk / night and open each sheet and bubble; morning / late-afternoon warmth;
  overcast day.

**App icon (2026-11-05):** the shell mark on the brand cream, generated by `node scripts/gen-app-icons.mjs`
(icon.png 1024² without alpha; Android adaptive foreground inside the safe zone + cream `backgroundColor` +
white monochrome for themed icons; favicon). Template Icon Composer bundle removed (`ios.icon` falls back to
`icon`). Native change: shows from the next build. **Check on device:** launcher icon, themed icon (Android 13+).

Still unchecked: iOS (no build yet — `BalancedText`, wordmark baseline, keyboard), performance in a release build.

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
  `android.blockedPermissions: ACCESS_FINE_LOCATION` (coarse only — reverted in the fix round: precise allowed), splash colour.

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
- Sheet slide distance is 105 % of the max sheet height, not of the sheet's own height (avoids a stale-height
  flash; identical for tall sheets, short sheets start lower).
- Varied copy (user request): headlines, scrubbed-hour headline and the activity verdict sentence are picked from
  pools (`src/data/copy/`); the island sheet's beach chip and surf / snorkel tags are reworded. The prototype's
  lines are the first line of each pool.
- The activity-score source ("Activity scores from moodhu.dev, updated …") and the Menu row for it are removed
  (user decision); the "our own estimate" notice remains while scores are missing.
- Island picker with an empty search: current island + recents + popular padding instead of the fixed popular six
  (user request; identical to the prototype on first run at Malé).
- Added platform conventions not in the prototype: pressed states dim, drag a sheet down to close, keyboard lifts
  the picker, Android back closes sheet then bubble.

## Open items carried forward
- **Performance is unverified on a real device.** CPU-only emulator: ~7 fps (not representative; blur isn't the
  cost). Pure JS per frame ≈ 4.6 ms on desktop V8 (`SCENE_PERF=1 npx jest -c scripts/scene-compare/jest.config.js perf`);
  Hermes will be slower. Check on a phone in Expo Go; if it stutters: cache static layers as pictures, reuse paints.
- Headline `text-wrap: balance` has no RN equivalent (uses platform "balanced" strategies).
- Native splash is still the template's (Phase 4 sets `#FBF6EC`).
- Status bar during the splash is dark text (prototype `dark={false}`), although the README says "light content".
- Phase 4 needs a development build (native config changed: location permission strings, splash). Fine location is
  allowed since the fix round (was coarse-only).
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
  `org.gradle.workers.max=2` and a 2 GB Kotlin daemon heap, on EAS builds only (`EAS_BUILD=true`). That passed once,
  then failed twice after expo-updates + netinfo were added (dying at `:app:configureCMakeDebug` while
  `:shopify_react-native-skia:buildCMakeDebug` and Worklets ran). EAS also sets a 4 GB Gradle heap via `GRADLE_OPTS`.
  2026-11-06: `org.gradle.workers.max=1` — dev build passed (13 min). If it fails again (e.g. production, 4 ABIs): `kotlin.compiler.execution.strategy=in-process`
  (drops the separate 2 GB Kotlin daemon), `resourceClass: "large"` in `eas.json` (paid plans), or limit ninja jobs
  per CMake build (`-DCMAKE_JOB_POOLS`).
- Runtime fingerprint (OTA): anything in it changing = new runtime version = updates published afterwards don't
  reach builds made before. Check with `npx expo-updates runtimeversion:resolve --platform android --debug`
  (lists the sources). The local, gitignored `android/` folder doesn't affect it (tested 2026-11-05). Default
  sources include package.json scripts and .gitignore, so `fingerprint.config.js` skips those (keep the default
  skips when editing it: a custom `sourceSkips` replaces them).
- `git push` from the agent sandbox may fail with "Permission denied (publickey)"; it works outside the sandbox.
