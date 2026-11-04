/**
 * Splash (README §1): #FBF6EC, wordmark 72 + "FORECAST FOR FUN".
 * t = 80 ms: shell −150° / .25 → 0° / 1 over 1.1 s cubic-bezier(.2,.9,.25,1.12); "naib" and "li" fade in and
 * rise 12 → 0 (.6 s / .7 s, delays .35 s / .45 s); tagline fades in (.6 s, delay .7 s).
 * From 2.6 s it waits for `ready` (weather loaded, no location lookup running), at most 9 s, then fades
 * out (opacity .55 s, scale 1 → 1.05 .6 s) and calls `onDone` after 650 ms. Tap skips.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { T } from './fonts';
import { ShellLogo } from './ShellLogo';
import { C } from './theme';

const SIZE = 72;
const SHELL = SIZE * 0.6;
const MX = SIZE * 0.03;
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const RISE = Easing.bezier(0.2, 0.8, 0.2, 1);
const SPIN = Easing.bezier(0.2, 0.9, 0.25, 1.12);

const MIN_MS = 2600;
const MAX_MS = 9000;
const OUT_MS = 650;

interface Props {
  /** weather for the island has loaded and no location lookup is running */
  ready: boolean;
  onDone: () => void;
}

export function Splash({ ready, onDone }: Props) {
  const spin = useSharedValue(0);
  const naib = useSharedValue(0);
  const naibY = useSharedValue(0);
  const li = useSharedValue(0);
  const liY = useSharedValue(0);
  const tag = useSharedValue(0);
  const out = useSharedValue(0);
  const outScale = useSharedValue(0);

  const [ending, setEnding] = useState(false);
  const readyRef = useRef(ready);
  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    const start = Date.now();
    // `splashGate`: from 2.6 s, end once ready (or after 9 s), checking every 250 ms.
    const gate = () => {
      if (readyRef.current || Date.now() - start > MAX_MS) setEnding(true);
      else t.push(setTimeout(gate, 250));
    };
    const t = [
      setTimeout(() => {
        spin.set(withTiming(1, { duration: 1100, easing: SPIN }));
        naib.set(withDelay(350, withTiming(1, { duration: 600, easing: EASE })));
        naibY.set(withDelay(350, withTiming(1, { duration: 700, easing: RISE })));
        li.set(withDelay(450, withTiming(1, { duration: 600, easing: EASE })));
        liY.set(withDelay(450, withTiming(1, { duration: 700, easing: RISE })));
        tag.set(withDelay(700, withTiming(1, { duration: 600, easing: EASE })));
      }, 80),
      setTimeout(gate, MIN_MS),
    ];
    return () => t.forEach(clearTimeout);
  }, [spin, naib, naibY, li, liY, tag]);

  const end = useCallback(() => setEnding(true), []);
  useEffect(() => {
    if (!ending) return;
    out.set(withTiming(1, { duration: 550, easing: EASE }));
    outScale.set(withTiming(1, { duration: 600, easing: EASE }));
    const t = setTimeout(onDone, OUT_MS);
    return () => clearTimeout(t);
  }, [ending, out, outScale, onDone]);

  // Lay out the real wordmark invisibly, then place the animated parts exactly on it.
  const [shellAt, setShellAt] = useState<{ x: number; y: number } | null>(null);
  const [fullW, setFullW] = useState(0);
  const [liW, setLiW] = useState(0);

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - out.get(), transform: [{ scale: 1 + 0.05 * outScale.get() }] }));
  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: SIZE * 0.035 }, { rotate: `${-150 * (1 - spin.get())}deg` }, { scale: 0.25 + 0.75 * spin.get() }],
  }));
  const naibStyle = useAnimatedStyle(() => ({ opacity: naib.get(), transform: [{ translateY: 12 * (1 - naibY.get()) }] }));
  const liStyle = useAnimatedStyle(() => ({ opacity: li.get(), transform: [{ translateY: 12 * (1 - liY.get()) }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.get() }));

  return (
    <Animated.View style={[s.root, rootStyle]} pointerEvents={ending ? 'none' : 'auto'}>
      <Pressable style={s.fill} onPress={end} accessibilityRole="button" accessibilityLabel="Naiboli. Tap to skip">
        <View>
          <Text
            style={[s.word, s.hidden]}
            onLayout={(e) => setFullW(e.nativeEvent.layout.width)}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden>
            naib
            <View style={s.slot} onLayout={(e) => setShellAt({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y })} />
            li
          </Text>
          {shellAt && fullW ? (
            <>
              <Animated.Text style={[s.word, s.abs, { left: 0 }, naibStyle]}>naib</Animated.Text>
              <Animated.View style={[s.abs, { left: shellAt.x + MX, top: shellAt.y }, shellStyle]}>
                <ShellLogo size={SHELL} />
              </Animated.View>
              <Animated.Text style={[s.word, s.abs, { left: fullW - liW, opacity: liW ? undefined : 0 }, liStyle]} onLayout={(e) => setLiW(e.nativeEvent.layout.width)}>
                li
              </Animated.Text>
            </>
          ) : null}
        </View>
        <Animated.Text style={[s.tagline, tagStyle]}>Forecast for fun</Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 60, backgroundColor: C.sheet },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  word: T.bric(800, SIZE, { lh: 1, ls: -0.045, color: C.ink }),
  hidden: { opacity: 0 },
  slot: { width: SHELL + 2 * MX, height: SHELL },
  abs: { position: 'absolute', top: 0 },
  tagline: T.mono(11, { ls: 0.3, upper: true, color: C.secondary }),
});
