import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

import { SHELL_PATHS } from './shell-paths';

/** The Naiboli shell mark (overflow visible, like the markup). */
export const ShellLogo = memo(function ShellLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible' }} pointerEvents="none">
      {SHELL_PATHS.map((p) => (
        <Path key={p.c} d={p.d} fill={p.c} stroke={p.c} strokeWidth={0.6} strokeLinejoin="round" />
      ))}
    </Svg>
  );
});
