You are implementing the Naiboli app design in this React Native project.

Read `design_handoff_naiboli/README.md` fully, then study `design_handoff_naiboli/design/Naiboli Scene Live.dc.html` (markup = visual spec, `<script data-dc-script>` = logic spec). The HTML is a reference prototype — recreate it natively; do not embed it in a WebView.

Before writing code:
1. Inspect this codebase: RN/Expo version, navigation, state management, data fetching, styling approach, existing fonts/icons, folder structure. Reuse what exists.
2. Reply with a short plan: file structure, libraries you'll add (prefer the README's "Recommended RN stack" where nothing exists), and how you'll port the canvas scene. Wait for my OK before installing packages.

Implementation rules:
- High fidelity: match the README's dp sizes, colours, fonts, radii, shadows, blur, copy and animation timings exactly at the 402 × 874 reference frame. Respect safe areas as described.
- Port the scene drawing (`paint`, `palm`, `cloud`, `lightOf`, `sunState`, palettes) to Skia 1:1, running at 60 fps on the UI thread where possible.
- Port all data logic exactly: API contracts, Maldives-time hour axis, weather sampling, tide resampling and extrema, activity-score parsing, verdict mapping, fallback scoring, refresh/retry timers.
- Implement the "Location & last-island behaviour" section exactly, including permission rules, AsyncStorage keys, and the native permission strings.
- Keep everything typed (TypeScript if the project uses it). Put API types, parsing, and scoring in pure modules with unit tests (procWx, procTide, procActs, verdict mapping, where-am-i handling).

Build in this order, and stop for review after each phase:
1. Data layer + types + tests.
2. Scene canvas + time scrubber + bottom panel + top HUD.
3. Bubbles and all bottom sheets.
4. Location/first-run flow, persistence, splash.
5. Polish pass: compare side by side with the HTML prototype in a browser and list any differences you couldn't match.
