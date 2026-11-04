/** Design tokens (README "Design tokens"). */
export const C = {
  ink: '#0A3346',
  secondary: '#4F6F79',
  bodySecondary: '#3F5F69',
  mutedIcon: '#9AAFB5',
  hudInk: '#05314A',
  hudSub: '#0B4560',

  sheet: '#FBF6EC',
  button: '#F1E9DA',
  tile: '#F6F1E6',
  card: '#FFFFFF',
  outer: '#EDE4D3',

  teal: '#087F7A',
  tealTint: '#D3F1EE',
  tealLine: '#12B5B0',
  tealArea: '#C9F0EC',
  tealDark: '#0A5C63',
  selectedRow: 'rgba(18,181,176,.08)',

  tipBg: '#FFF0C6',
  tipIcon: '#7A5600',
  tipText: '#4A3A12',
  warnBg: '#FFE0D6',
  warnIcon: '#E2522F',
  warnInk: '#5A1C0B',
  warnBody: '#6B2A17',
  warnChip: '#FF7350',
  warnChipInk: '#2A0C03',

  islandHero: '#FBEBC4',
  coords: '#7A5B2E',
  chipIcon: '#9A6A28',
  sand: '#E9C88E',
  rocky: '#C9D4D8',
  rainBlue: '#2F86C2',
  sun: '#FFC83D',
  arc: '#E6D9BD',

  /** scene background behind the canvas before the first frame (day sky mid) */
  sceneBg: '#74CEF4',
} as const;

export const SHADOW = {
  card: '0 1px 2px rgba(10,51,70,.05)',
  panel: '0 14px 40px rgba(0,20,40,.25)',
  bubble: '0 18px 44px rgba(0,20,40,.3)',
  sheet: '0 -10px 40px rgba(0,20,30,.2)',
  focus: '0 0 0 2.5px #0A3346',
} as const;

/** Prototype text-shadow for HUD text on a dark sky: 0 1px 14px rgba(0,0,0,.22). */
export const HUD_TEXT_SHADOW = {
  textShadowColor: 'rgba(0,0,0,.22)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 14,
} as const;
