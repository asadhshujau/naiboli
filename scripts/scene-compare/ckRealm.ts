import { Skia } from '@shopify/react-native-skia';

export function patchCanvasKitRealm() {
  // Jest's VM realm and CanvasKit's realm have different Float32Array constructors, so CanvasKit
  // rejects gradient colour arrays made in the test realm. Re-create them in CanvasKit's realm.
  const CK = (globalThis as unknown as { CanvasKit: { Color4f: (r: number, g: number, b: number, a: number) => Float32Array } }).CanvasKit;
  const F32 = CK.Color4f(0, 0, 0, 0).constructor as Float32ArrayConstructor;
  const fix = (cs: ArrayLike<number>[]) => {
    const flat = new F32(cs.length * 4);
    cs.forEach((c, i) => flat.set([c[0], c[1], c[2], c[3]], i * 4));
    return flat;
  };
  const SF = Skia.Shader as unknown as Record<string, (...a: unknown[]) => unknown>;
  for (const [k, ci] of [['MakeLinearGradient', 2], ['MakeRadialGradient', 2], ['MakeTwoPointConicalGradient', 4]] as const) {
    const orig = SF[k].bind(SF);
    SF[k] = (...a: unknown[]) => {
      a[ci] = fix(a[ci] as ArrayLike<number>[]);
      return orig(...a);
    };
  }
}
