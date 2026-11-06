import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView, useGlass } from '@/scene/glass';
import type { ActRow, View as VM } from '@/state/view';
import { T } from '@/ui/fonts';
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
  onAct: (a: ActRow) => void;
  /** immersive mode is on: the panel is faded out and lets touches through */
  immersive: boolean;
  onImmersive: () => void;
}

/** "Shall we go?" panel: when-label, Now / All buttons, top 3 activities, 24 h scrubber. */
export function BottomPanel({ v, offset, onHour, onScrubStart, onNow, onAll, onAct, immersive, onImmersive }: Props) {
  const insets = useSafeAreaInsets();
  const { hud } = v;
  const { alphas } = useGlass();
  const fade = useAnimatedStyle(() => ({ opacity: 1 - alphas.immersive.get() }));
  return (
    <Animated.View style={[s.wrap, { bottom: Math.max(14, insets.bottom) }, fade]} pointerEvents={immersive ? 'none' : 'box-none'}>
      <GlassView
        id="panel"
        blur={20}
        sat={1.5}
        radius={30}
        alpha="panel"
        style={[
          s.panel,
          {
            backgroundColor: hud.panel,
            boxShadow: `${SHADOW.panel}, inset 0 0 0 1px ${hud.pEdge}`,
          },
        ]}>
        <View style={s.header}>
          <View style={s.titles}>
            <Text style={[T.mono(10.5, { ls: 0.09, upper: true }), { color: hud.pSub }]}>{v.whenLabel}</Text>
            <Text style={[T.bric(800, 21, { lh: 1.1, ls: -0.025 }), s.title, { color: hud.pInk }]}>Shall we go?</Text>
          </View>
          {v.isLater ? (
            <Pressable onPress={onNow} style={[s.btn, s.nowBtn, { backgroundColor: hud.pBtn }]} accessibilityRole="button" accessibilityLabel="Back to now">
              <Icon name="replay" size={17} color={hud.pInk} />
              <Text style={[T.fig(700, 12.5), { color: hud.pInk }]}>Now</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onAll} style={[s.btn, s.allBtn, { backgroundColor: hud.pBtn }]} accessibilityRole="button" accessibilityLabel={`All ${v.actCount} activities`}>
            <Text style={[T.fig(700, 12.5), { color: hud.pInk }]}>All {v.actCount}</Text>
            <Icon name="chevron_right" size={18} color={hud.pInk} />
          </Pressable>
          <Pressable
            onPress={onImmersive}
            hitSlop={6}
            style={[s.btn, s.iconBtn, { backgroundColor: hud.pBtn }]}
            accessibilityRole="button"
            accessibilityLabel="Hide the activity panel">
            <Icon name="open_in_full" size={17} color={hud.pInk} />
          </Pressable>
        </View>
        <View style={s.grid}>
          {v.top3.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => onAct(c)}
              style={[s.card, { backgroundColor: hud.pCard }]}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}: ${c.v}`}>
              <View style={s.cardTop}>
                <View style={[s.tile, { backgroundColor: c.vBg }]}>
                  <Icon name={c.icon} size={18} color={c.vInk} fill />
                </View>
                {/* "Maybe" doesn't fit next to the tile on narrower phones: shrink it rather than overflow. */}
                <Text
                  style={[T.bric(800, 17, { lh: 1, ls: -0.02 }), s.word, { color: c.vWord }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}>
                  {c.v}
                </Text>
              </View>
              <Text style={[T.fig(700, 13, { lh: 1.15 }), { color: hud.pInk }]} numberOfLines={1} ellipsizeMode="tail">
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Scrubber ribbon={v.ribbon} axis={v.axis} hud={hud} offset={offset} onHour={onHour} onStart={onScrubStart} />
      </GlassView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  panel: { borderRadius: 30, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  titles: { flex: 1, minWidth: 0 },
  title: { marginTop: 2 },
  btn: { height: 34, borderRadius: 17, flexDirection: 'row', alignItems: 'center' },
  nowBtn: { paddingHorizontal: 12, gap: 4 },
  allBtn: { paddingLeft: 12, paddingRight: 10, gap: 2 },
  iconBtn: { width: 34, justifyContent: 'center' },
  grid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  card: { flex: 1, minWidth: 0, borderRadius: 18, padding: 10, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  tile: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  word: { flexShrink: 1, minWidth: 0, textAlign: 'right' },
});
