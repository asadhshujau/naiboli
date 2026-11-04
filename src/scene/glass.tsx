/**
 * Frosted-glass registry. RN views that sit over the scene register their window rect;
 * the scene canvas blurs (and optionally saturates) the scene behind each one — the native
 * equivalent of CSS `backdrop-filter`, identical on iOS and Android.
 */
import { createContext, useCallback, useContext, useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
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
  /** which shared alpha fades this glass (hint fade-out) */
  alpha?: 'hint';
}

export interface GlassApi {
  rects: SharedValue<Record<string, GlassRect>>;
  alphas: { hint: SharedValue<number> };
}

const Ctx = createContext<GlassApi | null>(null);

export function useGlassRegistry(): GlassApi {
  const rects = useSharedValue<Record<string, GlassRect>>({});
  const hint = useSharedValue(1);
  return { rects, alphas: { hint } };
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
  alpha?: 'hint';
};

/** A View whose window rect is registered as a glass backdrop. */
export function GlassView({ id, blur, sat, radius, alpha, onLayout, ...rest }: GlassViewProps) {
  const { rects } = useGlass();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const measure = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => {
      if (!w || !h) return;
      rects.modify((r) => {
        'worklet';
        r[id] = { x, y, w, h, r: radius, blur, sat, alpha };
        return r;
      });
    });
  }, [rects, id, radius, blur, sat, alpha]);
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
