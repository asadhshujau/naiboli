/// <reference types="node" />
/**
 * Test-only harness: evaluates the logic script of the HTML prototype
 * (design_handoff_naiboli/design/Naiboli Scene Live.dc.html) so parity tests can compare
 * the native port against the original functions.
 */
import fs from 'fs';
import path from 'path';

const HTML = path.join(__dirname, '../../../design_handoff_naiboli/design/Naiboli Scene Live.dc.html');

type AnyFn = (...a: any[]) => any;

export interface Proto {
  /** a fresh prototype component (no mount, no timers) */
  make(): Record<string, AnyFn> & { state: any };
  setDay0(v: number): void;
  setSun(rise: number, set: number): void;
  getSun(): [number, number];
  setTide(t: unknown): void;
  ACTS: any[];
  MOODS: Record<string, any>;
  sunState: AnyFn;
  lightOf: AnyFn;
  tideAt: AnyFn;
  fmt: AnyFn;
  gloomOf: AnyFn;
  rainAmtOf: AnyFn;
  cloudNOf: AnyFn;
  owmIcon: AnyFn;
  owmCond: AnyFn;
}

/**
 * Deliberate changes from the prototype, applied to its script before comparing (find → replace):
 * - Scene rain from mm/h: steeper at the low end (`rainAmtOfMm` in src/data/weather.ts, 2026-11-07).
 */
const DEVIATIONS: [string, string][] = [['clamp(.25 + s.mm / 4, .25, 1)', '(0.2 + 0.8 * Math.sqrt(clamp(s.mm / 5, 0, 1)))']];

export function loadPrototype(): Proto {
  const html = fs.readFileSync(HTML, 'utf8');
  const m = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('prototype script not found');
  const script = DEVIATIONS.reduce((src, [from, to]) => {
    if (!src.includes(from)) throw new Error(`prototype deviation no longer applies: ${from}`);
    return src.replace(from, to);
  }, m[1]);
  class DCLogic {
    props: Record<string, unknown> = {};
    state: Record<string, unknown> = {};
    setState(p: any, cb?: () => void) {
      const v = typeof p === 'function' ? p(this.state) : p;
      this.state = { ...this.state, ...v };
      cb?.();
    }
    forceUpdate() {}
  }
  const localStorage = { getItem: () => null, setItem: () => {} };
  const React = { createRef: () => ({ current: null }) };
  const factory = new Function(
    'DCLogic',
    'React',
    'localStorage',
    `${script}
    return {
      Component, ACTS, MOODS, sunState, lightOf, tideAt, fmt, gloomOf, rainAmtOf, cloudNOf, owmIcon, owmCond,
      setDay0: (v) => { DAY0 = v; }, setSun: (r, s) => { RISE = r; SET = s; }, getSun: () => [RISE, SET], setTide: (t) => { TIDE = t; },
    };`,
  );
  const P = factory(DCLogic, React, localStorage);
  return { ...P, make: () => new P.Component() };
}
