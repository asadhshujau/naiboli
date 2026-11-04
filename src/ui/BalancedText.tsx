/**
 * CSS `text-wrap: balance` for RN. Android has a native balanced break strategy; on iOS the text is
 * laid out once, then narrowed to its average line width so the lines come out even. If that adds a
 * line, it tries halfway back to the original width, and otherwise keeps the natural wrap.
 */
import { useState } from 'react';
import { Platform, Text, type TextLayoutEvent, type TextProps } from 'react-native';

type Props = Omit<TextProps, 'children'> & { children: string };

interface Fit {
  text: string;
  /** line count at full width */
  n: number;
  /** widest line at full width */
  full: number;
  /** current trial width (undefined = unconstrained) */
  w?: number;
  tries: number;
  done: boolean;
}

export function BalancedText({ children, style, onTextLayout, ...rest }: Props) {
  const ios = Platform.OS === 'ios';
  const [fit, setFit] = useState<Fit | null>(null);
  // Re-balance when the text changes (state reset during render).
  const cur = fit && fit.text === children ? fit : null;
  if (fit && !cur) setFit(null);

  const onLayout = (e: TextLayoutEvent) => {
    onTextLayout?.(e);
    if (!ios || cur?.done) return;
    const lines = e.nativeEvent.lines;
    if (!cur) {
      if (lines.length < 2) return setFit({ text: children, n: lines.length, full: 0, tries: 0, done: true });
      const total = lines.reduce((a, l) => a + l.width, 0);
      const full = Math.max(...lines.map((l) => l.width));
      return setFit({ text: children, n: lines.length, full, w: Math.ceil(total / lines.length) + 1, tries: 1, done: false });
    }
    if (lines.length <= cur.n) return setFit({ ...cur, done: true });
    if (cur.tries < 2 && cur.w != null) return setFit({ ...cur, w: Math.ceil((cur.w + cur.full) / 2), tries: cur.tries + 1 });
    setFit({ ...cur, w: undefined, done: true });
  };

  return (
    <Text {...rest} style={[style, cur?.w != null ? { maxWidth: cur.w } : null]} textBreakStrategy="balanced" onTextLayout={onLayout}>
      {children}
    </Text>
  );
}
