import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { GlassView, useGlass } from '@/scene/glass';
import { ARTBOARD_W } from '@/scene/paint';
import { T } from '@/ui/fonts';

/** "Tap anything" pill at artboard y 606, fading out (.5 s) after the first interaction. */
export function TapHint({ seen }: { seen: boolean }) {
  const { width } = useWindowDimensions();
  const { alphas } = useGlass();
  const a = alphas.hint;
  useEffect(() => {
    // CSS `transition: opacity .5s` (ease)
    a.set(withTiming(seen ? 0 : 1, { duration: 500, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }));
  }, [seen, a]);
  const style = useAnimatedStyle(() => ({ opacity: a.get() }));
  return (
    <Animated.View style={[s.root, { top: 606 * (width / ARTBOARD_W) }, style]} pointerEvents="none">
      <GlassView id="hint" blur={10} radius={999} alpha="hint" style={s.pill}>
        <View>
          <Text style={[T.mono(11, { ls: 0.04 }), s.text]}>Tap anything: sun, palms, island, sea</Text>
        </View>
      </GlassView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { backgroundColor: 'rgba(3,32,48,.38)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  text: { color: '#FFFFFF' },
});
