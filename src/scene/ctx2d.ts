/**
 * A minimal CanvasRenderingContext2D look-alike over a Skia canvas, so the prototype's
 * `paint()` / `palm()` / `cloud()` port line-for-line. Runs on the UI thread (worklets).
 *
 * Covered: paths (moveTo/lineTo/quadraticCurveTo/bezierCurveTo/arc/ellipse/roundRect/closePath),
 * fill/stroke with colours or gradients, globalAlpha, lineWidth/lineCap, setLineDash/lineDashOffset,
 * clip, save/restore/translate/rotate/scale, fillRect, fillText/measureText (center/middle only).
 */
import { ClipOp, PaintStyle, Skia, StrokeCap, TileMode, type SkCanvas, type SkColor, type SkFont, type SkShader } from '@shopify/react-native-skia';

import type { RGB } from './palette';

const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;

/** Colour as the prototype's `rgb(c, a)`: channels truncated like `c | 0`. */
export function rgb(c: RGB, a = 1): SkColor {
  'worklet';
  return Skia.Color([(c[0] | 0) / 255, (c[1] | 0) / 255, (c[2] | 0) / 255, a]);
}

export interface Gradient {
  kind: 'linear' | 'radial';
  p: number[];
  stops: number[];
  colors: SkColor[];
  addColorStop(offset: number, color: SkColor): void;
}

export type Style = SkColor | Gradient;

interface State {
  fillStyle: Style;
  strokeStyle: Style;
  globalAlpha: number;
  lineWidth: number;
  lineCap: 'butt' | 'round';
  dash: number[] | null;
  lineDashOffset: number;
}

export interface Ctx2D extends State {
  font: SkFont | null;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw?: boolean): void;
  roundRect(x: number, y: number, w: number, h: number, r: number): void;
  fill(): void;
  stroke(): void;
  clip(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(rad: number): void;
  scale(x: number, y: number): void;
  setLineDash(d: number[]): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): Gradient;
}

function makeGradient(kind: 'linear' | 'radial', p: number[]): Gradient {
  'worklet';
  const g: Gradient = {
    kind,
    p,
    stops: [],
    colors: [],
    addColorStop(offset: number, color: SkColor) {
      g.stops.push(offset);
      g.colors.push(color);
    },
  };
  return g;
}

function shaderOf(g: Gradient): SkShader {
  'worklet';
  const p = g.p;
  if (g.kind === 'linear') {
    return Skia.Shader.MakeLinearGradient({ x: p[0], y: p[1] }, { x: p[2], y: p[3] }, g.colors, g.stops, TileMode.Clamp);
  }
  if (p[2] === 0 && p[0] === p[3] && p[1] === p[4]) {
    return Skia.Shader.MakeRadialGradient({ x: p[0], y: p[1] }, p[5], g.colors, g.stops, TileMode.Clamp);
  }
  return Skia.Shader.MakeTwoPointConicalGradient({ x: p[0], y: p[1] }, p[2], { x: p[3], y: p[4] }, p[5], g.colors, g.stops, TileMode.Clamp);
}

/** Canvas `arc()` sweep rules → signed sweep in radians. */
function sweepOf(a0: number, a1: number, ccw: boolean): number {
  'worklet';
  let sw = a1 - a0;
  if (!ccw) {
    if (sw >= TAU) return TAU;
    sw = sw % TAU;
    if (sw < 0) sw += TAU;
  } else {
    if (-sw >= TAU) return -TAU;
    sw = sw % TAU;
    if (sw > 0) sw -= TAU;
  }
  return sw;
}

export function makeCtx(canvas: SkCanvas): Ctx2D {
  'worklet';
  const stack: State[] = [];

  const paintFor = (style: Style, alpha: number) => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    if ((style as Gradient).kind) {
      p.setShader(shaderOf(style as Gradient));
      p.setAlphaf(alpha);
    } else {
      const c = style as SkColor;
      p.setColor(c);
      p.setAlphaf(c[3] * alpha);
    }
    return p;
  };

  // Paths are accumulated as an SVG path string in JS and turned into one SkPath per
  // fill/stroke/clip — a single JSI call instead of one per point (~3k → ~150 calls a frame).
  let d = '';
  let hasPt = false;
  const build = () => (d ? Skia.Path.MakeFromSVGString(d) : null);
  const ensure = (x: number, y: number) => {
    if (!hasPt) {
      d += `M${x} ${y}`;
      hasPt = true;
    }
  };

  // Canvas arc/ellipse: line from the current point to the arc start, then the arc (as SVG arcs).
  const arcOval = (x: number, y: number, rx: number, ry: number, a0: number, a1: number, ccw: boolean) => {
    const sw = sweepOf(a0, a1, ccw);
    const x0 = x + rx * Math.cos(a0);
    const y0 = y + ry * Math.sin(a0);
    if (hasPt) d += `L${x0} ${y0}`;
    else {
      d += `M${x0} ${y0}`;
      hasPt = true;
    }
    if (sw === 0) return;
    const seg = (from: number, by: number) => {
      const e = from + by;
      const ex = x + rx * Math.cos(e);
      const ey = y + ry * Math.sin(e);
      d += `A${rx} ${ry} 0 ${Math.abs(by) > Math.PI ? 1 : 0} ${by > 0 ? 1 : 0} ${ex} ${ey}`;
    };
    if (Math.abs(sw) >= TAU) {
      // full turn: two halves (an SVG arc can't end where it starts)
      seg(a0, sw / 2);
      seg(a0 + sw / 2, sw / 2);
    } else seg(a0, sw);
  };

  const ctx: Ctx2D = {
    fillStyle: Skia.Color([0, 0, 0, 1]),
    strokeStyle: Skia.Color([0, 0, 0, 1]),
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: 'butt',
    dash: null,
    lineDashOffset: 0,
    font: null,

    beginPath() {
      d = '';
      hasPt = false;
    },
    closePath() {
      if (!hasPt) return;
      d += 'Z';
    },
    moveTo(x, y) {
      d += `M${x} ${y}`;
      hasPt = true;
    },
    lineTo(x, y) {
      if (!hasPt) ctx.moveTo(x, y);
      else {
        d += `L${x} ${y}`;
      }
    },
    quadraticCurveTo(qx, qy, x, y) {
      ensure(qx, qy);
      d += `Q${qx} ${qy} ${x} ${y}`;
    },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      ensure(c1x, c1y);
      d += `C${c1x} ${c1y} ${c2x} ${c2y} ${x} ${y}`;
    },
    arc(x, y, r, a0, a1, ccw = false) {
      arcOval(x, y, r, r, a0, a1, ccw);
    },
    ellipse(x, y, rx, ry, _rot, a0, a1, ccw = false) {
      arcOval(x, y, rx, ry, a0, a1, ccw);
    },
    roundRect(x, y, w, h, r) {
      d +=
        `M${x + r} ${y}L${x + w - r} ${y}A${r} ${r} 0 0 1 ${x + w} ${y + r}L${x + w} ${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
        `L${x + r} ${y + h}A${r} ${r} 0 0 1 ${x} ${y + h - r}L${x} ${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
      hasPt = true;
    },
    fill() {
      const p = build();
      if (p) canvas.drawPath(p, paintFor(ctx.fillStyle, ctx.globalAlpha));
    },
    stroke() {
      const p = paintFor(ctx.strokeStyle, ctx.globalAlpha);
      p.setStyle(PaintStyle.Stroke);
      p.setStrokeWidth(ctx.lineWidth);
      p.setStrokeMiter(10);
      p.setStrokeCap(ctx.lineCap === 'round' ? StrokeCap.Round : StrokeCap.Butt);
      if (ctx.dash) p.setPathEffect(Skia.PathEffect.MakeDash(ctx.dash, ctx.lineDashOffset));
      const path = build();
      if (path) canvas.drawPath(path, p);
    },
    clip() {
      const p = build() ?? Skia.Path.Make();
      canvas.clipPath(p, ClipOp.Intersect, true);
    },
    fillRect(x, y, w, h) {
      if (w < 0) {
        x += w;
        w = -w;
      }
      if (h < 0) {
        y += h;
        h = -h;
      }
      canvas.drawRect(Skia.XYWHRect(x, y, w, h), paintFor(ctx.fillStyle, ctx.globalAlpha));
    },
    fillText(text, x, y) {
      const f = ctx.font;
      if (!f) return;
      const m = f.getMetrics();
      const w = ctx.measureText(text).width;
      // textAlign 'center', textBaseline 'middle'
      canvas.drawText(text, x - w / 2, y - (m.ascent + m.descent) / 2, paintFor(ctx.fillStyle, ctx.globalAlpha), f);
    },
    measureText(text) {
      const f = ctx.font;
      if (!f || !text) return { width: 0 };
      const ws = f.getGlyphWidths(f.getGlyphIDs(text));
      let w = 0;
      for (let i = 0; i < ws.length; i++) w += ws[i];
      return { width: w };
    },
    save() {
      stack.push({
        fillStyle: ctx.fillStyle,
        strokeStyle: ctx.strokeStyle,
        globalAlpha: ctx.globalAlpha,
        lineWidth: ctx.lineWidth,
        lineCap: ctx.lineCap,
        dash: ctx.dash,
        lineDashOffset: ctx.lineDashOffset,
      });
      canvas.save();
    },
    restore() {
      const s = stack.pop();
      if (s) {
        ctx.fillStyle = s.fillStyle;
        ctx.strokeStyle = s.strokeStyle;
        ctx.globalAlpha = s.globalAlpha;
        ctx.lineWidth = s.lineWidth;
        ctx.lineCap = s.lineCap;
        ctx.dash = s.dash;
        ctx.lineDashOffset = s.lineDashOffset;
      }
      canvas.restore();
    },
    translate(x, y) {
      canvas.translate(x, y);
    },
    rotate(rad) {
      canvas.rotate(rad * DEG, 0, 0);
    },
    scale(x, y) {
      canvas.scale(x, y);
    },
    setLineDash(d) {
      ctx.dash = d.length ? d : null;
    },
    createLinearGradient(x0, y0, x1, y1) {
      return makeGradient('linear', [x0, y0, x1, y1]);
    },
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      return makeGradient('radial', [x0, y0, r0, x1, y1, r1]);
    },
  };
  return ctx;
}
