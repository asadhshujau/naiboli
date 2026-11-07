/** Weather: warning, hero, next 24 hours, next 8 days, stat grid, sun and moon cards, attribution. */
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { WxFocus, WxView } from '@/state/sheets';
import { themed, useDayTheme } from '@/ui/dayTheme';
import { T } from '@/ui/fonts';
import { Icon } from '@/ui/Icon';
import { C } from '@/ui/theme';

import { useFocusRef } from './Sheet';
import { Card, CardTitle, openLink, Press, SheetHeader, StatLabel, usePartStyles, useSep } from './parts';

interface Props {
  wx: WxView;
  focus: WxFocus | null;
  onClose: () => void;
}

/** A card the sheet can scroll to and ring when opened from a bubble. */
function Focusable({ k, focus, style, children }: { k: WxFocus; focus: WxFocus | null; style: object | object[]; children: ReactNode }) {
  const P = usePartStyles();
  const ref = useFocusRef(k);
  return (
    <View ref={ref} collapsable={false} style={[style, focus === k ? P.ring : P.cardShadow]}>
      {children}
    </View>
  );
}

function Stat({ k, focus, icon, label, value, unit, line, children }: { k: WxFocus; focus: WxFocus | null; icon: string; label: string; value: number; unit: string; line: string; children?: ReactNode }) {
  const s = useS();
  return (
    <Focusable k={k} focus={focus} style={s.stat}>
      <StatLabel icon={icon}>{label}</StatLabel>
      <View style={s.statValueRow}>
        <Text style={s.statValue}>{value}</Text>
        <Text style={s.unit}>{unit}</Text>
      </View>
      {children}
      <Text style={[s.statLine, { marginTop: children ? 8 : 6 }]}>{line}</Text>
    </Focusable>
  );
}

export function WxSheet({ wx, focus, onClose }: Props) {
  const s = useS();
  const P = usePartStyles();
  const t = useDayTheme();
  const { c } = t;
  const sep = useSep();
  const [arcW, setArcW] = useState(0);
  const pairs: ReactNode[][] = [];
  const stats: ReactNode[] = [
    <Focusable key="wind" k="wind" focus={focus} style={s.stat}>
      <StatLabel icon="air">Wind</StatLabel>
      <View style={s.windRow}>
        <Text style={s.statValue}>{wx.wind}</Text>
        <Text style={[s.unit, s.windUnit]}>km/h</Text>
        <View style={s.arrow}>
          <Icon name="navigation" size={18} color={c.teal} fill rotate={wx.arrow} />
        </View>
      </View>
      <Text style={s.windWord}>{wx.windWord}</Text>
      <Text style={s.statLine}>
        From {wx.dir} · gusts {wx.gust}
      </Text>
    </Focusable>,
    <Focusable key="uv" k="uv" focus={focus} style={s.stat}>
      <StatLabel icon="light_mode">UV index</StatLabel>
      <View style={[s.statValueRow, s.gap6]}>
        <Text style={s.statValue}>{wx.uv}</Text>
        <Text style={s.unit}>{wx.uvWord}</Text>
      </View>
      <View style={s.uvBar}>
        <View style={[s.uvMark, { left: `${wx.uvPct}%` }]} />
      </View>
      <Text style={[s.statLine, { marginTop: 8 }]}>{wx.uvLine}</Text>
    </Focusable>,
    <Stat key="rain" k="rain" focus={focus} icon="rainy" label="Rain" value={wx.rain} unit="% chance" line={wx.rainLine} />,
    <Stat key="hum" k="hum" focus={focus} icon="humidity_percentage" label="Humidity" value={wx.hum} unit="%" line={wx.humWord} />,
    <Stat key="sky" k="sky" focus={focus} icon="cloud" label="Clouds" value={wx.clouds} unit="% cover" line={wx.cloudLine} />,
    <Stat key="vis" k="vis" focus={focus} icon="visibility" label="Visibility" value={wx.vis} unit="km" line={wx.visLine} />,
  ];
  for (let i = 0; i < stats.length; i += 2) pairs.push(stats.slice(i, i + 2));

  return (
    <>
      <SheetHeader eyebrow={wx.eyebrow} title="Weather" onClose={onClose} />

      {wx.hasWarning ? (
        <Focusable k="warning" focus={focus} style={s.warn}>
          <Icon name="warning" size={22} color={c.warnIcon} fill />
          <View style={s.flexShrink}>
            <Text style={s.tx_bric700_16_warnInk}>
              {wx.warnTitle} · {wx.warnFrom ? `${wx.warnFrom} to ${wx.warnUntil}` : `until ${wx.warnUntil}`}
            </Text>
            <Text style={s.warnBody}>{wx.warnBody}</Text>
          </View>
        </Focusable>
      ) : null}

      <Focusable k="temp" focus={focus} style={[s.hero, t.bgS(wx.heroBg)]}>
        <View style={s.heroTop}>
          <Text style={s.tx_bric800_92lh0_84lsm0_06_ink}>{wx.temp}°</Text>
          <View style={s.heroTile}>
            <Icon name={wx.icon} size={38} color={t.fg(wx.tint)} fill />
          </View>
        </View>
        <Text style={s.cond}>{wx.cond}</Text>
        <Text style={s.feels}>
          Feels like {wx.feels}° · High {wx.hi}° · Low {wx.lo}°
        </Text>
      </Focusable>

      <Card style={s.hourCard}>
        <View style={s.px16}>
          <CardTitle>Next 24 hours</CardTitle>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hours}>
          {wx.hourly.map((hr, i) => (
            <View key={i} style={[s.hour, t.bgS(hr.bg)]}>
              <Text style={[s.tx_mono10_5, t.fgS(hr.sub)]}>{hr.label}</Text>
              <Icon name={hr.icon} size={22} color={t.fg(hr.ic)} fill />
              <Text style={[s.tx_bric700_16, t.fgS(hr.ink)]}>{hr.temp}°</Text>
              <Text style={[s.tx_mono10_5, t.fgS(hr.rc)]}>{hr.rain}</Text>
              {wx.hasMm ? <Text style={[s.hourMm, t.fgS(hr.sub)]}>{hr.mm || ' '}</Text> : null}
            </View>
          ))}
        </ScrollView>
      </Card>

      {wx.hasWeek ? (
        <View style={s.week}>
          <View style={s.weekHead}>
            <CardTitle>Next 8 days</CardTitle>
            <Text style={s.weekLine}>{wx.weekLine}</Text>
          </View>
          {wx.days.map((dy, i) => (
            <View key={i} style={[s.day, sep(dy.sep), dy.sel ? s.daySel : null]}>
              <Text style={s.dayLabel} numberOfLines={1}>
                {dy.label}
              </Text>
              <View style={s.w24}>
                <Icon name={dy.icon} size={22} color={t.fg(dy.ic)} fill />
              </View>
              <View style={s.dayRainCol}>
                <Text style={s.dayRain}>{dy.rain}</Text>
                {dy.mm ? <Text style={s.dayMm}>{dy.mm}</Text> : null}
              </View>
              <Text style={s.dayLo}>{dy.lo}°</Text>
              <View style={s.range}>
                <View style={[s.rangeFill, { left: `${dy.l}%`, width: `${dy.w}%` }]} />
              </View>
              <Text style={s.dayHi}>{dy.hi}°</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={s.grid}>
        {pairs.map((row, i) => (
          <View key={i} style={s.gridRow}>
            {row}
          </View>
        ))}

        <Focusable k="sun" focus={focus} style={s.wide}>
          <View style={s.sunHead}>
            <StatLabel icon="wb_twilight">Sun</StatLabel>
            <Text style={s.tx_fig600_13_secondary}>{wx.sunLine}</Text>
          </View>
          <View style={s.arc} onLayout={(e) => setArcW(e.nativeEvent.layout.width)}>
            {/* CSS overflow:visible: the box extends 3 units down so the sun at the horizon isn't clipped */}
            {arcW ? (
              <Svg width={arcW} height={(arcW * 95) / 300} viewBox="0 0 300 95">
                <Path d="M 12 84 Q 150 -36 288 84" fill="none" stroke={c.arc} strokeWidth={2} strokeDasharray="4 5" />
                <Line x1={0} y1={84} x2={300} y2={84} stroke={c.arc} strokeWidth={1.5} />
                <Circle cx={wx.sunX} cy={wx.sunY} r={9} opacity={wx.sunO} fill={C.sun} stroke={c.dot} strokeWidth={3} />
              </Svg>
            ) : null}
          </View>
          <View style={[s.riseSet, { marginTop: 6 - (arcW * 3) / 300 }]}>
            <View>
              <Text style={P.eyebrow}>Sunrise</Text>
              <Text style={s.time}>{wx.rise}</Text>
            </View>
            <View style={s.right}>
              <Text style={P.eyebrow}>Sunset</Text>
              <Text style={s.time}>{wx.set}</Text>
            </View>
          </View>
        </Focusable>

        <Focusable k="moon" focus={focus} style={s.wide}>
          <StatLabel icon="bedtime">Moon</StatLabel>
          <View style={s.moonRow}>
            <Svg width={68} height={68} viewBox="0 0 100 100">
              <Circle cx={50} cy={50} r={40} fill="#1E3058" />
              <Path d={wx.moon.svg} fill="#F6EFD8" />
            </Svg>
            <View style={s.flexShrink}>
              <Text style={s.tx_bric800_24lh1_05lsm0_025_ink}>{wx.moon.name}</Text>
              <Text style={s.moonLine}>
                {wx.moon.illum}% lit · {wx.moon.nextTxt}
              </Text>
            </View>
          </View>
          <View style={[s.riseSet, { marginTop: 14 }]}>
            <View>
              <Text style={P.eyebrow}>Moonrise</Text>
              <Text style={s.time}>{wx.moon.rise}</Text>
            </View>
            <View style={s.right}>
              <Text style={P.eyebrow}>Moonset</Text>
              <Text style={s.time}>{wx.moon.set}</Text>
            </View>
          </View>
        </Focusable>
      </View>

      <Press onPress={() => openLink('https://openweathermap.org/')} style={s.attrib} accessibilityRole="link" accessibilityLabel="Weather data provided by OpenWeather">
        <View style={s.logoGround}>
          <Image source={require('../../../assets/images/openweather-logo.png')} style={s.owLogo} contentFit="contain" />
        </View>
        <Text style={s.tx_fig500_12_5_secondary}>Weather data provided by OpenWeather</Text>
      </Press>
    </>
  );
}

const useS = themed((c, t) =>
  StyleSheet.create({
    tx_bric700_16: T.bric(700, 16),
    tx_bric700_16_warnInk: T.bric(700, 16, { color: c.warnInk }),
    tx_bric800_24lh1_05lsm0_025_ink: T.bric(800, 24, { lh: 1.05, ls: -0.025, color: c.ink }),
    tx_bric800_92lh0_84lsm0_06_ink: T.bric(800, 92, { lh: 0.84, ls: -0.06, color: c.ink }),
    tx_fig500_12_5_secondary: T.fig(500, 12.5, { color: c.secondary }),
    tx_fig600_13_secondary: T.fig(600, 13, { color: c.secondary }),
    tx_mono10_5: T.mono(10.5),
    flexShrink: { flexShrink: 1 },
    px16: { paddingHorizontal: 16 },
    w24: { width: 24 },
    right: { alignItems: 'flex-end' },
    warn: { marginTop: 16, padding: 16, borderRadius: 24, backgroundColor: c.warnBg, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    warnBody: { marginTop: 4, ...T.fig(500, 14, { lh: 1.45, color: c.warnBody }) },
    hero: { marginTop: 16, borderRadius: 28, padding: 20 },
    heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    heroTile: { width: 64, height: 64, borderRadius: 22, backgroundColor: c.heroTile, alignItems: 'center', justifyContent: 'center' },
    cond: { marginTop: 14, ...T.bric(700, 22, { ls: -0.02, color: c.ink }) },
    feels: { marginTop: 4, ...T.fig(500, 14, { lh: 1.4, color: c.bodySecondary }) },
    hourCard: { marginTop: 12, paddingHorizontal: 0 },
    hours: { gap: 6, paddingTop: 12, paddingHorizontal: 12 },
    hour: { width: 52, alignItems: 'center', gap: 7, paddingVertical: 10, borderRadius: 16 },
    hourMm: { marginTop: -4, ...T.mono(9.5) },
    week: { marginTop: 12, borderRadius: 24, backgroundColor: c.card, overflow: 'hidden', boxShadow: c.cardShadow },
    weekHead: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 10 },
    weekLine: { marginTop: 3, ...T.fig(500, 13, { lh: 1.4, color: c.secondary }) },
    day: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16 },
    daySel: { backgroundColor: c.selectedRow },
    dayLabel: { width: 56, ...T.fig(700, 14, { color: c.ink }) },
    dayRainCol: { width: 34 },
    dayRain: T.mono(10.5, { color: t.fg(C.rainBlue) }),
    dayMm: { marginTop: 1, ...T.mono(9.5, { color: c.secondary }) },
    dayLo: { width: 28, textAlign: 'right', ...T.fig(600, 14, { color: c.secondary }) },
    range: { flex: 1, minWidth: 0, height: 6, borderRadius: 3, backgroundColor: c.button },
    rangeFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3, backgroundImage: 'linear-gradient(90deg, #7FD3CF, #FFC83D)' },
    dayHi: { width: 28, ...T.bric(700, 15, { color: c.ink }) },
    grid: { marginTop: 12, gap: 10 },
    gridRow: { flexDirection: 'row', gap: 10 },
    stat: { flex: 1, minWidth: 0, padding: 16, borderRadius: 24, backgroundColor: c.card, gap: 4 },
    gap6: { gap: 6 },
    statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 8 },
    statValue: T.bric(800, 32, { lh: 1, ls: -0.03, color: c.ink }),
    unit: T.fig(600, 13, { color: c.secondary }),
    windRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
    windUnit: { alignSelf: 'flex-end', paddingBottom: 3 },
    arrow: { marginLeft: 'auto', width: 30, height: 30, borderRadius: 15, backgroundColor: c.tealTint, alignItems: 'center', justifyContent: 'center' },
    windWord: { marginTop: 6, ...T.fig(600, 13.5, { lh: 1.35, color: c.ink }) },
    statLine: T.fig(500, 12.5, { lh: 1.35, color: c.secondary }),
    uvBar: {
      height: 6,
      borderRadius: 3,
      marginTop: 10,
      backgroundImage: 'linear-gradient(90deg, #17B890, #FFC83D 40%, #FF7350 75%, #B04BD6)',
    },
    uvMark: {
      position: 'absolute',
      top: 3,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#FFFFFF',
      boxShadow: `0 0 0 2px ${t.dark ? c.card : c.ink}`,
      transform: [{ translateX: -6 }, { translateY: -6 }],
    },
    wide: { padding: 16, borderRadius: 24, backgroundColor: c.card },
    sunHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    arc: { marginTop: 10 },
    riseSet: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
    time: { marginTop: 2, ...T.bric(700, 18, { color: c.ink }) },
    moonRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
    moonLine: { marginTop: 4, ...T.fig(500, 13.5, { lh: 1.4, color: c.secondary }) },
    attrib: { alignSelf: 'center', alignItems: 'center', gap: 8, marginTop: 16 },
    owLogo: { height: 40, width: (40 * 433) / 188 },
    logoGround: t.dark ? { backgroundColor: c.logoGround, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 } : {},
  }),
);
