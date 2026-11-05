/**
 * "naib" + shell + "li" wordmark (the shell is the "o"). Bricolage 800 size/1, ls −0.045em;
 * shell .6em square, margin 0 .03em −.035em.
 *
 * The shell is an inline view inside the text: RN sits inline views on the baseline on both
 * platforms. In the markup the row is `align-items: baseline` and the shell has no text, so its bottom
 * edge sits on the baseline (the −.035em bottom margin doesn't move a baseline-aligned flex item).
 */
import { memo } from 'react';
import { Text, View } from 'react-native';

import { T } from './fonts';
import { ShellLogo } from './ShellLogo';
import { C } from './theme';

export const Wordmark = memo(function Wordmark({ size, color = C.ink }: { size: number; color?: string }) {
  const shell = size * 0.6;
  const mx = size * 0.03;
  return (
    <Text style={T.bric(800, size, { lh: 1, ls: -0.045, color })} accessibilityRole="header" accessibilityLabel="Naiboli">
      naib
      <View style={{ width: shell + 2 * mx, height: shell, paddingHorizontal: mx }}>
        <ShellLogo size={shell} />
      </View>
      li
    </Text>
  );
});
