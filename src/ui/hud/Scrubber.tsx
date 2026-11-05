import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { HudTone, View as VM } from '@/state/view';
import { T } from '@/ui/fonts';

interface Props {
  ribbon: VM['ribbon'];
  axis: VM['axis'];
  hud: HudTone;
  /** continuous offset 0–23 h (UI thread) */
  offset: SharedValue<number>;
  /** whole-hour offset changed (also on release) */
  onHour: (h: number) => void;
  /** pointer down: close bubble, hide hint */
  onStart: () => void;
  /** thin version for immersive mode: shorter bars, no axis labels */
  compact?: boolean;
}

/**
 * 24-hour scrubber: drag sets the offset continuously; release snaps to the whole hour.
 * Bars: height 22 + best×7.8 %, coloured by that hour's best verdict.
 */
export function Scrubber({ ribbon, axis, hud, offset, onHour, onStart, compact = false }: Props) {
  const width = useSharedValue(1);
  const lastHour = useSharedValue(0);

  const set = (x: number) => {
    'worklet';
    const o = Math.max(0, Math.min(1, x / width.get())) * 23;
    offset.set(o);
    const r = Math.round(o);
    if (r !== lastHour.get()) {
      lastHour.set(r);
      scheduleOnRN(onHour, r);
    }
  };
  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (e) => {
      'worklet';
      scheduleOnRN(onStart);
      lastHour.set(Math.round(offset.get()));
      set(e.x);
    },
    onUpdate: (e) => {
      'worklet';
      set(e.x);
    },
    onFinalize: () => {
      'worklet';
      const r = Math.round(offset.get());
      offset.set(r);
      lastHour.set(r);
      scheduleOnRN(onHour, r);
    },
  });

  const thumb = useAnimatedStyle(() => ({ left: (offset.get() / 23) * width.get() }));

  return (
    <View style={compact ? s.rootC : s.root}>
      <GestureDetector gesture={pan}>
        <View
          style={compact ? s.areaC : s.area}
          onLayout={(e) => {
            width.set(e.nativeEvent.layout.width || 1);
          }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Time of day">
          <View style={[s.bars, compact && s.barsC]} pointerEvents="none">
            {ribbon.map((b, i) => (
              <View key={i} style={[s.bar, { height: `${b.h}%`, backgroundColor: b.c, opacity: b.o }]} />
            ))}
          </View>
          <Animated.View style={[s.thumb, thumb]} pointerEvents="none">
            <View style={[s.line, { backgroundColor: hud.pInk }]} />
            <View style={[s.knob, { backgroundColor: hud.pInk, boxShadow: `0 0 0 3px ${hud.panelSolid}` }]} />
          </Animated.View>
        </View>
      </GestureDetector>
      {compact ? null : (
        <View style={s.axis} pointerEvents="none">
          {axis.map((a) => (
            <Text key={a.x} style={[s.axisLabel, T.mono(10), { left: `${a.x}%`, color: hud.pSub, transform: [{ translateX: `${a.tx}%` }] }]} numberOfLines={1}>
              {a.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { marginTop: 14, paddingHorizontal: 4 },
  rootC: { flex: 1, minWidth: 0, paddingHorizontal: 6 },
  area: { height: 38 },
  areaC: { height: 30 },
  barsC: { height: 22 },
  bars: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 30, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { flex: 1, borderRadius: 3 },
  thumb: { position: 'absolute', top: 0, bottom: -2, width: 0 },
  line: { position: 'absolute', left: -2, top: 2, bottom: 0, width: 4, borderRadius: 2 },
  knob: { position: 'absolute', left: -7, top: -3, width: 14, height: 14, borderRadius: 7 },
  axis: { height: 14, marginTop: 6 },
  axisLabel: { position: 'absolute', top: 0 },
});
