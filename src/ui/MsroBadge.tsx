/**
 * "Powered by MSRO" badge — a bundled copy of https://geohub.msro.mv/badges/powered-by-msro.svg
 * (176 × 28), drawn with react-native-svg.
 */
import { memo } from 'react';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop, Text } from 'react-native-svg';

export const MsroBadge = memo(function MsroBadge({ height }: { height: number }) {
  return (
    <Svg width={(height * 176) / 28} height={height} viewBox="0 0 176 28" accessibilityLabel="Powered by MSRO">
      <Defs>
        <LinearGradient id="msro-bg" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#0f172a" />
          <Stop offset="1" stopColor="#1e293b" />
        </LinearGradient>
        <LinearGradient id="msro-accent" x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor="#22d3ee" />
          <Stop offset="1" stopColor="#0ea5e9" />
        </LinearGradient>
      </Defs>
      <Rect width="176" height="28" rx="6" fill="url(#msro-bg)" />
      <Rect x="92" width="84" height="28" rx="6" fill="url(#msro-accent)" />
      <Rect x="92" width="6" height="28" fill="url(#msro-accent)" />
      <G transform="translate(10,7)" fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round">
        <Path d="M0 10 Q3 6 6 10 T12 10 T18 10" />
        <Path d="M0 14 Q3 10 6 14 T12 14 T18 14" opacity="0.7" />
      </G>
      <G fontSize="11">
        <Text x="34" y="18" fill="#e2e8f0" fontWeight="500">
          Powered by
        </Text>
        <Text x="134" y="18" fill="#0f172a" fontWeight="700" textAnchor="middle" letterSpacing="0.5">
          MSRO
        </Text>
      </G>
    </Svg>
  );
});
