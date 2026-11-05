/** Pick an island: search, current-location row, popular / matching islands with live weather. */
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { ApiIsland } from '@/data/types';
import type { GeoRow, IslandRow } from '@/state/sheets';
import { themed, useDayTheme } from '@/ui/dayTheme';
import { T } from '@/ui/fonts';
import { Icon } from '@/ui/Icon';

import { CloseButton, Press, usePartStyles, useSep } from './parts';

interface Props {
  query: string;
  rows: IslandRow[];
  noResults: boolean;
  geoRow: GeoRow;
  onQuery: (q: string) => void;
  onLocate: () => void;
  onPick: (I: ApiIsland) => void;
  onClose: () => void;
}

export function IslandSheet({ query, rows, noResults, geoRow, onQuery, onLocate, onPick, onClose }: Props) {
  const s = useS();
  const P = usePartStyles();
  const t = useDayTheme();
  const { c } = t;
  const sep = useSep();
  return (
    <>
      <View style={P.header}>
        <Text style={P.title} accessibilityRole="header">
          Pick an island
        </Text>
        <CloseButton onPress={onClose} />
      </View>

      <View style={s.search}>
        <Icon name="search" size={22} color={c.secondary} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Search islands…"
          placeholderTextColor={c.placeholder}
          selectionColor={c.teal}
          keyboardAppearance={t.dark ? 'dark' : 'light'}
          style={s.input}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search islands"
        />
      </View>

      <Press onPress={onLocate} style={s.geo} accessibilityRole="button" accessibilityLabel={`${geoRow.title}. ${geoRow.sub}`}>
        <View style={[s.tile, t.bgS(geoRow.tile)]}>
          <Icon name={geoRow.icon} size={20} color={t.fg(geoRow.ic)} fill />
        </View>
        <View style={s.mid}>
          <Text style={s.tx_fig700_16_ink}>{geoRow.title}</Text>
          <Text style={s.geoSub}>{geoRow.sub}</Text>
        </View>
        <Icon name="chevron_right" size={22} color={c.mutedIcon} />
      </Press>

      <View style={s.list}>
        {rows.map((il) => (
          <Press
            key={il.I.id}
            onPress={() => onPick(il.I)}
            style={[s.row, sep(il.sep), t.bgS(il.bg)]}
            accessibilityRole="button"
            accessibilityLabel={`${il.name}, ${il.atoll}. ${il.wxCond}, ${il.wxTemp} degrees`}
            accessibilityState={{ selected: il.cur }}>
            <Icon name={il.icon} size={20} color={t.fg(il.ic)} fill />
            <View style={s.mid}>
              <Text style={s.tx_fig700_16_ink}>{il.name}</Text>
              <Text style={s.atoll} numberOfLines={1}>
                {il.atoll} · {il.wxCond}
              </Text>
            </View>
            <View style={s.wx}>
              <Icon name={il.wxIcon} size={24} color={t.fg(il.wxTint)} fill />
              <Text style={s.temp}>{il.wxTemp}°</Text>
            </View>
          </Press>
        ))}
        {noResults ? <Text style={s.none}>No islands match &quot;{query}&quot;</Text> : null}
      </View>
    </>
  );
}

const useS = themed((c) =>
  StyleSheet.create({
    tx_fig700_16_ink: T.fig(700, 16, { color: c.ink }),
    search: {
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      height: 52,
      paddingHorizontal: 16,
      borderRadius: 18,
      backgroundColor: c.card,
      boxShadow: `inset 0 0 0 1.5px ${c.outline}`,
    },
    input: { flex: 1, minWidth: 0, height: '100%', padding: 0, ...T.fig(500, 16, { color: c.ink }) },
    geo: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 18,
      backgroundColor: c.card,
      boxShadow: c.cardShadow,
    },
    tile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    mid: { flex: 1, minWidth: 0 },
    geoSub: { marginTop: 1, ...T.fig(500, 12.5, { lh: 1.35, color: c.secondary }) },
    list: { marginTop: 14, borderRadius: 22, backgroundColor: c.card, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
    atoll: { marginTop: 1, ...T.fig(500, 12.5, { color: c.secondary }) },
    wx: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
    temp: { minWidth: 30, textAlign: 'right', ...T.bric(700, 18, { ls: -0.02, color: c.ink }) },
    none: { paddingVertical: 22, paddingHorizontal: 16, textAlign: 'center', ...T.fig(500, 15, { color: c.secondary }) },
  }),
);
