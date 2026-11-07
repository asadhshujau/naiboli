/** Activity detail: verdict hero, best window bars, what's shaping it, next 7 days, tip. */
import { StyleSheet, Text, View } from 'react-native';

import type { ShownAlert } from '@/data/mood';
import type { ActDetail } from '@/state/sheets';
import { themed, useDayTheme } from '@/ui/dayTheme';
import { T } from '@/ui/fonts';
import { Icon } from '@/ui/Icon';

import { AlertCard, Card, CardTitle, CloseButton, Press, SourceLine, TipCard, useSep } from './parts';

interface Props {
  d: ActDetail;
  whenLabel: string;
  actsSrc: string;
  /** weather alert to show on top (as on the Weather sheet) */
  warning: ShownAlert | null;
  onWarning: () => void;
  onBack: () => void;
  onClose: () => void;
}

export function ActSheet({ d, whenLabel, actsSrc, warning, onWarning, onBack, onClose }: Props) {
  const s = useS();
  const t = useDayTheme();
  const { c } = t;
  const sep = useSep();
  return (
    <>
      <View style={s.top}>
        <Press onPress={onBack} style={s.back} accessibilityRole="button" accessibilityLabel="All activities">
          <Icon name="chevron_left" size={20} color={c.ink} />
          <Text style={s.tx_fig700_13_5_ink}>All</Text>
        </Press>
        <CloseButton onPress={onClose} />
      </View>
      {warning ? <AlertCard title={warning.title} until={warning.until} from={warning.from} body={warning.body} onPress={onWarning} style={s.alert} /> : null}

      <View style={[s.hero, t.bgS(d.headBg)]}>
        <View style={s.heroHead}>
          <View style={s.heroTile}>
            <Icon name={d.icon} size={26} color={t.fg(d.vInk)} fill />
          </View>
          <View style={s.shrink}>
            <Text style={s.tx_bric700_22lsm0_02_ink} accessibilityRole="header">
              {d.name}
            </Text>
            <Text style={s.heroWhen}>{whenLabel}</Text>
          </View>
        </View>
        <View style={s.verdictRow}>
          {/* "Maybe." at 92 pt is wider than the hero next to the score on most phones: shrink to fit, one line. */}
          <Text
            style={[s.tx_bric800_92lh0_84lsm0_06, s.verdictWord, t.fgS(d.vWord)]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}>
            {d.vBig}
          </Text>
          <Text style={s.scoreBox}>
            <Text style={s.tx_bric700_22_ink}>{d.score}</Text>
            <Text style={s.tx_mono13_secondary}> / 10</Text>
          </Text>
        </View>
        <Text style={s.line}>{d.line}</Text>
      </View>

      <Card flat style={s.mt12}>
        <View style={s.cardHead}>
          <CardTitle>Best window</CardTitle>
          <Text style={[s.tx_fig700_14, t.fgS(d.vInk)]}>{d.window}</Text>
        </View>
        <View style={s.bars}>
          {d.hours.map((hb, i) => (
            <View key={i} style={[s.bar, { height: `${hb.h}%`, backgroundColor: hb.c }, hb.ring ? s.ring : null]} />
          ))}
        </View>
        <View style={s.barLabels}>
          {d.hours.map((hb, i) => (
            // CSS: flex:1 + nowrap → a labelled cell is at least as wide as its text (DM Mono = 0.6 em/char)
            <View key={i} style={[s.flex1, { minWidth: hb.label.length * 9 * 0.6 }]}>
              {hb.label ? (
                <Text style={s.barLabel} numberOfLines={1}>
                  {hb.label}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </Card>

      {d.hasBr ? (
        <Card flat style={s.mt12}>
          <View style={s.cardHead}>
            <CardTitle>What’s shaping it</CardTitle>
            <Text style={s.tx_mono12_secondary}>{d.condTxt}</Text>
          </View>
          <View style={s.factors}>
            {d.br.map((f) => (
              <View key={f.label} style={s.factor}>
                <View style={s.fIcon}>
                  <Icon name={f.icon} size={19} color={c.secondary} />
                </View>
                <View style={s.fLabel}>
                  <Text style={s.tx_fig600_14_ink}>{f.label}</Text>
                  {f.tag ? <Text style={[s.fTag, t.fgS(f.tagC)]}>{f.tag}</Text> : null}
                </View>
                <View style={s.track8}>
                  <View style={[s.fill8, { width: `${f.w}%`, backgroundColor: f.c }]} />
                </View>
                <Text style={[s.fVal, t.fgS(f.ink)]}>{f.val}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {d.hasDays ? (
        <View style={s.days}>
          <View style={s.daysHead}>
            <CardTitle>Next 7 days</CardTitle>
            <Text style={s.weekLine}>{d.weekLine}</Text>
          </View>
          {d.days.map((dy, i) => (
            <View key={i} style={[s.day, sep(dy.sep), dy.sel ? s.daySel : null]}>
              <Text style={s.dayLabel} numberOfLines={1}>
                {dy.label}
              </Text>
              <View style={s.dayMid}>
                <View style={s.track6}>
                  <View style={[s.fill6, { width: `${dy.w}%`, backgroundColor: dy.c }]} />
                </View>
                <Text style={s.tx_fig500_12_secondary} numberOfLines={1}>
                  {dy.note}
                </Text>
              </View>
              <Text style={s.dayScore}>{dy.score}</Text>
              <Text style={[s.dayPill, t.bgS(dy.vBg), t.fgS(dy.vInk)]}>{dy.v}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <TipCard text={d.tip} />
      {actsSrc ? <SourceLine text={actsSrc} mt={14} /> : null}
    </>
  );
}

const useS = themed((c) =>
  StyleSheet.create({
    tx_bric700_22_ink: T.bric(700, 22, { color: c.ink }),
    tx_bric700_22lsm0_02_ink: T.bric(700, 22, { ls: -0.02, color: c.ink }),
    tx_bric800_92lh0_84lsm0_06: T.bric(800, 92, { lh: 0.84, ls: -0.06 }),
    tx_fig500_12_secondary: T.fig(500, 12, { color: c.secondary }),
    tx_fig600_14_ink: T.fig(600, 14, { color: c.ink }),
    tx_fig700_13_5_ink: T.fig(700, 13.5, { color: c.ink }),
    tx_fig700_14: T.fig(700, 14),
    tx_mono12_secondary: T.mono(12, { color: c.secondary }),
    tx_mono13_secondary: T.mono(13, { color: c.secondary }),
    flex1: { flex: 1 },
    shrink: { flexShrink: 1 },
    mt12: { marginTop: 12 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    back: { height: 38, paddingLeft: 8, paddingRight: 14, borderRadius: 19, backgroundColor: c.button, flexDirection: 'row', alignItems: 'center', gap: 2 },
    alert: { marginTop: 16 },
    hero: { marginTop: 16, borderRadius: 28, padding: 20 },
    heroHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    heroTile: { width: 48, height: 48, borderRadius: 16, backgroundColor: c.heroTile, alignItems: 'center', justifyContent: 'center' },
    heroWhen: { marginTop: 2, ...T.mono(11, { ls: 0.06, upper: true, color: c.secondary }) },
    verdictRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 14 },
    verdictWord: { flexShrink: 1, minWidth: 0 },
    scoreBox: { paddingBottom: 8 },
    line: { marginTop: 12, ...T.fig(600, 16, { lh: 1.4, color: c.ink }) },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 80, marginTop: 14 },
    bar: { flex: 1, borderRadius: 4 },
    ring: { boxShadow: `0 0 0 2px ${c.card}, 0 0 0 3.5px ${c.ink}` },
    barLabels: { flexDirection: 'row', gap: 3, marginTop: 6, height: 12 },
    barLabel: { position: 'absolute', left: 0, width: 40, ...T.mono(9, { color: c.secondary }) },
    factors: { gap: 12, marginTop: 14 },
    factor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    fIcon: { width: 20 },
    fLabel: { width: 84, gap: 1 },
    fTag: T.mono(9.5, { ls: 0.08, upper: true }),
    track8: { flex: 1, minWidth: 0, height: 8, borderRadius: 4, backgroundColor: c.button, overflow: 'hidden' },
    fill8: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
    fVal: { width: 28, textAlign: 'right', ...T.mono(12) },
    days: { marginTop: 12, borderRadius: 24, backgroundColor: c.card, overflow: 'hidden' },
    daysHead: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 10 },
    weekLine: { marginTop: 3, ...T.fig(500, 13, { lh: 1.4, color: c.secondary }) },
    day: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 16 },
    daySel: { backgroundColor: c.selectedRow },
    dayLabel: { width: 72, ...T.fig(700, 14, { color: c.ink }) },
    dayMid: { flex: 1, minWidth: 0, gap: 5 },
    track6: { height: 6, borderRadius: 3, backgroundColor: c.button, overflow: 'hidden' },
    fill6: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
    dayScore: { width: 28, textAlign: 'right', ...T.mono(12, { color: c.secondary }) },
    dayPill: { width: 54, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', textAlign: 'center', ...T.fig(700, 12.5) },
  }),
);
