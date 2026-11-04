/**
 * Frosted-glass registry. RN views that sit over the scene register their window rect;
 * the scene canvas blurs (and optionally saturates) the scene behind each one — the native
 * equivalent of CSS `backdrop-filter`, identical on iOS and Android.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ComponentRef, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

export interface GlassRect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  /** CSS blur(px) = Gaussian sigma */
  blur: number;
  /** CSS saturate(), e.g. 1.5 */
  sat?: number;
  /** which shared alpha fades this glass (hint fade-out, bubble open/close) */
  alpha?: GlassAlpha;
  /** transform origin inside the rect for the bubble's open/close scale */
  origin?: [number, number];
}

export type GlassAlpha = 'hint' | 'bubble';

export interface GlassApi {
  rects: SharedValue<Record<string, GlassRect>>;
  alphas: Record<GlassAlpha, SharedValue<number>>;
  /** the bubble's current scale (applied around `origin`) */
  bubbleScale: SharedValue<number>;
  /**
   * The screen's root view (an ancestor of the canvas and every glass view, with the canvas at its
   * origin). Glass rects are measured relative to it: `measureInWindow` can be offset by the status
   * bar on Android edge-to-edge, which moved the panel blur above the panel.
   */
  root: ComponentRef<typeof View> | null;
}

const Ctx = createContext<GlassApi | null>(null);

/** `root`: the screen's root view (held in state by the screen, set through its callback ref). */
export function useGlassRegistry(root: ComponentRef<typeof View> | null): GlassApi {
  const rects = useSharedValue<Record<string, GlassRect>>({});
  const hint = useSharedValue(1);
  const bubble = useSharedValue(0);
  const bubbleScale = useSharedValue(0.85);
  return useMemo(() => ({ rects, alphas: { hint, bubble }, bubbleScale, root }), [rects, hint, bubble, bubbleScale, root]);
}

export function GlassProvider({ api, children }: { api: GlassApi; children: ReactNode }) {
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useGlass() {
  const api = useContext(Ctx);
  if (!api) throw new Error('GlassProvider missing');
  return api;
}

type GlassViewProps = ViewProps & {
  id: string;
  blur: number;
  sat?: number;
  radius: number;
  alpha?: GlassAlpha;
};

/** Register (or update) a glass rect directly — for views whose rect is known without measuring. */
export function setGlassRect(rects: GlassApi['rects'], id: string, g: GlassRect | null) {
  rects.modify((r) => {
    'worklet';
    if (g) r[id] = g;
    else delete r[id];
    return r;
  });
}

/** A View whose rect (relative to the screen root = canvas space) is registered as a glass backdrop. */
export function GlassView({ id, blur, sat, radius, alpha, onLayout, ...rest }: GlassViewProps) {
  const { rects, root } = useGlass();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el || !root) return;
    el.measureLayout(root, (x: number, y: number, w: number, h: number) => {
      if (!w || !h) return;
      rects.modify((r) => {
        'worklet';
        r[id] = { x, y, w, h, r: radius, blur, sat, alpha };
        return r;
      });
    });
  }, [rects, root, id, radius, blur, sat, alpha]);
  // the root may attach after this view's first layout
  useEffect(() => measure(), [measure]);
  useEffect(
    () => () =>
      rects.modify((r) => {
        'worklet';
        delete r[id];
        return r;
      }),
    [rects, id],
  );
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={(e) => {
        measure();
        onLayout?.(e);
      }}
      {...rest}
    />
  );
}
