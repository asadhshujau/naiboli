/** Font faces, one family key per face (works with runtime `useFonts`, incl. Expo Go). */
import { Platform, type TextStyle } from 'react-native';

export const FONT_SOURCES = {
  // Static Bricolage instances per optical-size bucket (scripts/instance-bricolage.py).
  'Bricolage-700': require('../../assets/fonts/Bricolage-700.ttf'),
  'Bricolage-800-S': require('../../assets/fonts/Bricolage-800-S.ttf'),
  'Bricolage-800-M': require('../../assets/fonts/Bricolage-800-M.ttf'),
  'Bricolage-800-L': require('../../assets/fonts/Bricolage-800-L.ttf'),
  'Figtree-500': require('@expo-google-fonts/figtree/500Medium/Figtree_500Medium.ttf'),
  'Figtree-600': require('@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf'),
  'Figtree-700': require('@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf'),
  'Figtree-800': require('@expo-google-fonts/figtree/800ExtraBold/Figtree_800ExtraBold.ttf'),
  'DMMono-500': require('@expo-google-fonts/dm-mono/500Medium/DMMono_500Medium.ttf'),
  'Thaana-400': require('@expo-google-fonts/noto-sans-thaana/400Regular/NotoSansThaana_400Regular.ttf'),
  'Thaana-600': require('@expo-google-fonts/noto-sans-thaana/600SemiBold/NotoSansThaana_600SemiBold.ttf'),
};

/** Figtree 700 TTF for the Skia sign text. */
export const FIGTREE_700 = FONT_SOURCES['Figtree-700'];

type Face = keyof typeof FONT_SOURCES;

/** Bricolage face for a weight and size (the web uses opsz = font size). */
export function bricolage(weight: 700 | 800, size: number): Face {
  if (weight === 700) return 'Bricolage-700';
  return size >= 60 ? 'Bricolage-800-L' : size >= 30 ? 'Bricolage-800-M' : 'Bricolage-800-S';
}

interface TypeOpts {
  /** CSS line-height multiplier */
  lh?: number;
  /** CSS letter-spacing in em */
  ls?: number;
  color?: string;
  upper?: boolean;
}

function base(fontFamily: Face, fontSize: number, o: TypeOpts): TextStyle {
  return {
    fontFamily,
    fontSize,
    ...(o.lh != null ? { lineHeight: fontSize * o.lh } : null),
    ...(o.ls ? { letterSpacing: fontSize * o.ls } : null),
    ...(o.color ? { color: o.color } : null),
    ...(o.upper ? { textTransform: 'uppercase' as const } : null),
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  };
}

/** Typography helpers mirroring CSS `font:` shorthands, e.g. `T.bric(800, 21, { lh: 1.1, ls: -0.025 })`. */
export const T = {
  bric: (w: 700 | 800, size: number, o: TypeOpts = {}) => base(bricolage(w, size), size, o),
  fig: (w: 500 | 600 | 700 | 800, size: number, o: TypeOpts = {}) => base(`Figtree-${w}` as Face, size, o),
  mono: (size: number, o: TypeOpts = {}) => base('DMMono-500', size, o),
  thaana: (w: 400 | 600, size: number, o: TypeOpts = {}) => base(`Thaana-${w}` as Face, size, o),
};
