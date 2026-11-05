import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView, useGlass } from '@/scene/glass';
import type { View as VM } from '@/state/view';
import { Icon } from '@/ui/Icon';
import { SHADOW } from '@/ui/theme';

import { Scrubber } from './Scrubber';

interface Props {
  v: VM;
  offset: SharedValue<number>;
  onHour: (h: number) => void;
  onScrubStart: () => void;
  onNow: () => void;
  onAll: () => void;
  /** immersive mode is on (this bar takes touches) */
  immersive: boolean;
  onExit: () => void;
}

/** Immersive mode's bottom bar: thin scrubber, back to now, all activities, show the panel again. */
export function MiniBar({ v, offset, onHour, onScrubStart, onNow, onAll, immersive, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const { hud } = v;
  const { alphas } = useGlass();
  const fade = useAnimatedStyle(() => ({ opacity: alphas.immersive.get() }));
  const btn = [s.btn, { backgroundColor: hud.pBtn }];
  return (
    <Animated.View style={[s.wrap, { bottom: Math.max(14, insets.bottom) }, fade]} pointerEvents={immersive ? 'box-none' : 'none'}>
      <GlassView
        id="mini"
        blur={20}
        sat={1.5}
        radius={26}
        alpha="mini"
        style={[s.bar, { backgroundColor: hud.panel, boxShadow: `${SHADOW.panel}, inset 0 0 0 1px ${hud.pEdge}` }]}>
        <Scrubber compact ribbon={v.ribbon} axis={v.axis} hud={hud} offset={offset} onHour={onHour} onStart={onScrubStart} />
        <View style={s.btns}>
          {v.isLater ? (
            <Pressable onPress={onNow} hitSlop={4} style={btn} accessibilityRole="button" accessibilityLabel="Back to now">
              <Icon name="replay" size={18} color={hud.pInk} />
            </Pressable>
          ) : null}
          <Pressable onPress={onAll} hitSlop={4} style={btn} accessibilityRole="button" accessibilityLabel={`All ${v.actCount} activities`}>
            <Icon name="format_list_bulleted" size={18} color={hud.pInk} />
          </Pressable>
          <Pressable onPress={onExit} hitSlop={4} style={btn} accessibilityRole="button" accessibilityLabel="Show the activity panel">
            <Icon name="close_fullscreen" size={18} color={hud.pInk} />
          </Pressable>
        </View>
      </GlassView>
    </Animated.View>
  );
}

/** Height of the bar (for bubble placement): padding 8 + scrubber 30 + padding 8. */
export const MINI_BAR_H = 46;

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 26, paddingVertical: 8, paddingLeft: 10, paddingRight: 8 },
  btns: { flexDirection: 'row', gap: 6 },
  btn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
