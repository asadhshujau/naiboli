/** Weather: warning, hero, next 24 hours, next 8 days, stat grid, sun and moon cards, attribution. */
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { WxFocus, WxView } from '@/state/sheets';
import { T } from '@/ui/fonts';
import { Icon } from '@/ui/Icon';
import { C } from '@/ui/theme';

import { useFocusRef } from './Sheet';
import { Card, CardTitle, openLink, Press, SheetHeader, StatLabel, s as P, sepStyle } from './parts';

interface Props {
  wx: WxView;
  focus: WxFocus | null;
  onClose: () => void;
}

/** A card the sheet can scroll to and ring when opened from a bubble. */
function Focusable({ k, focus, style, children }: { k: WxFocus; focus: WxFocus | null; style: object | object[]; children: ReactNode }) {
  const ref = useFocusRef(k);
  return (
    <View ref={ref} collapsable={false} style={[style, focus === k ? P.ring : P.cardShadow]}>
      {children}
    </View>
  );
}

function Stat({ k, focus, icon, label, value, unit, line, children }: { k: WxFocus; focus: WxFocus | null; icon: string; label: string; value: number; unit: string; line: string; children?: ReactNode }) {
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
  const [arcW, setArcW] = useState(0);
  const pairs: ReactNode[][] = [];
  const stats: ReactNode[] = [
    <Focusable key="wind" k="wind" focus={focus} style={s.stat}>
      <StatLabel icon="air">Wind</StatLabel>
      <View style={s.windRow}>
        <Text style={s.statValue}>{wx.wind}</Text>
        <Text style={[s.unit, s.windUnit]}>km/h</Text>
        <View style={s.arrow}>
          <Icon name="navigation" size={18} color={C.teal} fill rotate={wx.arrow} />
        </View>
      </View>
      <Text style={s.windWord}>{wx.windWord}</Text>
      <Text style={s.statLine}>
        From {wx.dir} · gusts {wx.gust}
      </Text>
    </Focusable>,
    <Focusable key="uv" k="uv" focus={focus} style={s.stat}>
      <StatLabel icon="light_mode">UV index</StatLabel>
      <View style={s.statValueRow}>
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
          <Icon name="warning" size={22} color={C.warnIcon} fill />
          <View style={s.flexShrink}>
            <Text style={T.bric(700, 16, { color: C.warnInk })}>
              {wx.warnTitle} · until {wx.warnUntil}
            </Text>
            <Text style={s.warnBody}>{wx.warnBody}</Text>
          </View>
        </Focusable>
      ) : null}

      <Focusable k="temp" focus={focus} style={[s.hero, { backgroundColor: wx.heroBg }]}>
        <View style={s.heroTop}>
          <Text style={T.bric(800, 92, { lh: 0.84, ls: -0.06, color: C.ink })}>{wx.temp}°</Text>
          <View style={s.heroTile}>
            <Icon name={wx.icon} size={38} color={wx.tint} fill />
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
            <View key={i} style={[s.hour, { backgroundColor: hr.bg }]}>
              <Text style={T.mono(10.5, { color: hr.sub })}>{hr.label}</Text>
              <Icon name={hr.icon} size={22} color={hr.ic} fill />
              <Text style={T.bric(700, 16, { color: hr.ink })}>{hr.temp}°</Text>
              <Text style={T.mono(10.5, { color: hr.rc })}>{hr.rain}</Text>
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
            <View key={i} style={[s.day, sepStyle(dy.sep), dy.sel ? s.daySel : null]}>
              <Text style={s.dayLabel} numberOfLines={1}>
                {dy.label}
              </Text>
              <View style={s.w24}>
                <Icon name={dy.icon} size={22} color={dy.ic} fill />
              </View>
              <Text style={s.dayRain}>{dy.rain}</Text>
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
            <Text style={T.fig(600, 13, { color: C.secondary })}>{wx.sunLine}</Text>
          </View>
          <View style={s.arc} onLayout={(e) => setArcW(e.nativeEvent.layout.width)}>
            {arcW ? (
              <Svg width={arcW} height={(arcW * 92) / 300} viewBox="0 0 300 92" style={s.visible}>
                <Path d="M 12 84 Q 150 -36 288 84" fill="none" stroke={C.arc} strokeWidth={2} strokeDasharray="4 5" />
                <Line x1={0} y1={84} x2={300} y2={84} stroke={C.arc} strokeWidth={1.5} />
                <Circle cx={wx.sunX} cy={wx.sunY} r={9} opacity={wx.sunO} fill={C.sun} stroke="#FFFFFF" strokeWidth={3} />
              </Svg>
            ) : null}
          </View>
          <View style={s.riseSet}>
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
              <Text style={T.bric(800, 24, { lh: 1.05, ls: -0.025, color: C.ink })}>{wx.moon.name}</Text>
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
        <Image source={require('../../../assets/images/openweather-logo.png')} style={s.owLogo} contentFit="contain" />
        <Text style={T.fig(500, 12.5, { color: C.secondary })}>Weather data provided by OpenWeather</Text>
      </Press>
    </>
  );
}

const s = StyleSheet.create({
  flexShrink: { flexShrink: 1 },
  px16: { paddingHorizontal: 16 },
  w24: { width: 24 },
  right: { alignItems: 'flex-end' },
  visible: { overflow: 'visible' },
  warn: { marginTop: 16, padding: 16, borderRadius: 24, backgroundColor: C.warnBg, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  warnBody: { marginTop: 4, ...T.fig(500, 14, { lh: 1.45, color: C.warnBody }) },
  hero: { marginTop: 16, borderRadius: 28, padding: 20 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heroTile: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  cond: { marginTop: 14, ...T.bric(700, 22, { ls: -0.02, color: C.ink }) },
  feels: { marginTop: 4, ...T.fig(500, 14, { lh: 1.4, color: C.bodySecondary }) },
  hourCard: { marginTop: 12, paddingHorizontal: 0 },
  hours: { gap: 6, paddingTop: 12, paddingHorizontal: 12 },
  hour: { width: 52, alignItems: 'center', gap: 7, paddingVertical: 10, borderRadius: 16 },
  week: { marginTop: 12, borderRadius: 24, backgroundColor: C.card, overflow: 'hidden', boxShadow: '0 1px 2px rgba(10,51,70,.05)' },
  weekHead: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 10 },
  weekLine: { marginTop: 3, ...T.fig(500, 13, { lh: 1.4, color: C.secondary }) },
  day: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16 },
  daySel: { backgroundColor: C.selectedRow },
  dayLabel: { width: 56, ...T.fig(700, 14, { color: C.ink }) },
  dayRain: { width: 34, ...T.mono(10.5, { color: C.rainBlue }) },
  dayLo: { width: 28, textAlign: 'right', ...T.fig(600, 14, { color: C.secondary }) },
  range: { flex: 1, minWidth: 0, height: 6, borderRadius: 3, backgroundColor: C.button },
  rangeFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3, backgroundImage: 'linear-gradient(90deg, #7FD3CF, #FFC83D)' },
  dayHi: { width: 28, ...T.bric(700, 15, { color: C.ink }) },
  grid: { marginTop: 12, gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, minWidth: 0, padding: 16, borderRadius: 24, backgroundColor: C.card, gap: 4 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 8 },
  statValue: T.bric(800, 32, { lh: 1, ls: -0.03, color: C.ink }),
  unit: T.fig(600, 13, { color: C.secondary }),
  windRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  windUnit: { alignSelf: 'flex-end', paddingBottom: 3 },
  arrow: { marginLeft: 'auto', width: 30, height: 30, borderRadius: 15, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' },
  windWord: { marginTop: 6, ...T.fig(600, 13.5, { lh: 1.35, color: C.ink }) },
  statLine: T.fig(500, 12.5, { lh: 1.35, color: C.secondary }),
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
    boxShadow: '0 0 0 2px #0A3346',
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  wide: { padding: 16, borderRadius: 24, backgroundColor: C.card },
  sunHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  arc: { marginTop: 10 },
  riseSet: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  time: { marginTop: 2, ...T.bric(700, 18, { color: C.ink }) },
  moonRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  moonLine: { marginTop: 4, ...T.fig(500, 13.5, { lh: 1.4, color: C.secondary }) },
  attrib: { alignSelf: 'center', alignItems: 'center', gap: 8, marginTop: 16 },
  owLogo: { height: 40, width: (40 * 433) / 188 },
});
