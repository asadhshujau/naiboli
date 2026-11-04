/** First-run "Where are you?" sheet. */
import { StyleSheet, Text, View } from 'react-native';

import type { WelcomeView } from '@/state/sheets';
import { T } from '@/ui/fonts';
import { Icon } from '@/ui/Icon';
import { C } from '@/ui/theme';

import { Press, SheetHeader } from './parts';

interface Props {
  wel: WelcomeView;
  onLocate: () => void;
  onManual: () => void;
  onClose: () => void;
}

export function WelcomeSheet({ wel, onLocate, onManual, onClose }: Props) {
  return (
    <>
      <SheetHeader eyebrow="Welcome to Naiboli" title="Where are you?" onClose={onClose} />
      <View style={s.intro}>
        <View style={s.tile}>
          <Icon name="near_me" size={24} color={C.teal} fill />
        </View>
        <Text style={s.introText}>Use your location to find the island you’re on, or pick one yourself. You can change it any time.</Text>
      </View>
      {wel.hasMsg ? (
        <View style={s.msg} accessibilityRole="alert">
          <Icon name={wel.msgIcon} size={20} color={C.warnIcon} fill />
          <Text style={s.msgText}>{wel.msg}</Text>
        </View>
      ) : null}
      <View style={s.buttons}>
        <Press onPress={onLocate} style={[s.btn, s.primary]} accessibilityRole="button">
          <Icon name="near_me" size={21} color={C.sheet} fill />
          <Text style={T.fig(700, 16, { color: C.sheet })}>{wel.btn}</Text>
        </Press>
        <Press onPress={onManual} style={[s.btn, s.secondary]} accessibilityRole="button">
          <Icon name="search" size={21} color={C.ink} />
          <Text style={T.fig(700, 16, { color: C.ink })}>Pick an island myself</Text>
        </Press>
      </View>
      <Text style={s.footer}>Your location is only used to find the nearest island.</Text>
    </>
  );
}

const s = StyleSheet.create({
  intro: { marginTop: 16, borderRadius: 28, padding: 20, backgroundColor: C.tealTint, flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  tile: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  introText: { flex: 1, ...T.fig(500, 15, { lh: 1.5, color: C.ink }) },
  msg: { marginTop: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.warnBg, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  msgText: { flex: 1, ...T.fig(500, 14, { lh: 1.45, color: '#5A1F0E' }) },
  buttons: { gap: 10, marginTop: 16 },
  btn: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primary: { backgroundColor: C.ink },
  secondary: { backgroundColor: C.button },
  footer: { marginTop: 14, textAlign: 'center', ...T.fig(500, 12.5, { lh: 1.45, color: C.secondary }) },
});
