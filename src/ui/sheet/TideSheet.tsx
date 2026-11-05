/** Tide: level hero, 24 h chart with highs/lows, next 4 tides, beach / lagoon, tip, MSRO badge. */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import type { TdView } from '@/state/sheets';
import { themed, useDayTheme } from '@/ui/dayTheme';
import { T } from '@/ui/fonts';
import { Icon } from '@/ui/Icon';
import { MsroBadge } from '@/ui/MsroBadge';

import { Anchored, Card, CardTitle, openLink, Press, SheetHeader, StatLabel, TipCard, useSep } from './parts';

const CHART_H = 150;

export function TideSheet({ td, onClose }: { td: TdView; onClose: () => void }) {
  const s = useS();
  const t = useDayTheme();
  const { c } = t;
  const sep = useSep();
  const [w, setW] = useState(0);
  const px = (pct: number) => (pct / 100) * w;
  return (
    <>
      <SheetHeader eyebrow={td.eyebrow} title="Tide" onClose={onClose} />

      <View style={s.hero}>
        <Text style={s.tx_mono11ls0_09up_tealDark}>Tide level</Text>
        <View style={s.levelRow}>
          <Text style={s.tx_bric800_66lh1lsm0_05_ink}>{td.levelText}</Text>
          <Text style={s.unit}>m</Text>
        </View>
        <View style={s.dirRow}>
          <Icon name={td.dirIcon} size={22} color={c.ink} />
          <Text style={s.tx_fig700_15_ink}>
            {td.dirText} until {td.until}
          </Text>
        </View>
        <Text style={s.src}>{td.src}</Text>
      </View>

      <Card style={s.chartCard}>
        <View style={s.chartHead}>
          <CardTitle>Next 24 hours</CardTitle>
          <Text style={s.tx_mono11_secondary}>metres</Text>
        </View>
        <View style={s.chart} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {w ? (
            <>
              {/* CSS overflow:visible: 1.5 dp (the cap radius) wider each side so the round caps aren't clipped */}
              <Svg
                width={w + 3}
                height={CHART_H}
                viewBox={`${(-1.5 * 354) / w} 0 ${354 + (3 * 354) / w} 150`}
                preserveAspectRatio="none"
                style={[s.abs, { left: -1.5 }]}>
                <Path d={td.area} fill={c.tealArea} />
                <Path d={td.line} fill="none" stroke={c.tealLine} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </Svg>
              <Svg width={w} height={CHART_H} style={[s.abs, s.nowLine]}>
                <Line x1={px(td.nowPct) + 0.75} y1={0} x2={px(td.nowPct) + 0.75} y2={CHART_H} stroke={c.ink} strokeWidth={1.5} strokeDasharray="4.5 4.5" />
              </Svg>
              {td.marks.map((tm, i) => (
                <View key={i} style={StyleSheet.absoluteFill} pointerEvents="none">
                  <View style={[s.mark, { left: px(tm.x) - 4, top: tm.y - 4, backgroundColor: tm.c }]} />
                  <Anchored left={px(tm.x)} top={tm.ly} tx={tm.tx}>
                    <Text style={s.tx_mono10_5_ink} numberOfLines={1}>
                      {tm.label}
                    </Text>
                  </Anchored>
                </View>
              ))}
              <View style={[s.now, { left: px(td.nowPct) - 7, top: td.nowY - 7 }]} />
            </>
          ) : null}
        </View>
        <View style={s.axis}>
          {w
            ? td.axis.map((ax, i) => (
                <Anchored key={i} left={px(ax.x)} tx={ax.tx}>
                  <Text style={s.tx_mono10_5_secondary} numberOfLines={1}>
                    {ax.label}
                  </Text>
                </Anchored>
              ))
            : null}
        </View>
      </Card>

      <View style={s.list}>
        {td.next.map((tx, i) => (
          <View key={i} style={[s.row, sep(tx.sep)]}>
            <View style={[s.tile, t.bgS(tx.icBg)]}>
              <Icon name={tx.icon} size={20} color={t.fg(tx.ic)} fill />
            </View>
            <View style={s.mid}>
              <Text style={s.tx_fig700_15_ink}>{tx.kind}</Text>
              <Text style={s.tx_fig500_12_5_secondary}>{tx.time}</Text>
            </View>
            <Text style={s.tx_bric700_16_ink}>{tx.lvl}</Text>
          </View>
        ))}
      </View>

      <View style={s.pair}>
        <Card style={s.stat}>
          <StatLabel icon="beach_access">Beach</StatLabel>
          <Text style={s.statValue}>{td.beach}</Text>
          <Text style={s.statLine}>{td.beachLine}</Text>
        </Card>
        <Card style={s.stat}>
          <StatLabel icon="waves">Lagoon</StatLabel>
          <Text style={s.statValue}>{td.lagoon}</Text>
          <Text style={s.statLine}>{td.lagoonLine}</Text>
        </Card>
      </View>

      <TipCard text="Sandbanks shrink fast at high water. Plan reef walks and sandbank trips around low tide." />

      <Press onPress={() => openLink('https://geohub.msro.mv')} style={s.badge} accessibilityRole="link" accessibilityLabel="Powered by MSRO">
        <MsroBadge height={24} />
      </Press>
    </>
  );
}

const useS = themed((c) =>
  StyleSheet.create({
    tx_bric700_16_ink: T.bric(700, 16, { color: c.ink }),
    tx_bric800_66lh1lsm0_05_ink: T.bric(800, 66, { lh: 1, ls: -0.05, color: c.ink }),
    tx_fig500_12_5_secondary: T.fig(500, 12.5, { color: c.secondary }),
    tx_fig700_15_ink: T.fig(700, 15, { color: c.ink }),
    tx_mono10_5_ink: T.mono(10.5, { color: c.ink }),
    tx_mono10_5_secondary: T.mono(10.5, { color: c.secondary }),
    tx_mono11_secondary: T.mono(11, { color: c.secondary }),
    tx_mono11ls0_09up_tealDark: T.mono(11, { ls: 0.09, upper: true, color: c.tealDark }),
    abs: { position: 'absolute', left: 0, top: 0 },
    hero: { marginTop: 16, borderRadius: 28, padding: 20, backgroundColor: c.tealTint },
    levelRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
    unit: { marginLeft: 4, ...T.bric(700, 26, { color: c.ink }) },
    dirRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    src: { marginTop: 6, ...T.fig(500, 13, { lh: 1.4, color: c.tealDark }) },
    chartCard: { marginTop: 12, paddingTop: 18, paddingHorizontal: 18, paddingBottom: 14 },
    chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    chart: { height: CHART_H, marginTop: 16 },
    nowLine: { opacity: 0.4 },
    mark: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
    now: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: c.dot, borderWidth: 3, borderColor: c.ink },
    axis: { height: 18, marginTop: 8 },
    list: { marginTop: 12, borderRadius: 24, backgroundColor: c.card, overflow: 'hidden', boxShadow: c.cardShadow },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    tile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    mid: { flex: 1, minWidth: 0, gap: 1 },
    pair: { flexDirection: 'row', gap: 10, marginTop: 12 },
    stat: { flex: 1, minWidth: 0, gap: 4 },
    statValue: { marginTop: 8, ...T.bric(800, 26, { lh: 1.05, ls: -0.03, color: c.ink }) },
    statLine: { marginTop: 4, ...T.fig(500, 12.5, { lh: 1.35, color: c.secondary }) },
    badge: { alignSelf: 'center', marginTop: 16 },
  }),
);
