/** Menu: wordmark, disclaimer, story, data sources and privacy links. */
import { StyleSheet, Text, View } from 'react-native';

import { PRIVACY_URL } from '@/data/api';
import { themed, useDayTheme } from '@/ui/dayTheme';
import { T } from '@/ui/fonts';
import { Wordmark } from '@/ui/Wordmark';

import { CloseButton, openLink, Press, useSep } from './parts';

const LINKS: [string, string, string][] = [
  ['Weather data', 'OpenWeather', 'https://openweathermap.org/'],
  ['Tide data', 'MSRO', 'https://geohub.msro.mv'],
  ['Privacy', 'Privacy Policy', PRIVACY_URL],
];

export function MenuSheet({ onClose }: { onClose: () => void }) {
  const s = useS();
  const { c } = useDayTheme();
  const sep = useSep();
  return (
    <>
      <View style={s.head}>
        <View>
          <Wordmark size={40} color={c.ink} />
          <Text style={s.tagline}>Forecast for fun</Text>
        </View>
        <CloseButton onPress={onClose} />
      </View>
      <View style={[s.card, s.disclaimer]}>
        <Text style={s.tx_bric700_16_ink}>Just a heads up!</Text>
        <Text style={[s.body, { color: c.tipText }]}>
          Naiboli is for good vibes and recreational planning. Please use official sources for safety-critical decisions or professional maritime activities. Have
          fun and stay safe! 🌊
        </Text>
      </View>
      <View style={[s.card, s.white]}>
        <Text style={s.tx_bric700_16_ink}>The Naiboli story</Text>
        <Text style={[s.body, { color: c.secondary }]}>Naiboli started as a personal need: a simple way to understand sea conditions in a more human way.</Text>
      </View>
      <View style={s.links}>
        {LINKS.map(([label, text, url], i) => (
          <View key={url} style={[s.link, sep(i > 0)]}>
            <Text style={s.tx_mono10_5ls0_09up_secondary}>{label}</Text>
            <Press onPress={() => openLink(url)} hitSlop={10} accessibilityRole="link">
              <Text style={s.tx_fig700_15_teal}>{text}</Text>
            </Press>
          </View>
        ))}
      </View>
    </>
  );
}

const useS = themed((c) =>
  StyleSheet.create({
    tx_bric700_16_ink: T.bric(700, 16, { color: c.ink }),
    tx_fig700_15_teal: T.fig(700, 15, { color: c.teal }),
    tx_mono10_5ls0_09up_secondary: T.mono(10.5, { ls: 0.09, upper: true, color: c.secondary }),
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    tagline: { marginTop: 8, ...T.mono(10.5, { ls: 0.3, upper: true, color: c.secondary }) },
    card: { padding: 16, borderRadius: 22 },
    disclaimer: { marginTop: 20, backgroundColor: c.tipBg },
    white: { marginTop: 10, backgroundColor: c.card },
    body: { marginTop: 6, ...T.fig(500, 14, { lh: 1.5 }) },
    links: { marginTop: 10, borderRadius: 22, backgroundColor: c.card, overflow: 'hidden' },
    link: { paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  }),
);
