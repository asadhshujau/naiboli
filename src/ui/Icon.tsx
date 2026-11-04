import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ICON_PATHS, type IconName } from './icons.generated';

export type { IconName };

interface Props {
  name: string;
  size: number;
  color: string;
  /** Material Symbols `FILL 1` */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  /** rotation in degrees (wind arrow) */
  rotate?: number;
}

/** Material Symbols Rounded (weight 400), outline or filled. Unknown names render nothing. */
export const Icon = memo(function Icon({ name, size, color, fill = false, style, rotate }: Props) {
  const p = ICON_PATHS[name as IconName];
  if (!p) {
    if (__DEV__) console.warn(`Icon "${name}" is not in icons.generated.ts — add it to scripts/gen-icons.mjs`);
    return null;
  }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      style={[rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style]}
      pointerEvents="none">
      <Path d={p[fill ? 1 : 0]} fill={color} />
    </Svg>
  );
});
