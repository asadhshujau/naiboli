/** Shared pieces of the bottom sheets (README §4): header, close button, cards, tip, labels, links. */
import * as WebBrowser from 'expo-web-browser';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { T } from '@/ui/fonts';
import { Icon } from '@/ui/Icon';
import { themed, useDayTheme } from '@/ui/dayTheme';

/** Pressable that dims while pressed (the prototype is pointer-only; this is the touch convention). */
export function Press({ style, ...rest }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  return <Pressable {...rest} style={({ pressed }) => [style, pressed && fixed.pressed]} />;
}

export function CloseButton({ onPress, size = 40 }: { onPress: () => void; size?: 30 | 40 }) {
  const s = usePartStyles();
  const { c } = useDayTheme();
  return (
    <Press
      onPress={onPress}
      hitSlop={size === 30 ? 8 : 4}
      style={[s.close, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityRole="button"
      accessibilityLabel="Close">
      <Icon name="close" size={size === 30 ? 18 : 22} color={c.ink} />
    </Press>
  );
}

/** Eyebrow + title on the left, close button on the right. */
export function SheetHeader({ eyebrow, title, onClose }: { eyebrow?: string; title: string; onClose: () => void }) {
  const s = usePartStyles();
  return (
    <View style={s.header}>
      <View style={s.headerText}>
        {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
        <Text style={[s.title, eyebrow ? s.titleUnder : null]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <CloseButton onPress={onClose} />
    </View>
  );
}

/** White card, r 24, pad 16. `flat` drops the hairline shadow (cards that have none in the markup). */
export function Card({ children, style, flat, ring }: { children: ReactNode; style?: StyleProp<ViewStyle>; flat?: boolean; ring?: boolean }) {
  const s = usePartStyles();
  return <View style={[s.card, flat ? null : s.cardShadow, ring ? s.ring : null, style]}>{children}</View>;
}

/** Card section title: Bricolage 700 16. */
export function CardTitle({ children }: { children: ReactNode }) {
  return <Text style={usePartStyles().cardTitle}>{children}</Text>;
}

/** Small uppercase label with an outline icon (stat cards). */
export function StatLabel({ icon, children }: { icon: string; children: ReactNode }) {
  const s = usePartStyles();
  const { c } = useDayTheme();
  return (
    <View style={s.statLabel}>
      <Icon name={icon} size={16} color={c.secondary} />
      <Text style={s.eyebrow}>{children}</Text>
    </View>
  );
}

/** Yellow tip card with a lightbulb. */
export function TipCard({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  const s = usePartStyles();
  const { c } = useDayTheme();
  return (
    <View style={[s.tip, style]}>
      <Icon name="lightbulb" size={22} color={c.tipIcon} fill />
      <Text style={s.tipText}>{text}</Text>
    </View>
  );
}

/** Footer note under the activity sheets (shown only while scores are our own estimate). */
/**
 * The weather alert box, as on the Weather sheet; also on All activities and the activity detail.
 * `onPress`: open the Weather sheet at the alert.
 */
export function AlertCard({ title, until, body, onPress, style }: { title: string; until: string; body: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const p = usePartStyles();
  const { c } = useDayTheme();
  const inner = (
    <>
      <Icon name="warning" size={22} color={c.warnIcon} fill />
      <View style={p.alertText}>
        <Text style={p.alertTitle}>
          {title} · until {until}
        </Text>
        <Text style={p.alertBody}>{body}</Text>
      </View>
    </>
  );
  return onPress ? (
    <Press onPress={onPress} style={[p.alert, style]} accessibilityRole="button" accessibilityLabel={`${title} until ${until}. ${body} Weather details`}>
      {inner}
    </Press>
  ) : (
    <View style={[p.alert, style]}>{inner}</View>
  );
}

export function SourceLine({ text, mt }: { text: string; mt: number }) {
  return <Text style={[usePartStyles().source, { marginTop: mt }]}>{text}</Text>;
}

/** 1 px row separator (CSS `border-top: 1px solid rgba(10,51,70,.07)`): `const sep = useSep()`, then `sep(on)`. */
export function useSep() {
  const s = usePartStyles();
  return (on: boolean) => (on ? s.sep : null);
}

/** Open a web page in the in-app browser; map links go to the system (Maps app if installed). */
export function openLink(url: string) {
  if (/google\.com\/maps/.test(url)) void Linking.openURL(url);
  else void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
}

/**
 * Text anchored at `left` (px) and shifted by `tx` % of its own width — CSS
 * `left: x%; transform: translateX(tx%)` for labels on charts.
 */
export function Anchored({ left, top, tx, children, style }: { left: number; top?: number; tx: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [w, setW] = useState(0);
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[fixed.anchored, { left: left + (tx / 100) * w, top: top ?? 0, opacity: w ? 1 : 0 }, style]}>
      {children}
    </View>
  );
}

const fixed = StyleSheet.create({
  pressed: { opacity: 0.6 },
  anchored: { position: 'absolute' },
});

/** Shared sheet styles for the current day theme (also used by the sheets: header, title, eyebrow, ring…). */
export const usePartStyles = themed((c) =>
  StyleSheet.create({
    close: { backgroundColor: c.button, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerText: { flexShrink: 1 },
    eyebrow: T.mono(10.5, { ls: 0.09, upper: true, color: c.secondary }),
    title: T.bric(800, 26, { ls: -0.03, color: c.ink }),
    titleUnder: { marginTop: 2 },
    cardTitle: T.bric(700, 16, { color: c.ink }),
    card: { backgroundColor: c.card, borderRadius: 24, padding: 16 },
    cardShadow: { boxShadow: c.cardShadow },
    ring: { boxShadow: c.focusRing },
    statLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tip: { marginTop: 12, padding: 16, borderRadius: 24, backgroundColor: c.tipBg, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    tipText: { flex: 1, ...T.fig(500, 14, { lh: 1.45, color: c.tipText }) },
    alert: { padding: 16, borderRadius: 24, backgroundColor: c.warnBg, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    alertText: { flexShrink: 1 },
    alertTitle: T.bric(700, 16, { color: c.warnInk }),
    alertBody: { marginTop: 4, ...T.fig(500, 14, { lh: 1.45, color: c.warnBody }) },
    source: { marginHorizontal: 4, ...T.fig(500, 12.5, { lh: 1.45, color: c.secondary }) },
    sep: { borderTopWidth: 1, borderTopColor: c.sep },
  }),
);
