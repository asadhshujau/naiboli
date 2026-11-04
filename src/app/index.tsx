import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion, useSharedValue } from 'react-native-reanimated';

import { GlassProvider, useGlassRegistry } from '@/scene/glass';
import type { SceneKind } from '@/scene/paint';
import { SceneCanvas } from '@/scene/SceneCanvas';
import { useDataState } from '@/state/app';
import { buildBase, buildSceneInput, buildView, type ActRow } from '@/state/view';
import { BottomPanel } from '@/ui/hud/BottomPanel';
import { TapHint } from '@/ui/hud/TapHint';
import { TopHud } from '@/ui/hud/TopHud';
import { C } from '@/ui/theme';

/** Bubble kinds (phase 3 renders them). */
export type BubbleKind = 'sun' | 'moon' | 'sky' | 'rain' | 'palm' | 'island' | 'sea' | 'dhoni' | 'temp' | 'warning';

export default function SceneScreen() {
  const d = useDataState();
  const reduceMotion = useReducedMotion();
  const [offsetH, setOffsetH] = useState(0);
  const [hintSeen, setHintSeen] = useState(false);
  const offset = useSharedValue(0);
  const glass = useGlassRegistry();

  // `now` follows the store's 60 s clock so the scene input stays stable between ticks.
  const base = useMemo(() => buildBase(d, d.clock), [d]);
  const v = useMemo(() => buildView(base, d, offsetH), [base, d, offsetH]);
  const sceneInput = useMemo(() => buildSceneInput(base, d.island.english_name, !reduceMotion), [base, d.island.english_name, reduceMotion]);

  // Phase 3: bubbles and sheets.
  const openBubble = useCallback((_kind: BubbleKind, _x: number, _y: number) => setHintSeen(true), []);
  const onSceneTap = useCallback(
    (kind: SceneKind, x: number, y: number) => {
      const k: BubbleKind = kind === 'cloud' || kind === 'sky' ? (v.m.rainAmt ? 'rain' : 'sky') : kind;
      openBubble(k, x, y);
    },
    [v.m.rainAmt, openBubble],
  );
  const noop = useCallback(() => {}, []);
  const onAct = useCallback((_a: ActRow) => {}, []);

  const onNow = useCallback(() => {
    offset.set(0);
    setOffsetH(0);
  }, [offset]);

  return (
    <GlassProvider api={glass}>
      <View style={s.root}>
        <SceneCanvas input={sceneInput} offset={offset} glass={glass} onTap={onSceneTap} />
        <TopHud v={v} onMenu={noop} onIsland={noop} onTemp={() => openBubble('temp', 340, 90)} onWarning={() => openBubble('warning', 200, 250)} />
        <TapHint seen={hintSeen} />
        <BottomPanel v={v} offset={offset} onHour={setOffsetH} onScrubStart={() => setHintSeen(true)} onNow={onNow} onAll={noop} onAct={onAct} />
        <StatusBar style={v.darkSky ? 'light' : 'dark'} />
      </View>
    </GlassProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.sceneBg, overflow: 'hidden' },
});
