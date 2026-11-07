import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView } from '@/scene/glass';
import type { View as VM } from '@/state/view';
import { BalancedText } from '@/ui/BalancedText';
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
  onRetry: () => void;
  /** tap on the time line (now only): refresh */
  onRefresh: () => void;
}

/** Top HUD: menu, island chip, temperature chip, eyebrow, headline, sub, warning chip. */
export function TopHud({ v, onMenu, onIsland, onTemp, onWarning, onRetry, onRefresh }: Props) {
  const insets = useSafeAreaInsets();
  const { hud } = v;
  const shadow = hud.shadow ? HUD_TEXT_SHADOW : null;
  return (
    <View style={[s.root, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
      {/* the chip row catches every tap (gaps included); the texts below let taps through to the scene */}
      <View style={s.row}>
        <GlassView id="hud-menu" blur={12} radius={22} style={[s.circle, { backgroundColor: hud.chip }]}>
          <Pressable onPress={onMenu} style={s.fill} accessibilityRole="button" accessibilityLabel="Menu">
            <ShellLogo size={22} />
          </Pressable>
        </GlassView>
        <GlassView id="hud-island" blur={12} radius={22} style={[s.chip, { backgroundColor: hud.chip }]}>
          <Pressable onPress={onIsland} style={[s.chipInner, s.islandPad]} accessibilityRole="button" accessibilityLabel={`Island: ${v.loc}. Change island`}>
            <Icon name="location_on" size={20} color={hud.ink} fill />
            <Text style={[T.fig(600, 15), s.shrink, { color: hud.ink }]} numberOfLines={1}>
              {v.loc}
            </Text>
            <Icon name="expand_more" size={20} color={hud.ink} />
          </Pressable>
        </GlassView>
        <View style={s.spacer} />
        <GlassView id="hud-temp" blur={12} radius={22} style={[s.chip, { backgroundColor: hud.chip }]}>
          <Pressable onPress={onTemp} style={[s.chipInner, s.tempPad]} accessibilityRole="button" accessibilityLabel={`Temperature ${v.now.temp} degrees`}>
            <Icon name={v.now.icon} size={22} color={hud.ink} fill />
            <Text style={[T.bric(700, 22, { ls: -0.02 }), { color: hud.ink }]}>{v.now.temp}°</Text>
          </Pressable>
        </GlassView>
      </View>
      <View pointerEvents="box-none">
        {/* now: the time line is a refresh button ("· Updating" while it runs); scrubbed ahead it lets taps through */}
        <Pressable
          onPress={onRefresh}
          disabled={v.isLater}
          pointerEvents={v.isLater ? 'none' : 'auto'}
          hitSlop={{ top: 10, bottom: 6, left: 8, right: 8 }}
          style={({ pressed }) => [s.eyebrowWrap, pressed && s.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${v.eyebrow}. Refresh`}>
          <Text style={[T.mono(11.5, { ls: 0.09, upper: true }), { color: hud.sub }, shadow]}>{v.eyebrow}</Text>
        </Pressable>
        <View pointerEvents="none">
          <BalancedText style={[s.head, T.bric(800, 40, { lh: 0.98, ls: -0.04 }), { color: hud.ink }, shadow]}>{v.head}</BalancedText>
        </View>
        {/* offline: the sub line is a retry button; otherwise taps go through to the scene */}
        <Pressable
          onPress={onRetry}
          disabled={!v.retry}
          pointerEvents={v.retry ? 'auto' : 'none'}
          hitSlop={8}
          style={({ pressed }) => [s.subWrap, pressed && s.pressed]}
          accessibilityRole={v.retry ? 'button' : 'text'}>
          <Text style={[T.fig(500, 16, { lh: 1.35 }), { color: hud.sub }, shadow]} lineBreakStrategyIOS="standard">
            {v.sub}
          </Text>
        </Pressable>
      </View>
      {v.hasWarning && v.warning ? (
        // frosted like the other chips: the scene blurs behind a translucent orange
        <GlassView id="hud-warn" blur={12} radius={18} style={s.warn}>
          <Pressable onPress={onWarning} style={s.warnInner} accessibilityRole="button" accessibilityLabel={`Warning: ${chipText(v.warning)}`}>
            <Icon name="warning" size={19} color={C.warnChipInk} fill />
            <Text style={[T.fig(700, 13.5), s.shrink, { color: C.warnChipInk }]} numberOfLines={1}>
              {chipText(v.warning)}
            </Text>
          </Pressable>
        </GlassView>
      ) : null}
    </View>
  );
}

/** "From 7 PM · Strong wind" while the alert hasn't started yet, else just the alert. */
function chipText(w: { short: string; from: string | null }): string {
  return w.from ? `From ${w.from.replace(':00', '')} · ${w.short}` : w.short;
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
  shrink: { flexShrink: 1 },
  eyebrowWrap: { marginTop: 22, alignSelf: 'flex-start' },
  head: { marginTop: 8 },
  subWrap: { marginTop: 8, maxWidth: 300, alignSelf: 'flex-start' },
  pressed: { opacity: 0.6 },
  warn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    height: 36,
    borderRadius: 18,
    backgroundColor: C.warnChipGlass,
  },
  warnInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 12 },
});
