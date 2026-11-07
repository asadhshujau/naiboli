/**
 * Headline copy: the big line on the scene (current weather) and the scrubbed-hour line.
 *
 * Tone: friendly and silly is fine; safety never is. The STORM, WARN and HOUR_DANGER pools stay calm and clear,
 * and every line in them keeps the "stay ashore" sense. Headlines are big (40 pt): keep them short.
 *
 * Slots: {temp} {feels} {wind} {gust} {island} {hour}. Edit freely: the tests check slots, length and tone.
 */
import type { WxKey } from '../weather';

/**
 * Current-weather headline per mood key (the first line is the prototype's, except `rainy`: rain gets the
 * brutal-funny treatment, never "looks nice"; island hellos are left out of it too).
 */
export const HEAD: Record<Exclude<WxKey, 'stormy'>, string[]> = {
  sunny: [
    'Glorious out there.',
    'Big sun energy.',
    'Blue on blue today.',
    'The sun showed up. Again.',
    'Sunglasses o’clock.',
    'Postcard weather.',
    'It’s a {temp}° kind of day.',
    'Bright, blue, brilliant.',
    'The sky’s showing off.',
  ],
  partly: [
    'Pretty great.',
    'Sun with a side of clouds.',
    'Clouds, but make it cute.',
    'Mostly sunny, mostly happy.',
    'Decent. Very decent.',
    'Fluffy clouds on patrol.',
    'Free shade, now and then.',
    'Good enough to go out.',
  ],
  windy: [
    'Windy one today.',
    'Hold onto your hat.',
    'Breezy does it.',
    'The wind has opinions.',
    'Hair: ruined. Mood: fine.',
    '{wind} km/h of fresh air.',
    'Kites: yes. Hats: no.',
    'Blowy out there.',
  ],
  overcast: [
    'Not bad, actually.',
    'Grey, but friendly.',
    'Nature’s sun umbrella.',
    'Soft light, no squinting.',
    'Cloudy and cosy.',
    'The sun’s on a break.',
    'Easy on the eyes today.',
  ],
  rainy: [
    'Yeah, it’s raining.',
    'Soggy. Very soggy.',
    'The sky is leaking.',
    'Rain: 1. Your plans: 0.',
    'Wet. Everywhere. Sorry.',
    'Cancel the beach. Sorry.',
    'Even the fish are wet.',
    'Damp and {temp}°. Lovely. Not.',
    'Bad news: it’s raining.',
    'Indoor day, sadly.',
  ],
  night: [
    'Night owls only.',
    'The moon’s on shift.',
    'Quiet night, warm air.',
    '{temp}° after dark. Nice.',
    'Bedtime, or jetty time.',
    'Night mode: on.',
    'Good night out there.',
  ],
  golden: [
    'Golden hour.',
    'Golden hour. Go look.',
    'Sunset’s doing its thing.',
    'The sky is blushing.',
    'Peak sunset time.',
    'Pink sky, cold drink.',
  ],
};

/** Thunderstorms now. Calm, no jokes, always "stay ashore". */
export const STORM: string[] = [
  'Stay ashore.',
  'Storm about. Stay ashore.',
  'Stay ashore for now.',
  'Rough weather. Stay ashore.',
  'Thunder around. Stay ashore.',
  'A day to stay ashore.',
];

/** A forecast alert is active (thunder or strong gusts within 24 h). Calm, always "stay ashore". */
export const WARN: string[] = [
  'Heads up: stay ashore.',
  'Rough weather about. Stay ashore.',
  'See the alert. Stay ashore.',
  'Watch the sky. Stay ashore.',
  'Weather alert. Stay ashore.',
];

/** Extra lines when it feels hot (feels like ≥ 36°), daytime keys only. */
export const HOT: string[] = ['Feels like {feels}°. Phew.', 'Hot, hot, hot.', 'Find shade. Find water.', 'Toasty one today.', 'Iced coffee weather.'];

/** Extra lines with a good breeze (≥ 20 km/h) on sunny / partly / overcast days. */
export const BREEZY: string[] = ['Nice breeze today.', 'Breeze on the house.', 'Sunny with a side of breeze.'];

/** Extra lines in the morning (5–10 AM) on sunny / partly / overcast days. */
export const MORNING: string[] = ['Morning! Looking good.', 'Early start? Good call.', 'Good morning, {island}.'];

/** Late at night (11:30 PM – 4 AM, now), any weather but storms and alerts: go to bed. */
export const LATE: string[] = [
  'Don’t you sleep?',
  'What you doing up so late?',
  'Shouldn’t you be asleep?',
  'It’s late. Go to bed.',
  'Still up? Bold.',
  'The fish are asleep. Are you?',
  'Bed. Now. Please.',
  'Sleep is free, you know.',
  'Even the crabs went to bed.',
  'Counting waves won’t help.',
  'Weather check at this hour?',
];

/** Extra late-night lines when it's raining. */
export const LATE_RAIN: string[] = ['Rain and no sleep. Rough.', 'Listen to the rain. Then sleep.'];

/** Island lines, any weather but storms and alerts. Friendly to every island alike: no ranking, no teasing. */
export const ISLAND: string[] = ['Hello from {island}.', '{island}, reporting in.', '{island} says hi.'];

/** Scrubbed-hour headline per verdict word of the best activity. Every line names {hour}. */
export const HOUR: Record<'brilliant' | 'good' | 'so-so' | 'grim', string[]> = {
  brilliant: ['{hour} looks brilliant.', '{hour} is the one.', 'Set an alarm for {hour}.', '{hour}: chef’s kiss.', '{hour}? Absolutely.'],
  good: ['{hour} looks good.', '{hour} works nicely.', '{hour}? Good call.', '{hour}: thumbs up.', 'Pencil in {hour}.'],
  'so-so': ['{hour} looks so-so.', '{hour}: meh, but fine.', '{hour} is a maybe.', '{hour}: could be worse.', '{hour}, fifty-fifty.'],
  grim: ['{hour} looks grim.', '{hour}: maybe stay in.', '{hour}: snack o’clock.', '{hour} is a pass.', '{hour}? Hard pass.'],
};

/** Scrubbed hour between 11:30 PM and 4 AM. Every line names {hour}. */
export const HOUR_LATE: string[] = [
  '{hour}? You should be asleep.',
  '{hour}: prime sleeping time.',
  '{hour}? Bed. Obviously.',
  '{hour}: pillow o’clock.',
  '{hour}? Even the fish sleep.',
  '{hour}: dream about the beach.',
  'Up at {hour}? Why, though?',
];

/** Scrubbed hour with rain (raining, or ≥ 70 % chance), whatever the scores say. Brutal, but funny. */
export const HOUR_WET: string[] = [
  '{hour} looks nice. Kidding. Rain.',
  '{hour}: soggy. Sorry.',
  '{hour}? It’s raining. So, no.',
  '{hour}: bring a boat.',
  '{hour}: rain, rain, more rain.',
  '{hour}? Wet. Very wet.',
  '{hour}. Not great, is it?',
  '{hour}: the sky’s leaking.',
];

/** Scrubbed hour with a 40–69 % rain chance that would otherwise read "brilliant" / "good". */
export const HOUR_DAMP: string[] = [
  '{hour} could get wet.',
  '{hour}: good, if it stays dry.',
  '{hour}? Maybe. Pack a towel.',
  '{hour}: a coin toss with rain.',
  '{hour} looks fine. Ish.',
];

/** "Best bet" in the sub line when the scrubbed hour has rain. Slot {activity}; the facts follow it. */
export const BET_WET: string[] = [
  'Best bet: {activity}, if you like wet.',
  'Best bet: staying dry. Or {activity}.',
  'Best bet: {activity}. Soggy, though.',
  'Best bet: {activity}. In the rain. Hmm.',
  'Best bet: {activity}. Not great, is it?',
];

/** Thunder or gusts ≥ 50 km/h at the scrubbed hour. Calm, always "stay ashore". */
export const HOUR_DANGER: string[] = [
  '{hour} looks rough. Stay ashore.',
  '{hour}: stay ashore.',
  'Rough weather at {hour}. Stay ashore.',
  '{hour}: rough out there. Stay ashore.',
];
