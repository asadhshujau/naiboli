import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useReducer, useState, type ComponentRef } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { matches } from '@/data/islands';
import type { ApiIsland } from '@/data/types';
import { GlassProvider, useGlassRegistry } from '@/scene/glass';
import { ARTBOARD_W, type SceneKind } from '@/scene/paint';
import { SceneCanvas } from '@/scene/SceneCanvas';
import { dataStore, useDataState } from '@/state/app';
import {
  bubbleContent,
  bubblePos,
  buildDetail,
  buildGroups,
  buildIsle,
  buildIslandList,
  buildTide,
  buildWx,
  geoRowOf,
  welcomeOf,
  type BubbleKind,
  type Perm,
} from '@/state/sheets';
import { initialUi, openTarget, SHEET_MS, uiReducer, type OpenSheet } from '@/state/ui';
import { buildBase, buildSceneInput, buildView, type ActRow } from '@/state/view';
import { Bubble } from '@/ui/Bubble';
import { BottomPanel } from '@/ui/hud/BottomPanel';
import { TapHint } from '@/ui/hud/TapHint';
import { TopHud } from '@/ui/hud/TopHud';
import { ActSheet } from '@/ui/sheet/ActSheet';
import { ActsSheet } from '@/ui/sheet/ActsSheet';
import { IslandSheet } from '@/ui/sheet/IslandSheet';
import { IsleSheet } from '@/ui/sheet/IsleSheet';
import { MenuSheet } from '@/ui/sheet/MenuSheet';
import { Sheet } from '@/ui/sheet/Sheet';
import { TideSheet } from '@/ui/sheet/TideSheet';
import { WelcomeSheet } from '@/ui/sheet/WelcomeSheet';
import { WxSheet } from '@/ui/sheet/WxSheet';
import { C } from '@/ui/theme';

/** Picker weather prefetch delay after typing stops. */
const PREFETCH_MS = 250;

export default function SceneScreen() {
  const d = useDataState();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const [frame, setFrame] = useState({ w: win.width, h: win.height });
  const [offsetH, setOffsetH] = useState(0);
  const [ui, dispatch] = useReducer(uiReducer, initialUi);
  // Phase 4 wires the real permission state and the location flow.
  const perm: Perm = 'unknown';
  const offset = useSharedValue(0);
  const [rootView, setRootView] = useState<ComponentRef<typeof View> | null>(null);
  const glass = useGlassRegistry(rootView);

  // `now` follows the store's 60 s clock so the scene input stays stable between ticks.
  const base = useMemo(() => buildBase(d, d.clock), [d]);
  const v = useMemo(() => buildView(base, d, offsetH), [base, d, offsetH]);
  const sceneInput = useMemo(() => buildSceneInput(base, d.island.english_name, !reduceMotion), [base, d.island.english_name, reduceMotion]);

  // ── sheets ──
  const openSheet = useCallback(
    (o: OpenSheet) => {
      if (o.sheet === 'isle') dataStore.ensureIsle(dataStore.getState().island);
      dispatch({ type: 'openSheet', ...o });
    },
    [dispatch],
  );
  const closeSheet = useCallback(() => dispatch({ type: 'closeSheet' }), []);
  useEffect(() => {
    if (ui.sheetOpen || !ui.sheet) return;
    const t = setTimeout(() => dispatch({ type: 'sheetGone' }), SHEET_MS);
    return () => clearTimeout(t);
  }, [ui.sheetOpen, ui.sheet]);

  // Prefetch weather for the islands the picker shows, 250 ms after the query settles.
  const pickerOpen = ui.sheet === 'island';
  const hasList = !!d.islands;
  useEffect(() => {
    if (!pickerOpen) return;
    const t = setTimeout(() => {
      const st = dataStore.getState();
      matches(ui.query.trim().toLowerCase(), st.islands).forEach((I) => dataStore.ensureWx(I));
    }, PREFETCH_MS);
    return () => clearTimeout(t);
  }, [pickerOpen, ui.query, hasList]);

  const pickIsland = useCallback((I: ApiIsland) => {
    dataStore.pickIsland(I);
    dispatch({ type: 'picked' });
  }, []);
  // Phase 4: location lookup (permission, where-am-i).
  const locate = useCallback(() => {}, []);

  // ── bubble ──
  const onSceneTap = useCallback(
    (kind: SceneKind, x: number, y: number) => {
      const k: BubbleKind = kind === 'cloud' || kind === 'sky' ? (v.m.rainAmt ? 'rain' : 'sky') : kind;
      dispatch({ type: 'sceneTap', kind: k, x, y });
    },
    [v.m.rainAmt],
  );
  const scale = frame.w / ARTBOARD_W;
  const bubble = useMemo(() => {
    if (!ui.bubble) return null;
    const content = bubbleContent(ui.bubble.kind, base, v, d);
    const pos = bubblePos(content, ui.bubble, {
      w: frame.w,
      scale,
      top: insets.top + 58,
      bottom: frame.h - (Math.max(14, insets.bottom) - 14) - 210,
    });
    return { content, pos };
  }, [ui.bubble, base, v, d, frame, scale, insets.top, insets.bottom]);

  // ── panel / HUD ──
  const onNow = useCallback(() => {
    offset.set(0);
    setOffsetH(0);
    dispatch({ type: 'backToNow' });
  }, [offset]);
  const onAct = useCallback((a: ActRow) => openSheet({ sheet: 'act', actId: a.id }), [openSheet]);

  // Android back: close the sheet, then the bubble.
  const { sheetOpen, bubbleOpen } = ui;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sheetOpen) dispatch({ type: 'closeSheet' });
      else if (bubbleOpen) dispatch({ type: 'closeBubble' });
      else return false;
      return true;
    });
    return () => sub.remove();
  }, [sheetOpen, bubbleOpen]);

  // ── sheet content (built only for the sheet that's showing) ──
  const sheetBody = useMemo(() => {
    switch (ui.sheet) {
      case 'acts':
        return <ActsSheet whenLabel={v.whenLabel} groups={buildGroups(v)} actsSrc={v.actsSrc} onAct={(id) => openSheet({ sheet: 'act', actId: id })} onClose={closeSheet} />;
      case 'act': {
        const det = buildDetail(base, v, ui.actId);
        return det ? (
          <ActSheet d={det} whenLabel={v.whenLabel} actsSrc={v.actsSrc} onBack={() => openSheet({ sheet: 'acts' })} onClose={closeSheet} />
        ) : (
          <ActsSheet whenLabel={v.whenLabel} groups={buildGroups(v)} actsSrc={v.actsSrc} onAct={(id) => openSheet({ sheet: 'act', actId: id })} onClose={closeSheet} />
        );
      }
      case 'wx':
        return <WxSheet wx={buildWx(base, v, d)} focus={ui.focus} onClose={closeSheet} />;
      case 'tide':
        return <TideSheet td={buildTide(base, v, d, buildWx(base, v, d).eyebrow)} onClose={closeSheet} />;
      case 'isle':
        return <IsleSheet isle={buildIsle(v, d)} onChange={() => openSheet({ sheet: 'island' })} onClose={closeSheet} />;
      case 'island': {
        const list = buildIslandList(base, v, d, ui.query);
        return (
          <IslandSheet
            query={ui.query}
            rows={list.rows}
            noResults={list.noResults}
            geoRow={geoRowOf(ui.geo, perm)}
            onQuery={(q) => dispatch({ type: 'query', query: q })}
            onLocate={locate}
            onPick={pickIsland}
            onClose={closeSheet}
          />
        );
      }
      case 'welcome':
        return <WelcomeSheet wel={welcomeOf(ui.geo, perm)} onLocate={locate} onManual={() => openSheet({ sheet: 'island' })} onClose={closeSheet} />;
      case 'menu':
        return <MenuSheet onClose={closeSheet} />;
      default:
        return null;
    }
  }, [ui.sheet, ui.actId, ui.focus, ui.query, ui.geo, perm, base, v, d, openSheet, closeSheet, pickIsland, locate]);

  return (
    <GlassProvider api={glass}>
      <View
        ref={setRootView}
        collapsable={false}
        style={s.root}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width && height && (width !== frame.w || height !== frame.h)) setFrame({ w: width, h: height });
        }}>
        <SceneCanvas input={sceneInput} offset={offset} glass={glass} onTap={onSceneTap} />
        <TopHud
          v={v}
          onMenu={() => openSheet({ sheet: 'menu' })}
          onIsland={() => openSheet({ sheet: 'island' })}
          onTemp={() => dispatch({ type: 'openBubble', kind: 'temp', x: 340, y: 90 })}
          onWarning={() => dispatch({ type: 'openBubble', kind: 'warning', x: 200, y: 250 })}
        />
        <TapHint seen={ui.hintSeen} />
        <BottomPanel
          v={v}
          offset={offset}
          onHour={setOffsetH}
          onScrubStart={() => dispatch({ type: 'scrub' })}
          onNow={onNow}
          onAll={() => openSheet({ sheet: 'acts' })}
          onAct={onAct}
        />
        {bubble ? (
          <Bubble
            content={bubble.content}
            pos={bubble.pos}
            open={ui.bubbleOpen}
            onClose={() => dispatch({ type: 'closeBubble' })}
            onAction={() => {
              const go = bubble.content.action?.go;
              if (!go) return;
              if (go.sheet === 'isle') dataStore.ensureIsle(dataStore.getState().island);
              dispatch(openTarget(go));
            }}
          />
        ) : null}
        <Sheet open={ui.sheetOpen} seq={ui.seq} focus={ui.focus} frameH={frame.h} onClose={closeSheet}>
          {sheetBody}
        </Sheet>
        <StatusBar style={v.darkSky ? 'light' : 'dark'} />
      </View>
    </GlassProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.sceneBg, overflow: 'hidden' },
});
