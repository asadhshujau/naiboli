import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView } from '@/scene/glass';
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
}

/** "Shall we go?" panel: when-label, Now / All buttons, top 3 activities, 24 h scrubber. */
export function BottomPanel({ v, offset, onHour, onScrubStart, onNow, onAll, onAct }: Props) {
  const insets = useSafeAreaInsets();
  const { hud } = v;
  return (
    <GlassView
      id="panel"
      blur={20}
      sat={1.5}
      radius={30}
      style={[
        s.panel,
        {
          bottom: Math.max(14, insets.bottom),
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
              <Text style={[T.bric(800, 17, { lh: 1, ls: -0.02 }), { color: c.vWord }]}>{c.v}</Text>
            </View>
            <Text style={[T.fig(700, 13, { lh: 1.15 }), { color: hud.pInk }]} numberOfLines={1} ellipsizeMode="tail">
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>
      <Scrubber ribbon={v.ribbon} axis={v.axis} hud={hud} offset={offset} onHour={onHour} onStart={onScrubStart} />
    </GlassView>
  );
}

const s = StyleSheet.create({
  panel: { position: 'absolute', left: 12, right: 12, borderRadius: 30, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  titles: { flex: 1, minWidth: 0 },
  title: { marginTop: 2 },
  btn: { height: 34, borderRadius: 17, flexDirection: 'row', alignItems: 'center' },
  nowBtn: { paddingHorizontal: 12, gap: 4 },
  allBtn: { paddingLeft: 12, paddingRight: 10, gap: 2 },
  grid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  card: { flex: 1, minWidth: 0, borderRadius: 18, padding: 10, gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  tile: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
