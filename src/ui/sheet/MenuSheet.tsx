/** Menu: wordmark, disclaimer, story, data sources and privacy links. */
import { StyleSheet, Text, View } from 'react-native';

import { T } from '@/ui/fonts';
import { C } from '@/ui/theme';
import { Wordmark } from '@/ui/Wordmark';

import { CloseButton, openLink, Press, sepStyle } from './parts';

const LINKS: [string, string, string][] = [
  ['Weather data', 'OpenWeather', 'https://openweathermap.org/'],
  ['Tide data', 'MSRO', 'https://geohub.msro.mv'],
  ['Activity scores', 'moodhu.dev', 'https://moodhu.dev'],
  ['Privacy', 'Privacy Policy', 'https://moodhu.dev/privacy-policy'],
];

export function MenuSheet({ onClose }: { onClose: () => void }) {
  return (
    <>
      <View style={s.head}>
        <View>
          <Wordmark size={40} />
          <Text style={s.tagline}>Forecast for fun</Text>
        </View>
        <CloseButton onPress={onClose} />
      </View>
      <View style={[s.card, s.disclaimer]}>
        <Text style={T.bric(700, 16, { color: C.ink })}>Just a heads up!</Text>
        <Text style={[s.body, { color: C.tipText }]}>
          Naiboli is for good vibes and recreational planning. Please use official sources for safety-critical decisions or professional maritime activities. Have
          fun and stay safe! 🌊
        </Text>
      </View>
      <View style={[s.card, s.white]}>
        <Text style={T.bric(700, 16, { color: C.ink })}>The Naiboli story</Text>
        <Text style={[s.body, { color: C.secondary }]}>Naiboli started as a personal need: a simple way to understand sea conditions in a more human way.</Text>
      </View>
      <View style={s.links}>
        {LINKS.map(([label, text, url], i) => (
          <View key={url} style={[s.link, sepStyle(i > 0)]}>
            <Text style={T.mono(10.5, { ls: 0.09, upper: true, color: C.secondary })}>{label}</Text>
            <Press onPress={() => openLink(url)} hitSlop={10} accessibilityRole="link">
              <Text style={T.fig(700, 15, { color: C.teal })}>{text}</Text>
            </Press>
          </View>
        ))}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  tagline: { marginTop: 8, ...T.mono(10.5, { ls: 0.3, upper: true, color: C.secondary }) },
  card: { padding: 16, borderRadius: 22 },
  disclaimer: { marginTop: 20, backgroundColor: C.tipBg },
  white: { marginTop: 10, backgroundColor: C.card },
  body: { marginTop: 6, ...T.fig(500, 14, { lh: 1.5 }) },
  links: { marginTop: 10, borderRadius: 22, backgroundColor: C.card, overflow: 'hidden' },
  link: { paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
