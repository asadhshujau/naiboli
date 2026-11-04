import { Canvas, ClipOp, Picture, Skia, TileMode, useFont, type SkCanvas, type SkFont, type SkPicture } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, useTapGesture } from 'react-native-gesture-handler';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { FIGTREE_700 } from '@/ui/fonts';

import { makeCtx } from './ctx2d';
import type { GlassApi, GlassRect } from './glass';
import { ARTBOARD_W, HZ, hitTest, initialSim, tick, type SceneInput, type SceneKind, type SimState } from './paint';

interface Props {
  input: SceneInput;
  /** scrubber offset in hours (continuous while dragging) */
  offset: SharedValue<number>;
  glass: GlassApi;
  /** tap in artboard units */
  onTap: (kind: SceneKind, x: number, y: number) => void;
}

/** CSS saturate(s) colour matrix. */
function saturate(s: number): number[] {
  'worklet';
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function drawGlass(c: SkCanvas, rects: Record<string, GlassRect>, alphas: { hint: number }) {
  'worklet';
  for (const k in rects) {
    const g = rects[k];
    const a = g.alpha ? alphas[g.alpha] : 1;
    if (a <= 0.001) continue;
    let f = Skia.ImageFilter.MakeBlur(g.blur, g.blur, TileMode.Clamp, null);
    if (g.sat) f = Skia.ImageFilter.MakeColorFilter(Skia.ColorFilter.MakeMatrix(saturate(g.sat)), f);
    c.save();
    c.clipRRect(Skia.RRectXY(Skia.XYWHRect(g.x, g.y, g.w, g.h), g.r, g.r), ClipOp.Intersect, true);
    const p = Skia.Paint();
    p.setAlphaf(a);
    c.saveLayer(p, null, f);
    c.restore();
    c.restore();
  }
}

/**
 * Full-screen animated island scene. Scale = screenWidth / 402; the artboard is as tall as the
 * screen allows (the sea fills extra height). Painted on the UI thread every frame.
 */
export function SceneCanvas({ input, offset, glass, onTap }: Props) {
  // Size from the canvas's own layout: on Android edge-to-edge, window dimensions exclude the
  // navigation bar, which would leave a strip below the scene.
  const win = useWindowDimensions();
  const [size, setSize] = useState({ width: win.width, height: win.height });
  const { width, height } = size;
  const scale = width / ARTBOARD_W;
  const artH = height / scale;

  const [sim0] = useState(initialSim);
  const sim = useSharedValue<SimState>(sim0);
  const inputSV = useSharedValue<SceneInput>(input);
  useEffect(() => {
    inputSV.set(input);
  }, [input, inputSV]);

  const font = useFont(FIGTREE_700, 12);
  const fontSV = useSharedValue<SkFont | null>(null);
  useEffect(() => {
    fontSV.set(font);
  }, [font, fontSV]);

  const [empty] = useState(() => {
    const r = Skia.PictureRecorder();
    r.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
    return r.finishRecordingAsPicture();
  });
  const picture = useSharedValue<SkPicture>(empty);

  const { rects, alphas } = glass;
  useFrameCallback((fi) => {
    'worklet';
    const dt = (fi.timeSincePreviousFrame ?? 16) / 1000;
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    c.save();
    c.scale(scale, scale);
    const ctx = makeCtx(c);
    const I = inputSV.value;
    const off = offset.value;
    const f = fontSV.value;
    sim.modify((S) => {
      'worklet';
      tick(ctx, S, I, off, dt, ARTBOARD_W, artH, f);
      return S;
    }, false);
    c.restore();
    drawGlass(c, rects.value, { hint: alphas.hint.value });
    picture.value = rec.finishRecordingAsPicture();
  });

  const tap = useTapGesture({
    onActivate: (e) => {
      'worklet';
      const x = e.x / scale;
      const y = e.y / scale;
      const kind = hitTest(sim.value.hits, x, y);
      sim.modify((S) => {
        'worklet';
        S.ripples.push({ x, y, a: 0, sea: y > HZ });
        return S;
      }, false);
      scheduleOnRN(onTap, kind, x, y);
    },
  });

  return (
    <GestureDetector gesture={tap}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          if (w && h && (w !== width || h !== height)) setSize({ width: w, height: h });
        }}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Picture picture={picture} />
        </Canvas>
      </View>
    </GestureDetector>
  );
}
