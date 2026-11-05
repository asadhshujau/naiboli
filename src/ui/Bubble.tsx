/**
 * Info bubble (README §3): 268 wide, r 24, white .95 over a 14 px scene blur, placed near the tap.
 * Opens with opacity .18 s and scale .85 → 1 over .28 s cubic-bezier(.2,.9,.3,1.25) from the tap point.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { setGlassRect, useGlass } from '@/scene/glass';
import { BUBBLE_W, type BubbleContent, type BubblePos } from '@/state/sheets';
import { themed, useDayTheme } from '@/ui/dayTheme';
import { T } from '@/ui/fonts';
import { Icon } from '@/ui/Icon';
import { CloseButton, Press } from '@/ui/sheet/parts';
import { SHADOW } from '@/ui/theme';

const FADE = { duration: 180, easing: Easing.bezier(0.25, 0.1, 0.25, 1) };
const POP = { duration: 280, easing: Easing.bezier(0.2, 0.9, 0.3, 1.25) };

interface Props {
  content: BubbleContent;
  pos: BubblePos;
  open: boolean;
  onClose: () => void;
  onAction: () => void;
}

export function Bubble({ content: B, pos, open, onClose, onAction }: Props) {
  const s = useS();
  const t = useDayTheme();
  const { c } = t;
  const { rects, alphas, bubbleScale } = useGlass();
  const alpha = alphas.bubble;
  const [h, setH] = useState(0);

  useEffect(() => {
    alpha.set(withTiming(open ? 1 : 0, FADE));
    bubbleScale.set(withTiming(open ? 1 : 0.85, POP));
  }, [open, alpha, bubbleScale]);

  // The scene blurs behind the bubble's rect, faded and scaled with it.
  useEffect(() => {
    if (!h) return;
    setGlassRect(rects, 'bubble', { x: pos.x, y: pos.y, w: BUBBLE_W, h, r: 24, blur: 14, alpha: 'bubble', origin: [pos.ox, pos.oy === 'top' ? 0 : h] });
  }, [rects, pos.x, pos.y, pos.ox, pos.oy, h]);
  useEffect(() => () => setGlassRect(rects, 'bubble', null), [rects]);

  const anim = useAnimatedStyle(() => ({ opacity: alpha.get(), transform: [{ scale: bubbleScale.get() }] }));

  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      onLayout={(e) => setH(e.nativeEvent.layout.height)}
      style={[s.root, { left: pos.x, top: pos.y, transformOrigin: [pos.ox, pos.oy === 'top' ? 0 : '100%', 0] }, anim]}>
      <View style={s.row}>
        <View style={[s.tile, t.bgS(B.tile)]}>
          <Icon name={B.icon} size={20} color={c.ink} fill />
        </View>
        <Text style={s.title}>{B.title}</Text>
        <CloseButton onPress={onClose} size={30} />
      </View>
      <Text style={[s.big, t.fgS(B.bigColor)]}>{B.big}</Text>
      <View style={s.lines}>
        {B.lines.map((ln, i) => (
          <Text key={i} style={s.line}>
            {ln}
          </Text>
        ))}
      </View>
      {B.action ? (
        <Press onPress={onAction} style={s.action} accessibilityRole="button">
          <Text style={s.actionText}>{B.action.label}</Text>
          <Icon name="arrow_forward" size={18} color={c.onInverse} />
        </Press>
      ) : null}
    </Animated.View>
  );
}

const useS = themed((c) =>
  StyleSheet.create({
    root: {
      position: 'absolute',
      zIndex: 30,
      width: BUBBLE_W,
      borderRadius: 24,
      backgroundColor: c.bubble,
      boxShadow: SHADOW.bubble,
      padding: 16,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    tile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, ...T.mono(11, { ls: 0.09, upper: true, color: c.secondary }) },
    big: { marginTop: 12, ...T.bric(800, 28, { lh: 1.05, ls: -0.03 }) },
    lines: { marginTop: 8, gap: 5 },
    line: T.fig(500, 14, { lh: 1.35, color: c.bodySecondary }),
    action: {
      marginTop: 12,
      height: 42,
      borderRadius: 999,
      backgroundColor: c.inverse,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    actionText: T.fig(700, 14, { color: c.onInverse }),
  }),
);
