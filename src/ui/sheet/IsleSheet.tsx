/** About the island: hero with map link and now-chips, description, getting there, beaches, reefs. */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { IsleTag, IsleView } from '@/state/sheets';
import { BalancedText } from '@/ui/BalancedText';
import { T } from '@/ui/fonts';
import { Icon } from '@/ui/Icon';
import { C } from '@/ui/theme';

import { openLink, Press, SheetHeader, StatLabel } from './parts';

function Tag({ tag }: { tag: IsleTag }) {
  return (
    <View style={[s.tag, { backgroundColor: tag.bg }]}>
      <Text style={T.fig(700, 11.5, { color: tag.ink })} numberOfLines={1}>
        {tag.t}
      </Text>
    </View>
  );
}

/** CSS grid `repeat(auto-fill, minmax(78px, 1fr))`, gap 8. */
function AccessGrid({ items }: { items: IsleView['access'] }) {
  const [w, setW] = useState(0);
  const cols = Math.max(1, Math.floor((w + 8) / (78 + 8)));
  const cw = w ? (w - (cols - 1) * 8) / cols : 78;
  return (
    <View style={s.grid} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {items.map((ac, i) => (
        <View key={i} style={[s.access, { width: cw }]}>
          <View style={s.accessIcon}>
            <Icon name={ac.icon} size={22} color={C.teal} fill />
          </View>
          <Text style={s.accessLabel}>{ac.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function IsleSheet({ isle, onChange, onClose }: { isle: IsleView; onChange: () => void; onClose: () => void }) {
  return (
    <>
      <SheetHeader eyebrow={isle.eyebrow} title="About the island" onClose={onClose} />

      <View style={s.hero}>
        <BalancedText style={T.bric(800, 40, { lh: 1, ls: -0.045, color: C.ink })}>{isle.en}</BalancedText>
        <Press onPress={() => openLink(isle.mapUrl)} style={s.coords} accessibilityRole="link" accessibilityLabel={`Open ${isle.en} in Maps`}>
          <Icon name="map" size={16} color={C.coords} fill />
          <Text style={T.mono(11, { ls: 0.09, upper: true, color: C.coords })}>{isle.coords}</Text>
          <Icon name="open_in_new" size={14} color={C.coords} />
        </Press>
        <View style={s.chips}>
          {isle.now.map((nw, i) => (
            <View key={i} style={s.chip}>
              <Icon name={nw.icon} size={17} color={C.chipIcon} fill />
              <Text style={T.fig(600, 13, { color: C.ink })}>{nw.t}</Text>
            </View>
          ))}
        </View>
      </View>

      {isle.hasDesc ? <Text style={s.desc}>{isle.desc}</Text> : null}

      {isle.loading ? (
        <View style={s.loading}>
          <Icon name="hourglass_top" size={20} color={C.secondary} />
          <Text style={T.fig(500, 14, { color: C.secondary })}>Loading island details…</Text>
        </View>
      ) : null}

      {isle.empty ? (
        <View style={s.empty}>
          <View style={s.emptyTile}>
            <Icon name="explore" size={24} color={C.teal} fill />
          </View>
          <View style={s.shrink}>
            <Text style={T.bric(700, 16, { color: C.ink })}>Still being mapped</Text>
            <Text style={s.emptyLine}>{isle.emptyLine}</Text>
          </View>
        </View>
      ) : null}

      {isle.hasAccess ? (
        <View style={s.card}>
          <StatLabel icon="route">Getting there</StatLabel>
          <AccessGrid items={isle.access} />
        </View>
      ) : null}

      {isle.hasBeaches ? (
        <View style={s.listCard}>
          <View style={s.listHead}>
            <View style={s.spread}>
              <StatLabel icon="beach_access">Beaches</StatLabel>
              <Text style={s.count}>{isle.beachCount}</Text>
            </View>
            <View style={s.sandBar}>
              <View style={[s.sandFill, { width: `${isle.sandPct}%` }]} />
            </View>
            <View style={s.legend}>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: C.sand }]} />
                <Text style={s.legendText}>{isle.sandyN} sandy</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: C.rocky }]} />
                <Text style={s.legendText}>{isle.rockyN} rocky</Text>
              </View>
            </View>
          </View>
          {isle.beaches.map((bc, i) => (
            <View key={i} style={s.row}>
              <View style={[s.tile, { backgroundColor: bc.tile }]}>
                <Icon name={bc.icon} size={20} color={bc.ic} fill />
              </View>
              <View style={s.mid}>
                <Text style={T.fig(700, 15, { color: C.ink })}>{bc.name}</Text>
                <Text style={T.fig(500, 12.5, { color: C.secondary })}>{bc.type}</Text>
              </View>
              {bc.hasTag ? <Tag tag={bc.tag} /> : null}
            </View>
          ))}
        </View>
      ) : null}

      {isle.hasReefs ? (
        <View style={s.listCard}>
          <View style={[s.listHead, s.spread]}>
            <StatLabel icon="scuba_diving">Reefs</StatLabel>
            <Text style={s.count}>{isle.reefCount}</Text>
          </View>
          {isle.reefs.map((rf, i) => (
            <View key={i} style={s.row}>
              <View style={[s.tile, { backgroundColor: C.tealTint }]}>
                <Icon name="water" size={20} color={C.teal} fill />
              </View>
              <View style={s.mid}>
                <Text style={T.fig(700, 15, { color: C.ink })}>{rf.name}</Text>
                <Text style={T.fig(500, 12.5, { color: C.secondary })}>{rf.meta}</Text>
              </View>
              {rf.hasTag ? <Tag tag={rf.tag} /> : null}
            </View>
          ))}
        </View>
      ) : null}

      <Press onPress={onChange} style={s.change} accessibilityRole="button">
        <Icon name="swap_horiz" size={20} color={C.ink} />
        <Text style={T.fig(700, 15, { color: C.ink })}>Change island</Text>
      </Press>
    </>
  );
}

const s = StyleSheet.create({
  shrink: { flexShrink: 1 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hero: { marginTop: 16, borderRadius: 28, padding: 20, backgroundColor: C.islandHero },
  coords: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,.55)',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 18 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingLeft: 9, paddingRight: 11, borderRadius: 15, backgroundColor: 'rgba(255,255,255,.72)' },
  desc: {
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: C.card,
    overflow: 'hidden',
    ...T.fig(500, 15, { lh: 1.55, color: C.bodySecondary }),
  },
  loading: { marginTop: 12, padding: 18, borderRadius: 24, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 10 },
  empty: { marginTop: 12, padding: 20, borderRadius: 24, backgroundColor: C.card, flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  emptyTile: { width: 44, height: 44, borderRadius: 16, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' },
  emptyLine: { marginTop: 4, ...T.fig(500, 14, { lh: 1.5, color: C.secondary }) },
  card: { marginTop: 12, padding: 16, borderRadius: 24, backgroundColor: C.card },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  access: { alignItems: 'center', gap: 8, paddingTop: 14, paddingHorizontal: 6, paddingBottom: 12, borderRadius: 18, backgroundColor: C.tile },
  accessIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' },
  accessLabel: { textAlign: 'center', ...T.fig(600, 12.5, { lh: 1.25, color: C.ink }) },
  listCard: { marginTop: 12, borderRadius: 24, backgroundColor: C.card, overflow: 'hidden' },
  listHead: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12 },
  count: T.bric(800, 22, { lh: 1, ls: -0.02, color: C.ink }),
  sandBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 12, backgroundColor: C.rocky },
  sandFill: { backgroundColor: C.sand },
  legend: { flexDirection: 'row', gap: 14, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: T.fig(500, 12, { color: C.secondary }),
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: 'rgba(10,51,70,.07)' },
  tile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, minWidth: 0, gap: 1 },
  tag: { flexShrink: 0, height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  change: {
    marginTop: 16,
    height: 52,
    borderRadius: 26,
    boxShadow: 'inset 0 0 0 1.5px rgba(10,51,70,.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
