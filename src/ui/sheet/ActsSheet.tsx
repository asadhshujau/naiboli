/** "All activities": verdict groups (Go, Maybe, After sunrise, Skip) with reasons and scores. */
import { StyleSheet, Text, View } from 'react-native';

import type { ActGroup } from '@/state/sheets';
import { themed, useDayTheme } from '@/ui/dayTheme';
import { T } from '@/ui/fonts';
import { Icon } from '@/ui/Icon';

import { Press, SheetHeader, SourceLine, useSep } from './parts';

interface Props {
  whenLabel: string;
  groups: ActGroup[];
  actsSrc: string;
  onAct: (id: string) => void;
  onClose: () => void;
}

export function ActsSheet({ whenLabel, groups, actsSrc, onAct, onClose }: Props) {
  const s = useS();
  const t = useDayTheme();
  const sep = useSep();
  return (
    <>
      <SheetHeader eyebrow={whenLabel} title="All activities" onClose={onClose} />
      {groups.map((g) => (
        <View key={g.key}>
          <View style={s.groupHead}>
            <View style={[s.dot, { backgroundColor: g.dot }]} />
            <Text style={s.groupTitle} accessibilityRole="header">
              {g.title}
            </Text>
            <Text style={s.count}>{g.count}</Text>
          </View>
          <View style={s.list}>
            {g.items.map((a) => (
              <Press
                key={a.id}
                onPress={() => onAct(a.id)}
                style={[s.row, sep(a.sep)]}
                accessibilityRole="button"
                accessibilityLabel={`${a.name}, ${a.v}, ${a.score} out of 10. ${a.reason}`}>
                <View style={[s.tile, t.bgS(a.vBg)]}>
                  <Icon name={a.icon} size={21} color={t.fg(a.vInk)} fill />
                </View>
                <View style={s.mid}>
                  <Text style={s.name}>{a.name}</Text>
                  <Text style={s.reason} numberOfLines={1}>
                    {a.reason}
                  </Text>
                </View>
                <Text style={s.score}>{a.score}</Text>
                <Text style={[s.pill, t.bgS(a.vBg), t.fgS(a.vInk)]}>{a.v}</Text>
              </Press>
            ))}
          </View>
        </View>
      ))}
      <SourceLine text={actsSrc} mt={16} />
    </>
  );
}

const useS = themed((c) =>
  StyleSheet.create({
    groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginHorizontal: 4, marginBottom: 8 },
    dot: { width: 9, height: 9, borderRadius: 4.5 },
    groupTitle: { flex: 1, ...T.bric(700, 16, { color: c.ink }) },
    count: T.mono(12, { color: c.secondary }),
    list: { borderRadius: 22, backgroundColor: c.card, overflow: 'hidden', boxShadow: c.cardShadow },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
    tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    mid: { flex: 1, minWidth: 0, gap: 2 },
    name: T.fig(700, 15, { color: c.ink }),
    reason: T.fig(500, 12.5, { color: c.secondary }),
    score: T.mono(12, { color: c.secondary }),
    pill: { ...T.fig(700, 12.5), paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, minWidth: 40, textAlign: 'center', overflow: 'hidden' },
  }),
);
