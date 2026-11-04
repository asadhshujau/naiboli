# Handoff: Naiboli — live island scene (React Native)

## Overview
Naiboli is a "forecast for fun" app for the Maldives. One full-screen animated scene (sky, sun, moon, clouds, rain, lightning, sea, tide, palms, dhoni, wooden island sign) is driven by **real data** for the selected island (1,132 islands). A bottom panel shows the top 3 activities right now and a 24-hour scrubber that moves the whole scene through time. Tapping objects in the scene opens info bubbles; bottom sheets show activities, weather, tide, island details, island picker, a first-run location sheet and a menu.

## About the design files
`design/Naiboli Scene Live.dc.html` is a **design reference built in HTML** — a working prototype that shows the intended look, data use and behaviour. It is **not production code to copy**. Recreate it in the target React Native app using that codebase's existing patterns (navigation, state, data fetching, styling). Where the codebase has no established choice, use the libraries suggested in "Recommended RN stack".

To view it: open `design/Naiboli Scene Live.dc.html` in Chrome/Safari (keep `support.js`, `ios-frame.jsx` and `assets/` next to it; it calls the live API). The markup (top of file) is the visual spec; the `<script data-dc-script>` block is the logic spec. Function and constant names below refer to that script.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii, copy, animation timings and data logic are final. Recreate pixel-for-pixel in dp at a 402 × 874 reference frame. Convention-level only (follow the platform / codebase): status bar, safe areas, sheet gesture physics, haptics, keyboard handling, permission dialogs, accessibility labels.

---

## Recommended RN stack (use existing equivalents if the codebase already has them)
- Scene canvas: `@shopify/react-native-skia` (port `paint()` and `palm()` / `cloud()` 1:1 — they are plain Canvas2D calls: gradients, arcs, ellipses, bezier/quadratic paths, dashed strokes, globalAlpha, clip).
- Animation loop + gestures: `react-native-reanimated` (frame callback / `useFrameCallback`) and `react-native-gesture-handler` (scrubber pan, scene tap).
- Blur: `expo-blur` `BlurView` (chips 12, bottom panel 20 + saturate, bubble 14, tap hint 10).
- Sheets: `@gorhom/bottom-sheet` or a custom Reanimated sheet matching the spec below.
- Location: `expo-location` (or `react-native-permissions` + `@react-native-community/geolocation`).
- Storage: `@react-native-async-storage/async-storage`.
- Fonts: `expo-font` — Bricolage Grotesque (700, 800), Figtree (500, 600, 700, 800), DM Mono (500), Noto Sans Thaana (400, 600). Bricolage is variable in the web version (opsz 12–96, wdth 75–100); use static instances at default width.
- Icons: Material Symbols **Rounded**. Many icons use `FILL 1`, the rest `FILL 0` (see markup: `font-variation-settings:'FILL' 1`). RN can't set font variation axes reliably — use `@material-symbols/svg-400` (rounded + `-fill` variants) via `react-native-svg`, or two static icon fonts.
- SVG: `react-native-svg` (logo shell, sun arc, moon phase, tide chart).

---

## Data contracts (base `https://moodhu.dev/api`)
All times are Maldives local (UTC+5). The prototype uses an hour axis `h` = hours since local midnight **today** (`DAY0`, `hOfUnix`). Timeout 20 s per request.

1. `GET /islands` → array. Fields used: `id, english_name, dhivehi_name, atoll_code_english, atoll_name_english, category, weather_anchor_id, latitude_decimal, longitude_decimal`. Drop entries without `english_name`. Search ranking: `matches()`.
2. `GET /islands/{id}` → `description, beaches[{name,type}], reefs[{name,type,distance}], accessibilities[{method}], dhivehi_name, latitude_decimal, longitude_decimal`.
3. `GET /weather-for-island/{id}` → `{ data: { current, hourly[], daily[] }, observed_at | updated_at }` (OpenWeather One Call shape). Used: `temp, feels_like, humidity, clouds, visibility (m), wind_speed (m/s → ×3.6 km/h), wind_gust, wind_deg, uvi, pop (0–1), weather[0].id, rain['1h']`; daily adds `sunrise, sunset, temp.min/max, moonrise, moonset, moon_phase`. **Cache by `weather_anchor_id`** (many islands share one). Parsing: `procWx()`; interpolation between hours: `sample()`.
4. `GET /tide-for-island/{id}` → `{ data: [{ time_utc_plus5, tide_m }] (per-minute, ≥120 rows), source_island_name, source_island_id, island_id, distance_km }`. Resampled to 10-min steps for 48 h; highs/lows found as local extrema: `procTide()`. Source line: `tideSrc()`.
5. `GET /islands/{id}/activity-scores` → `{ scores: [{ activity, label, overall_score, conditions_score, recommendation, breakdown{wind,rain,temp,uv,visibility,tide,daylight}, limiting_factors[], tide_available, hours[{dt, …same}], days[{date:'YYYY-MM-DD', …same}] }] }`. Parsing: `procActs()`. Activity id normalisation: `ACT_ALIAS`; unknown ids get `actIcon()` and a generic tip. When this route has loaded, **only its activities are shown**; before load / on error, fall back to the local formula `liveScore()` for the 14 built-in `ACTS` (developer may choose to replace the fallback with an error state).
6. `POST /where-am-i` body `{ latitude, longitude }` → `200 { resolved: true, island: {…island fields} }`. `422` or `resolved: false` = not near a known island.

Refresh: a 60 s clock re-renders; weather and activity scores refetch when older than 10 min; failed activity scores retry every minute; at local midnight everything resets and refetches. Keep last good data on refresh failure.

---

## Verdicts
Route `recommendation` → verdict key: `ideal→go (label "Ideal")`, `go→go`, `caution→maybe`, `avoid→skip`, `wait_for_daylight→wait`. Fallback from score: `≥7 go`, `≥5 maybe`, else `skip`.

| key | label | light bg | light ink | word | dark bg | dark ink | fill | detail hero bg | big word | line |
|---|---|---|---|---|---|---|---|---|---|---|
| go | Go | #D3F4E9 | #0B6B57 | #0E9F7E | rgba(23,184,144,.24) | #8BEDCE | #17B890 | #D9F5EC | Go. / Ideal. | Yes! Conditions line up nicely. |
| maybe | Maybe | #FFF0C2 | #7A5600 | #A87000 | rgba(255,200,61,.22) | #FFD772 | #FFC83D | #FFF1C6 | Maybe. | Doable. Go with a plan and a buddy. |
| skip | Skip | #FFE0D6 | #B23A1C | #E2522F | rgba(255,115,80,.22) | #FFA58E | #FF7350 | #FFE1D7 | Skip. | Not this time. Another hour will treat you better. |
| wait | Wait | #DDE3F6 | #3A4890 | #5866A8 | rgba(140,151,216,.26) | #C3CBF7 | #8C97D8 | #E2E7F8 | Wait. | Too dark for now. |

"dark" values are used on the bottom panel when it is in dark mode (see HUD tones).

---

## Screens / views (402 × 874 reference, dp)

### 1. Splash
Full-screen `#FBF6EC`, centred column, gap 16. Wordmark "naib" + shell logo + "oli" in Bricolage 800 72/1, ls −0.045em, `#0A3346` (shell = the 7-path SVG in the markup, 0.6em square). Tagline "FORECAST FOR FUN" DM Mono 500 11, ls .3em, `#4F6F79`.
Timeline: t=80 ms shell animates from rotate −150° scale .25 → 0°/1 over 1.1 s `cubic-bezier(.2,.9,.25,1.12)`; "naib" fades in + translateY 12→0 (.6 s / .7 s, delay .35 s); tagline fades in (.6 s, delay .7 s). At 2.6 s, wait until weather for the island has loaded **and** no location lookup is running (max 9 s), then fade splash out (opacity .55 s, scale 1→1.05 .6 s) and unmount after 650 ms. Tap skips. Status bar light content during splash.

### 2. Scene (home)
- **Canvas**: full screen, scene drawn in 402-wide artboard units. Scale = screenWidth / 402; artboard height = screenHeight / scale (sea fills any extra height). Constants: horizon `HZ=444`, island centre `ICX=196`, water line `WL=572`, island offset `DY=−40`. Port `paint()` exactly: sky gradient, stars, sun (glow, radius 30 + golden 8), moon with real phase, up to 9 drifting clouds, 3 birds (day, low gloom), sea gradient, far island, 6 wave layers, dhoni (only when sailing score ≥5 and gloom <.9), sun/moon glitter, island with bushes, 2 palms (wind-bent fronds), wooden sign with island name (Figtree 700 12, max 118 wide, ellipsis), lagoon glow, animated dashed shoreline, rain streaks, lightning bolts + flash, tap ripples. All palettes in `PAL`, object colours in `OBJ`, light model `lightOf()`, sun `sunState()`. Weather values (gloom, rain amount, wind, cloud count) ease toward targets (rate 1.6/s); the displayed hour eases toward the selected hour (rate 7/s); tide level eases at 2/s.
- **Scene taps** (`onSceneClick` hit order): dhoni → sign → palms → sun → moon → island → clouds → sea (below horizon) → sky/rain. Tapping the same object again closes the bubble. Each tap adds a white ripple ring (0.7 s).
- **Top HUD** (padding top = safe-area top + 4; design value 58 incl. status bar; sides 20): row gap 10 — menu button 44 circle (shell logo 22), island chip (h 44, r 22, pad 0 12 0 10, gap 6, `location_on` filled 20 + "K. Malé" Figtree 600 15 + `expand_more` 20) → opens island picker; spacer; temperature chip (h 44, r 22, pad 0 14 0 10, weather icon 22 filled + "30°" Bricolage 700 22 ls −0.02em) → temp bubble. Then eyebrow (mt 22, DM Mono 500 11.5 ls .09em uppercase, e.g. "TODAY · WED 4 NOV · 1:15 PM"), headline (mt 8, Bricolage 800 40/.98 ls −0.04em, balance wrap), sub (mt 8, Figtree 500 16/1.35, max-width 300). Optional warning chip (mt 12, h 36, r 18, `#FF7350`, ink `#2A0C03`, `warning` 19 + Figtree 700 13.5) → warning bubble.
- **HUD tones** (recomputed for the selected hour): `darkSky` = sky luminance < .42 → ink #FFFFFF, sub rgba(255,255,255,.9), chip rgba(255,255,255,.16), text-shadow 0 1 14 rgba(0,0,0,.22); else ink #05314A, sub #0B4560, chip rgba(255,255,255,.58). `lightPanel` = daylight D > .5 and gloom < .5 → panel rgba(255,255,255,.8), ink #0A3346, sub #4F6F79, buttons rgba(10,51,70,.07), cards #FFFFFF, edge rgba(255,255,255,.7); else panel rgba(6,22,36,.58), ink #FFFFFF, sub rgba(255,255,255,.75), buttons rgba(255,255,255,.12), cards rgba(255,255,255,.08), edge rgba(255,255,255,.1). Status bar follows `darkSky`.
- **Tap hint** (top 606, centred, until first interaction): "Tap anything: sun, palms, island, sea", DM Mono 500 11, white on rgba(3,32,48,.38) blur 10, pill, pad 6 12. Fades .5 s.
- **Bottom panel** (left/right 12, bottom 14 — use `max(14, safeBottom)`; r 30; pad 14 14 12; blur 20 saturate 150%; shadow 0 14 40 rgba(0,20,40,.25) + 1 px inner edge):
  - Header row (pad 0 4, gap 8): when-label ("TODAY · NOW" or "FORECAST · THU 5 NOV · 9:00 AM", DM Mono 500 10.5 ls .09em) over "Shall we go?" (Bricolage 800 21/1.1). Right: "Now" button (only when scrubbed later; h 34 r 17, `replay` 17) and "All 14 ›" button (h 34 r 17, Figtree 700 12.5) → All activities.
  - Top 3 grid (3 cols, gap 8, mt 12): card r 18 pad 10, column gap 8. Icon tile 30 r 10 in verdict bg/ink (icon 18 filled) + verdict word (Bricolage 800 17, verdict word colour) on one row; name Figtree 700 13/1.15 single line ellipsis. Tap → activity detail.
  - Scrubber (mt 14, pad 0 4): area h 38; 24 bars (gap 2, h 30 track, bar r 3) — height = 22 + bestScore × 7.8 %, colour = fill of that hour's best verdict, opacity 1 selected / .6 others. Thumb: 4 wide line + 14 circle in panel ink with 3 px ring in panel solid colour (#F4FAFA light / #0E2333 dark). Axis below (h 14, mt 6): "Now", +6h, +12h, +18h, +23h in DM Mono 500 10 (e.g. "7p"). Drag sets offset 0–23 continuously; on release snap to whole hour. Changing the hour updates the entire scene, HUD texts, top 3, bubbles and sheets.

### 3. Info bubble
Width 268, r 24, white .95 + blur 14, shadow 0 18 44 rgba(0,20,40,.3), pad 16. Positioned near the tap (`bub` in `renderVals`: below if tap y < 360, else above; clamped x 12…122, y ≥112). Animate opacity .18 s and scale .85→1 .28 s `cubic-bezier(.2,.9,.3,1.25)` from the tap point. Row: icon tile 36 r 12 + title (DM Mono 500 11 uppercase) + close 30 circle `#F1E9DA`. Big line (Bricolage 800 28/1.05, mt 12), 1–4 lines (Figtree 500 14/1.35 `#3F5F69`, gap 5), action button (mt 12, h 42 pill `#0A3346`, white Figtree 700 14 + `arrow_forward`). Content per object (sun, moon, sky, rain, wind/palm, island, sea, dhoni/sailing, temp, warning) — copy and actions in object `B` inside `renderVals()`.

### 4. Bottom sheets (shared shell)
Scrim rgba(3,24,36,.45) fade .35 s, tap closes. Sheet: bottom-anchored, max-height 86 %, bg `#FBF6EC`, top radius 32, shadow 0 −10 40 rgba(0,20,30,.2), slides translateY 105 %→0 over .45 s `cubic-bezier(.2,.85,.25,1)`. Grabber 40×5 r 3 rgba(10,51,70,.18), pad 10 0 4. Scroll content pad 8 20 40. Header: eyebrow (DM Mono 500 10.5 ls .09em uppercase `#4F6F79`) + title (Bricolage 800 26 ls −0.03em) + close button 40 circle `#F1E9DA` (`close` 22). Cards: white, r 24, pad 16, gap 12 between cards, shadow 0 1 2 rgba(10,51,70,.05). Row separators 1 px rgba(10,51,70,.07). Opening the weather sheet from a bubble scrolls to and rings the focused card (0 0 0 2.5 px #0A3346).

- **Welcome — "Where are you?"** (eyebrow "WELCOME TO NAIBOLI"): teal card (`#D3F1EE`, r 28, pad 20) with white 44 tile `near_me` + "Use your location to find the island you're on, or pick one yourself. You can change it any time." (Figtree 500 15/1.5). Optional error note (r 20, `#FFE0D6`, ink `#5A1F0E`, icon `#E2522F`). Buttons (gap 10, mt 16, h 56 r 28, Figtree 700 16): primary `#0A3346`/`#FBF6EC` "Use my location" (shows "Finding your island…" while locating); secondary `#F1E9DA` "Pick an island myself" (`search`) → island picker. Footer "Your location is only used to find the nearest island." (12.5, centred, `#4F6F79`).
- **Pick an island**: title only. Search field (mt 16, h 52, r 18, white, inset ring 1.5 rgba(10,51,70,.1), `search` 22 + input Figtree 500 16, placeholder "Search islands…"). **Current-location row** (mt 10, white r 18, pad 12 16): tile 36 r 12 + title (Figtree 700 16) + sub (12.5) + `chevron_right` `#9AAFB5`. States: idle `near_me` "Use my current location" / "Jump to the island you're on" (permission granted) or "We'll ask to use your location"; locating `radar` "Finding your island…" / "Hang on a few seconds"; denied `location_disabled` "Location is off" / "Allow location for Naiboli in Settings, then tap to try again"; far `wrong_location` "You're not on an island we know" / "Tap to try again, or pick one below"; fail `location_off` "Couldn't find you" / "Tap to try again". Idle/locating tile `#D3F1EE`/`#087F7A`; error tile `#FFE0D6`/`#E2522F`. List (mt 14, white r 22): row pad 14 16 — pin icon (`my_location` teal for current, `location_on` `#9AAFB5`), name Figtree 700 16, "Kaafu Atoll · Partly cloudy" 12.5, weather icon 24 (tinted `WX_TINT`) + temp Bricolage 700 18. Current row bg rgba(18,181,176,.08). Empty query shows 6 popular islands (`POP`), search shows max 12. Weather for visible rows is prefetched 250 ms after typing stops. No results: `No islands match "…"`.
- **All activities**: eyebrow = when-label. Groups in order Go, Maybe, After sunrise (wait), Skip — header dot 9 + Bricolage 700 16 + count DM Mono 12. Rows (pad 11 14, gap 12): tile 38 r 12 (icon 21), name Figtree 700 15, reason 12.5 ellipsis, score DM Mono 12, verdict pill (Figtree 700 12.5, pad 5 10, min-w 40). Reason: wait → "Too dark till 5:50 AM · otherwise 7.4"; limiting factor → "Only catch: wind, 18 km/h" (score ≥7) / "Held back by rain, 40% chance"; else a base condition phrase. Footer source line: "Activity scores from moodhu.dev, updated 1:15 PM." (or loading / fallback wording in `actsSrc`).
- **Activity detail**: top row "‹ All" (h 38 r 19 `#F1E9DA`) + close. Hero (r 28 pad 20, verdict hero bg): white 48 tile r 16 (icon 26 in verdict ink), name Bricolage 700 22, when-label; big verdict Bricolage 800 92/.84 ls −0.06em in verdict word colour + "7.4 / 10" (Bricolage 700 22 + DM Mono 13); line Figtree 600 16/1.4. Cards: **Best window** (title + window text in verdict ink, e.g. "7–11 AM" or "Tomorrow 7–9 AM"; 24 bars h 80 gap 3 r 4, coloured by hourly verdict, selected hour ringed 2 white + 3.5 navy; labels every 6 h, DM Mono 9). **What's shaping it** (only with route data): rows grid 20 / 84 / 1fr / 28 — icon, factor label + tag ("THE CATCH" `#B23A1C` for limiting factors, "NO LIVE DATA" for tide without data), 8 px bar on `#F1E9DA` coloured by factor value (≥7 go, ≥5 maybe, else skip), value. Factors: Wind, Rain, Heat, UV, Visibility, Tide, Daylight (`FACTORS`). Optional right label "Conditions 6.8" when it differs from overall by ≥0.3. **Next 7 days**: line "Best day: Fri 7, scoring 8.2." / "Today is your best shot this week…"; rows grid 72 / 1fr / 28 / 54 — day label (Today/Tomorrow/"Sat 8"), 6 px bar + note ("Wind is the catch" / "Nothing holding it back"), score, verdict pill; selected day tinted. **Tip** card (`#FFF0C6`, `lightbulb` `#7A5600`, text `#4A3A12` Figtree 500 14/1.45): factor tip from `FTIP` + activity tip from `ACTS`. Source line.
- **Weather**: eyebrow "MALÉ · NOW". Optional warning card. Hero (r 28, bg `WX_HERO[key]`): temp Bricolage 800 92 + 64 white tile r 22 (icon 38 tinted `WX_TINT`), condition Bricolage 700 22, "Feels like 35° · High 31° · Low 28°". Next 24 hours: horizontal chips 52 wide r 16 (`#F6F1E6`; selected `#0A3346` white) — hour, icon 22, temp, rain %. Next 8 days: grid 56/24/34/28/1fr/28 with temp range bar (gradient #7FD3CF→#FFC83D) + week summary line. 2-col stat grid (gap 10): Wind (value 32 + rotating `navigation` arrow), UV index (gradient bar #17B890 → #FFC83D 40 % → #FF7350 75 % → #B04BD6 with marker), Rain, Humidity, Clouds, Visibility; full-width Sun card (dashed arc path `M12 84 Q150 −36 288 84`, sun dot, sunrise/sunset) and Moon card (68 disk `#1E3058` with lit path `#F6EFD8`, phase name, % lit, next full/new moon, moonrise/set). Footer: OpenWeather logo (h 40, `assets/openweather-logo.png`) + "Weather data provided by OpenWeather", links to https://openweathermap.org/.
- **Tide**: hero `#D3F1EE` — "TIDE LEVEL" (`#0A5C63`), "+0.23 m" (Bricolage 800 66), direction row ("Rising until 4:12 PM"), source line. 24 h chart card: svg 354×150 area `#C9F0EC` + line `#12B5B0` 3 px, dashed now-line, high (`#12B5B0`) / low (`#C9A35E`) markers with time labels, now dot 14 (white, 3 px navy border), axis. Next 4 tides list (tile `water` teal or `footprint` yellow). Beach + Lagoon stat cards. Tip card "Sandbanks shrink fast at high water. Plan reef walks and sandbank trips around low tide." Footer: "Powered by MSRO" badge `https://geohub.msro.mv/badges/powered-by-msro.svg` (h 24) linking to https://geohub.msro.mv.
- **About the island** (from the sign or island bubble): hero `#FBEBC4` r 28 — name Bricolage 800 40, coordinates pill (→ Google Maps), 3 now-chips (temp/cond, tide, beach width). Description card; loading card; "Still being mapped" empty card; Getting there grid (auto-fill min 78, `accIcon()`); Beaches card (count, sandy/rocky bar `#E9C88E`/`#C9D4D8`, rows with tags e.g. "Surf: Go", "Low tide now"); Reefs card (tag "Snorkel: Maybe"); outline button "Change island" (`swap_horiz`) → picker.
- **Menu**: wordmark 40 + "FORECAST FOR FUN", "Just a heads up!" disclaimer card (`#FFF0C6`), "The Naiboli story" card, link list: Weather data → OpenWeather, Tide data → MSRO, Activity scores → moodhu.dev, Privacy → https://moodhu.dev/privacy-policy.

---

## Location & last-island behaviour (required)
Storage keys (AsyncStorage): `naiboli.island.v1` = full island object of the last selected island; `naiboli.locAsked.v1` = `1` once the first-run sheet has been shown.

1. **Launch** always opens the saved island (render immediately from the stored object; refresh it from `/islands` when loaded). Never auto-switch to the current location when a saved island exists. No saved island → default Malé (id 1069), not saved until the user picks.
2. **First run** (no saved island), after the splash:
   - Permission already granted → locate silently (`where-am-i`). Success → select + save. Failure → show the Welcome sheet with the reason.
   - Permission not granted → show the Welcome sheet **once** (set `locAsked`). "Use my location" triggers the OS permission prompt, then locates. "Pick an island myself" opens the picker. Dismissing leaves Malé, unsaved.
   - If `locAsked` is set and permission isn't granted, never show the sheet or prompt again on launch.
3. **"Use my current location"** in the picker is always visible. Granted → locate. Not granted → request permission (this is the only place the app asks again). If the OS can't ask again (`canAskAgain === false` / blocked), show the "Location is off" state and open system settings with `Linking.openSettings()` on tap.
4. Any pick (manual or location) saves to storage, closes sheets and loads weather, tide, island details and activity scores for that island.
5. Location request: accuracy balanced/coarse is enough, timeout 15 s, accept cached fix up to 5 min.
6. Native config: iOS `NSLocationWhenInUseUsageDescription` ("Naiboli uses your location to find the island you're on."); Android `ACCESS_COARSE_LOCATION` (+ `ACCESS_FINE_LOCATION` if the library requires it). Foreground only — no background location.

---

## State
`island` (object), `islands` (list), caches keyed by id: `weather` (by weather_anchor_id), `tides`, `islandDetails`, `activityScores` — each `loading | error | data(+fetchedAt)`; `offsetHours` 0–23; `bubble {kind,x,y,open}`; `sheet` (welcome | island | acts | act | wx | tide | isle | menu) + `actId`, `focus`; `query`; `geo` (idle | locating | denied | far | fail); `permission`; `firstRun`; `splashPhase` 0–3; `hintSeen`.

## Design tokens
- Ink `#0A3346` · secondary `#4F6F79` · body-secondary `#3F5F69` · muted icon `#9AAFB5` · HUD light ink `#05314A` / sub `#0B4560`
- Surfaces: sheet `#FBF6EC` · button/track `#F1E9DA` · tile `#F6F1E6` · card `#FFFFFF` · outer bg `#EDE4D3`
- Teal: accent `#087F7A` · tint `#D3F1EE` · line `#12B5B0` · area `#C9F0EC` · dark text `#0A5C63` · selected row rgba(18,181,176,.08)
- Tip `#FFF0C6` / `#7A5600` / `#4A3A12` · Warning `#FFE0D6` / `#E2522F` / `#5A1C0B` / `#6B2A17` · Warning chip `#FF7350` / `#2A0C03`
- Island hero `#FBEBC4`, coords `#7A5B2E`, chip icon `#9A6A28` · Sand `#E9C88E` · Rocky `#C9D4D8` · Rain blue `#2F86C2` · Sun `#FFC83D` · Arc `#E6D9BD`
- Weather hero `WX_HERO` and tint `WX_TINT` maps; scene palettes `PAL`, objects `OBJ` (all in the script).
- Logo shell colours: `#FFB020 #12b5b0 #11a5a3 #109596 #0f8488 #0e747b …` (exact paths in markup).
- Radii: 32 sheet · 30 panel · 28 hero · 24 card · 22 list group · 18 top-3 card / input / location row · 16 / 12 / 10 tiles · 999 pills · circles for 30/40/44 buttons.
- Shadows: card 0 1 2 rgba(10,51,70,.05) · panel 0 14 40 rgba(0,20,40,.25) · bubble 0 18 44 rgba(0,20,40,.3) · sheet 0 −10 40 rgba(0,20,30,.2) · focus ring 0 0 0 2.5 #0A3346.
- Type: Bricolage 800 at 92 / 72 / 66 / 40 / 32 / 28 / 26 / 24 / 21 / 17, 700 at 22 / 18 / 16 (negative letter-spacing as specified per element); Figtree 500 16 / 15 / 14 / 12.5, 600 16 / 15 / 14, 700 16 / 15 / 14 / 13.5 / 13 / 12.5; DM Mono 500 11.5 / 11 / 10.5 / 12 / 10 / 9.5 / 9 (eyebrows uppercase, ls .09em). Convert `em` letter-spacing to dp: `fontSize × em`.

## Copy
All copy is final, casual English (see markup and `renderVals()` / `liveMood()` / `phrasesOf()` for dynamic strings). Activity names, icons and tips: `ACTS`; factor tips `FTIP`; factor words `FWORD`.

## Assets
- `design/assets/openweather-logo.png` — OpenWeather attribution logo (required by their terms).
- MSRO badge — load remotely from `https://geohub.msro.mv/badges/powered-by-msro.svg` (or bundle a copy).
- Naiboli shell logo — inline SVG paths in the markup (menu button, splash, menu sheet).
- Icons — Material Symbols Rounded.

## Files
- `design/Naiboli Scene Live.dc.html` — the design + full logic reference.
- `design/support.js`, `design/ios-frame.jsx` — only needed to open the prototype in a browser (iPhone frame). Not part of the app.
- `PROMPT.md` — the prompt to give the coding agent.
