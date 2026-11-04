/**
 * Bottom-sheet shell (README §4): scrim (fade .35 s, tap closes), bottom-anchored sheet with
 * max-height 86 %, slide translateY 105 % → 0 over .45 s cubic-bezier(.2,.85,.25,1), grabber and a
 * scroll area (pad 8 20 40). Every `openSheet` (bumps `seq`) scrolls to the focused card − 64, or the top.
 * Platform conventions: drag down from the top to dismiss, keyboard lifts the sheet.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Keyboard, Platform, Pressable, ScrollView as RNScrollView, StyleSheet, View } from 'react-native';
import { GestureDetector, ScrollView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { C, SHADOW } from '@/ui/theme';

const SLIDE = { duration: 450, easing: Easing.bezier(0.2, 0.85, 0.25, 1) };
/** CSS `transition: opacity .35s` (default `ease`) */
const FADE = { duration: 350, easing: Easing.bezier(0.25, 0.1, 0.25, 1) };

type ViewRef = ComponentRef<typeof View>;
type Refs = Map<string, ViewRef>;
const FocusCtx = createContext<Refs | null>(null);

/** Ref for a card the sheet can scroll to when opened with that focus key. */
export function useFocusRef(key: string) {
  const refs = useContext(FocusCtx);
  return useCallback(
    (r: ViewRef | null) => {
      if (!refs) return;
      if (r) refs.set(key, r);
      else refs.delete(key);
    },
    [refs, key],
  );
}

interface Props {
  open: boolean;
  /** bumps on every openSheet */
  seq: number;
  focus: string | null;
  /** screen height (layout of the root view) */
  frameH: number;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ open, seq, focus, frameH, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const p = useSharedValue(0);
  const scrim = useSharedValue(0);
  const drag = useSharedValue(0);
  const h = useSharedValue(frameH);
  const kb = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const dragFrom = useSharedValue(0);

  useEffect(() => {
    if (open) drag.set(0);
    p.set(withTiming(open ? 1 : 0, SLIDE));
    scrim.set(withTiming(open ? 1 : 0, FADE));
  }, [open, p, scrim, drag]);

  // Scroll to the focused card (or the top) 40 ms after each openSheet, like the prototype.
  const scrollRef = useRef<ComponentRef<typeof RNScrollView>>(null);
  const contentRef = useRef<ViewRef>(null);
  const [refs] = useState<Refs>(() => new Map());
  useEffect(() => {
    if (!seq) return;
    const t = setTimeout(() => {
      const sc = scrollRef.current;
      const content = contentRef.current;
      if (!sc) return;
      const el = focus ? refs.get(focus) : undefined;
      const top = () => sc.scrollTo({ y: 0, animated: false });
      if (el && content) el.measureLayout(content, (_x: number, y: number) => sc.scrollTo({ y: Math.max(0, y - 64), animated: false }), top);
      else top();
    }, 40);
    return () => clearTimeout(t);
  }, [seq, focus, refs]);

  // Lift the sheet above the keyboard (island search).
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      kb.set(withTiming(e.endCoordinates.height, { duration: e.duration || 250 }));
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      kb.set(withTiming(0, { duration: e.duration || 250 }));
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [kb]);

  // Drag down to dismiss, only while the content is scrolled to the top.
  const pan = usePanGesture({
    activeOffsetY: 10,
    failOffsetY: -10,
    failOffsetX: [-14, 14],
    onBegin: () => {
      'worklet';
      dragFrom.set(0);
    },
    onUpdate: (e) => {
      'worklet';
      if (scrollY.get() > 0.5) {
        dragFrom.set(e.translationY);
        drag.set(0);
      } else drag.set(Math.max(0, e.translationY - dragFrom.get()));
    },
    onDeactivate: (e) => {
      'worklet';
      const d = drag.get();
      if (d > 120 || (d > 8 && e.velocityY > 900)) scheduleOnRN(onClose);
      else drag.set(withTiming(0, { duration: 250, easing: Easing.out(Easing.cubic) }));
    },
  });

  // If the window itself shrinks for the keyboard (Android adjustResize), only lift by the rest.
  const [fullH, setFullH] = useState(frameH);
  if (frameH > fullH) setFullH(frameH);
  const resized = fullH - frameH;
  const maxH = fullH * 0.86;
  const sheetStyle = useAnimatedStyle(() => {
    const lift = Math.max(0, kb.get() - resized);
    return {
      bottom: lift,
      maxHeight: Math.min(maxH, frameH - lift - insets.top - 8),
      transform: [{ translateY: (1 - p.get()) * 1.05 * h.get() + drag.get() }],
    };
  });
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() * (1 - Math.min(1, drag.get() / Math.max(1, h.get()))) }));

  return (
    <View style={s.root} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[s.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[s.sheet, sheetStyle]}
          onLayout={(e) => h.set(e.nativeEvent.layout.height)}
          accessibilityViewIsModal={open}>
          <View style={s.grabberRow}>
            <View style={s.grabber} />
          </View>
          <ScrollView
            ref={scrollRef}
            simultaneousWith={pan}
            bounces={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEventThrottle={16}
            onScroll={(e) => scrollY.set(e.nativeEvent.contentOffset.y)}>
            <FocusCtx.Provider value={refs}>
              <View ref={contentRef} style={[s.content, { paddingBottom: Math.max(40, insets.bottom + 16) }]}>
                {children}
              </View>
            </FocusCtx.Provider>
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 50 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3,24,36,.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: C.sheet,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    boxShadow: SHADOW.sheet,
  },
  grabberRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(10,51,70,.18)' },
  content: { paddingTop: 8, paddingHorizontal: 20 },
});
