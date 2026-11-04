import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView } from '@/scene/glass';
import type { View as VM } from '@/state/view';
import { T } from '@/ui/fonts';
import { Icon } from '@/ui/Icon';
import { ShellLogo } from '@/ui/ShellLogo';
import { C, HUD_TEXT_SHADOW } from '@/ui/theme';

interface Props {
  v: VM;
  onMenu: () => void;
  onIsland: () => void;
  onTemp: () => void;
  onWarning: () => void;
}

/** Top HUD: menu, island chip, temperature chip, eyebrow, headline, sub, warning chip. */
export function TopHud({ v, onMenu, onIsland, onTemp, onWarning }: Props) {
  const insets = useSafeAreaInsets();
  const { hud } = v;
  const shadow = hud.shadow ? HUD_TEXT_SHADOW : null;
  return (
    <View style={[s.root, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
      <View style={s.row} pointerEvents="box-none">
        <GlassView id="hud-menu" blur={12} radius={22} style={[s.circle, { backgroundColor: hud.chip }]}>
          <Pressable onPress={onMenu} style={s.fill} accessibilityRole="button" accessibilityLabel="Menu">
            <ShellLogo size={22} />
          </Pressable>
        </GlassView>
        <GlassView id="hud-island" blur={12} radius={22} style={[s.chip, { backgroundColor: hud.chip }]}>
          <Pressable onPress={onIsland} style={[s.chipInner, s.islandPad]} accessibilityRole="button" accessibilityLabel={`Island: ${v.loc}. Change island`}>
            <Icon name="location_on" size={20} color={hud.ink} fill />
            <Text style={[T.fig(600, 15), { color: hud.ink }]} numberOfLines={1}>
              {v.loc}
            </Text>
            <Icon name="expand_more" size={20} color={hud.ink} />
          </Pressable>
        </GlassView>
        <View style={s.spacer} pointerEvents="none" />
        <GlassView id="hud-temp" blur={12} radius={22} style={[s.chip, { backgroundColor: hud.chip }]}>
          <Pressable onPress={onTemp} style={[s.chipInner, s.tempPad]} accessibilityRole="button" accessibilityLabel={`Temperature ${v.now.temp} degrees`}>
            <Icon name={v.now.icon} size={22} color={hud.ink} fill />
            <Text style={[T.bric(700, 22, { ls: -0.02 }), { color: hud.ink }]}>{v.now.temp}°</Text>
          </Pressable>
        </GlassView>
      </View>
      <Text style={[s.eyebrow, T.mono(11.5, { ls: 0.09, upper: true }), { color: hud.sub }, shadow]}>{v.eyebrow}</Text>
      <Text
        style={[s.head, T.bric(800, 40, { lh: 0.98, ls: -0.04 }), { color: hud.ink }, shadow]}
        textBreakStrategy="balanced"
        lineBreakStrategyIOS="push-out">
        {v.head}
      </Text>
      <Text style={[s.sub, T.fig(500, 16, { lh: 1.35 }), { color: hud.sub }, shadow]}>{v.sub}</Text>
      {v.hasWarning && v.warning ? (
        <Pressable onPress={onWarning} style={s.warn} accessibilityRole="button" accessibilityLabel={`Warning: ${v.warning.short}`}>
          <Icon name="warning" size={19} color={C.warnChipInk} fill />
          <Text style={[T.fig(700, 13.5), { color: C.warnChipInk }]}>{v.warning.short}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  circle: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { height: 44, borderRadius: 22, overflow: 'hidden', flexShrink: 1 },
  chipInner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  islandPad: { gap: 6, paddingLeft: 10, paddingRight: 12 },
  tempPad: { gap: 4, paddingLeft: 10, paddingRight: 14 },
  spacer: { flex: 1 },
  eyebrow: { marginTop: 22 },
  head: { marginTop: 8 },
  sub: { marginTop: 8, maxWidth: 300 },
  warn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 18,
    backgroundColor: C.warnChip,
  },
});
