/**
 * Activity detail copy: the verdict sentence that leads the detail line ("Yes! Conditions line up nicely.").
 * The factual part after it (the reason, "Sunrise is at …") is never replaced.
 *
 * Tone: activities can be friendly-brutal and silly ("break a leg"). Safety first: when the hour has thunder or
 * strong gusts, or a "skip" is down to wind, haze or darkness, the CAUTION / SKIP_SAFE pools are used — calm,
 * clear, no jokes. Safety tips (`tip` in ACTS, `FTIP`) are separate and never touched.
 *
 * Slots: {activity}. Edit freely: the tests check slots and tone.
 */
import type { Factor } from '../types';

/** Verdict "go" (the first line is the prototype's). */
export const GO: string[] = [
  'Yes! Conditions line up nicely.',
  'Green light.',
  'Go on, then.',
  'All signs point to yes.',
  'This is your window.',
  'Conditions are on your side.',
];

/** Extra "go" (and "ideal") lines per activity. */
export const GO_ACT: Record<string, string[]> = {
  surf: ['Paddle out. Waves are waiting.', 'Go shred. Politely.', 'Surf’s calling. Pick up.'],
  sail: ['Hoist away.', 'Fair winds. Literally.', 'Good sailing weather. Go.'],
  jet: ['Go zoom. Mind the swimmers.', 'Full throttle, good manners.'],
  swim: ['In you go.', 'The water’s calling your name.', 'Last one in is a sea cucumber.'],
  snorkel: ['The fish are expecting you.', 'Mask on, world off.', 'The reef is open for business.'],
  dive: ['Go blow some bubbles.', 'Down you go. Buddy too.', 'The deep blue says hi.'],
  fish: ['Fish are biting. Probably.', 'Go catch dinner.', 'Line in, worries out.'],
  dolphin: ['Dolphin o’clock.', 'Go say hi to the dolphins.', 'Fins may be spotted.'],
  rainwalk: ['Go get gloriously damp.', 'Puddles await.', 'Splash responsibly.'],
  ocswim: ['Grey sky, warm sea. Go.', 'No glare, all swim.'],
  kayak: ['Paddle on.', 'Grab a paddle. Go.', 'Kayak time. Arms, prepare.'],
  beach: ['Towel down. Feet up.', 'Beach mode: approved.', 'Sand between toes, ASAP.'],
  sup: ['Stand up, paddle on.', 'Balance optional. Fun guaranteed.', 'Board, paddle, go.'],
  sandbank: ['Your sandbank awaits.', 'Go claim your sandbank.', 'Tiny island, all yours.'],
};

/** Verdict "ideal" (the first line is the prototype's). Also draws from GO_ACT. */
export const IDEAL: string[] = ['Couldn’t ask for better.', 'Top marks. Go.', 'It doesn’t get better than this.', 'Perfect. Don’t overthink it.'];

/** Verdict "maybe" (the first line is the prototype's). */
export const MAYBE: string[] = [
  'Doable. Go with a plan and a buddy.',
  'Could work. Bring a plan.',
  'Not bad, not perfect.',
  'Fine, with a bit of care.',
  'Worth a go, carefully.',
];

/** Extra "maybe" lines per limiting factor. Wind, haze and darkness stay plain. */
export const MAYBE_FACTOR: Partial<Record<Factor, string[]>> = {
  uv: ['Doable. Sunscreen is not optional.', 'Fine, if you like shade breaks.'],
  temp: ['Doable. Hydrate like it’s your job.', 'Warm work. Pace yourself.'],
  tide: ['Doable. Time it with the tide.', 'The tide’s a bit off. Plan around it.'],
  rain: ['Doable, if you don’t mind wet.', 'Some rain about. Pick your gaps.', 'Doable. Soggy, but doable.'],
  wind: ['Doable, but the wind is up. Stay close to shore.', 'Breezy. Stay close to shore.'],
  visibility: ['Doable, but the water’s hazy. Stay close.'],
  daylight: ['Doable. Mind the light.'],
};

/** Verdict "skip" for harmless reasons (the first line is the prototype's). */
export const SKIP: string[] = [
  'Not this time. Another hour will treat you better.',
  'Nope. Try another hour.',
  'Hard pass, for now.',
  'Give it a miss for now.',
  'Not your hour. Check the others.',
];

/** Extra "skip" lines per harmless limiting factor. */
export const SKIP_FUN: Partial<Record<Factor, string[]>> = {
  uv: ['Too much sun. Shade and a cold drink.', 'The sun’s winning. Retreat to shade.'],
  temp: ['Too hot. Be a lizard later.', 'Too toasty. Try when it cools.'],
  tide: ['The tide says no. Try another hour.', 'Wrong tide. Check back later.'],
  rain: ['Too soggy. Try another hour.', 'Wet blanket weather. Try later.', 'It’s raining. That’s the review.', 'Rain wins this round.'],
};

/**
 * "Go" / "ideal" while it's raining at that hour (raining, or ≥ 70 % chance), any activity but the rain walk.
 * The score may say yes; the copy says what it'll actually feel like.
 */
export const GO_WET: string[] = [
  'Technically yes. It’s raining, though.',
  'The score says go. The sky says lol.',
  'Go, if you don’t mind getting soaked.',
  'Sure. You’ll be wet. Very wet.',
  'Fine on paper. Wet in real life.',
];

/** "Maybe" while it's raining at that hour. */
export const MAYBE_WET: string[] = [
  'Maybe. If you enjoy being rained on.',
  'Doable, if soggy is your thing.',
  'Possible. Damp. Not pleasant.',
  'Could work. Bring a towel. Or two.',
];

/** Factors where a "skip" is about safety: no jokes. */
export const DANGER_FACTORS: Factor[] = ['wind', 'visibility', 'daylight'];

/** "Skip" for safety reasons, per factor, and `storm` for thunder / strong gusts at that hour. Calm and clear. */
export const SKIP_SAFE: Record<'wind' | 'visibility' | 'daylight' | 'storm', string[]> = {
  wind: ['Too windy for this right now.', 'Not safe in this wind. Try another hour.', 'The wind is too strong. Leave it for now.'],
  visibility: ['Visibility is poor. Leave it for now.', 'Too hazy to do this safely.'],
  daylight: ['Not safe in the dark. Wait for daylight.'],
  storm: ['Not in this weather. Stay ashore.', 'Rough weather about. Stay ashore.', 'Thunder or strong gusts about. Stay ashore.'],
};

/** "Go" / "maybe" while the hour has thunder or strong gusts. Calm and clear. */
export const CAUTION: string[] = ['Rough weather about. Safest to stay ashore.', 'Weather alert in effect. Check it before you go.'];

/** Verdict "wait" (too dark; the first line is the prototype's). */
export const WAIT: string[] = ['Too dark for now.', 'Wait for the sun.', 'Not until it’s light.', 'Daylight first.'];
