/** Shared pieces of the bottom sheets (README §4): header, close button, cards, tip, labels, links. */
import * as WebBrowser from 'expo-web-browser';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { T } from '@/ui/fonts';
import { Icon } from '@/ui/Icon';
import { C, SHADOW } from '@/ui/theme';

/** Pressable that dims while pressed (the prototype is pointer-only; this is the touch convention). */
export function Press({ style, ...rest }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  return <Pressable {...rest} style={({ pressed }) => [style, pressed && s.pressed]} />;
}

export function CloseButton({ onPress, size = 40 }: { onPress: () => void; size?: 30 | 40 }) {
  return (
    <Press
      onPress={onPress}
      hitSlop={size === 30 ? 8 : 4}
      style={[s.close, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityRole="button"
      accessibilityLabel="Close">
      <Icon name="close" size={size === 30 ? 18 : 22} color={C.ink} />
    </Press>
  );
}

/** Eyebrow + title on the left, close button on the right. */
export function SheetHeader({ eyebrow, title, onClose }: { eyebrow?: string; title: string; onClose: () => void }) {
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
  return <View style={[s.card, flat ? null : s.cardShadow, ring ? s.ring : null, style]}>{children}</View>;
}

/** Card section title: Bricolage 700 16. */
export function CardTitle({ children }: { children: ReactNode }) {
  return <Text style={T.bric(700, 16, { color: C.ink })}>{children}</Text>;
}

/** Small uppercase label with an outline icon (stat cards). */
export function StatLabel({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <View style={s.statLabel}>
      <Icon name={icon} size={16} color={C.secondary} />
      <Text style={s.eyebrow}>{children}</Text>
    </View>
  );
}

/** Yellow tip card with a lightbulb. */
export function TipCard({ text, style }: { text: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.tip, style]}>
      <Icon name="lightbulb" size={22} color={C.tipIcon} fill />
      <Text style={s.tipText}>{text}</Text>
    </View>
  );
}

/** Footer source line (activity scores). */
export function SourceLine({ text, mt }: { text: string; mt: number }) {
  return <Text style={[s.source, { marginTop: mt }]}>{text}</Text>;
}

/** 1 px row separator (CSS `border-top: 1px solid rgba(10,51,70,.07)`). */
export const sepStyle = (on: boolean) => (on ? s.sep : null);

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
      style={[s.anchored, { left: left + (tx / 100) * w, top: top ?? 0, opacity: w ? 1 : 0 }, style]}>
      {children}
    </View>
  );
}

export const s = StyleSheet.create({
  pressed: { opacity: 0.6 },
  close: { backgroundColor: C.button, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flexShrink: 1 },
  eyebrow: T.mono(10.5, { ls: 0.09, upper: true, color: C.secondary }),
  title: T.bric(800, 26, { ls: -0.03, color: C.ink }),
  titleUnder: { marginTop: 2 },
  card: { backgroundColor: C.card, borderRadius: 24, padding: 16 },
  cardShadow: { boxShadow: SHADOW.card },
  ring: { boxShadow: SHADOW.focus },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tip: { marginTop: 12, padding: 16, borderRadius: 24, backgroundColor: C.tipBg, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipText: { flex: 1, ...T.fig(500, 14, { lh: 1.45, color: C.tipText }) },
  source: { marginHorizontal: 4, ...T.fig(500, 12.5, { lh: 1.45, color: C.secondary }) },
  sep: { borderTopWidth: 1, borderTopColor: 'rgba(10,51,70,.07)' },
  anchored: { position: 'absolute' },
});
