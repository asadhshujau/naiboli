# Naiboli: Google Play store listing

Paste these into Play Console → **Grow users → Store presence → Main store listing**.
Graphics in this folder are made by `node scripts/gen-store-assets.mjs`.

## App name (max 30 characters)

```
Naiboli: Forecast for Fun
```

## Short description (max 80 characters)

```
Weather, tides and what to do today on your Maldives island, hour by hour.
```

## Full description (max 4,000 characters)

```
Naiboli turns the forecast for your island into a simple answer: is it a good time to swim, snorkel, surf or just lie on the beach?

Pick your island, or let Naiboli find it for you, and you'll see a living picture of your island's sky and sea that changes with the weather and the time of day. Slide through the next hours and watch the light, clouds and rain change, with a clear verdict for each activity: Go, Maybe, Skip or Wait.

WHAT TO DO TODAY
• Verdicts for swimming, snorkeling, diving, surfing, sailing, kayaking, paddleboarding, jet skiing, fishing, dolphin watching, sandbank visits, beach time and rain walks
• Why each verdict was given: wind, tide, visibility, UV, rain or darkness
• A safety tip for every activity, and calm, clear warnings when the weather turns

WEATHER
• Right now: temperature, feels-like, wind and gusts, UV, rain chance, humidity, clouds and visibility
• The next 24 hours and the next 8 days
• Sunrise, sunset, and the moon's phase, moonrise and moonset
• Weather warnings when they are issued

TIDES
• High and low tides for your island, from the Maldives Space Research Organisation (MSRO)
• How much beach you'll have, and the best time for a sandbank trip

MADE FOR THE MALDIVES
• Islands across the Maldives, searchable by name
• Your recent islands, one tap away
• Find your island from your location, only when you ask

SIMPLE AND PRIVATE
• No account, no ads, no tracking
• Your location is used once to find your island and is never stored

Weather data provided by OpenWeather. Tide data from MSRO.

Naiboli is for planning fun, not for safety decisions at sea. Always follow official weather warnings and local advice.
```

## Other fields

| Field | Value |
|---|---|
| App category | Weather |
| Tags (optional) | Weather, Travel |
| Contact email | jr.shujau@gmail.com |
| Website (optional) | leave empty for now |
| Privacy policy (App content) | https://naiboli.shujau.dev/privacy-policy |

## Graphics

| Asset | File | Play's rule |
|---|---|---|
| App icon | `icon-512.png` | 512 × 512 PNG, up to 1 MB |
| Feature graphic | `feature-graphic.png` | 1024 × 500 PNG or JPEG, no transparency |
| Phone screenshots | taken by you on the phone (power + volume down), then `npm run store:screenshots` → `store/play/screenshots/play/` | 2 to 8, PNG or JPEG, 320 to 3,840 px on each side, long side ≤ 2× short side (a raw 20:9 phone capture is too tall) |

Screenshot ideas, in this order: the island at midday with a "Go" day, the activity list, the Weather sheet, the Tide sheet, the same island at dusk or night, the island picker. Take them in the release build from the closed test, so the dev menu never shows.
