import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useReducer, useState, type ComponentRef } from 'react';
import { BackHandler, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Easing, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickerIslands, wxKey } from '@/data/islands';
import type { GeoStatus } from '@/data/location';
import type { ApiIsland } from '@/data/types';
import { GlassProvider, useGlassRegistry } from '@/scene/glass';
import { ARTBOARD_W, type SceneKind } from '@/scene/paint';
import { lightOf } from '@/scene/palette';
import { SceneCanvas } from '@/scene/SceneCanvas';
import { dataStore, launchPrefs, storage, useDataState } from '@/state/app';
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
} from '@/state/sheets';
import { initialUi, openTarget, SHEET_MS, uiReducer, type OpenSheet } from '@/state/ui';
import { locator, useLocator } from '@/state/useLocator';
import { buildBase, buildSceneInput, buildView, type ActRow } from '@/state/view';
import { Bubble } from '@/ui/Bubble';
import { dayTheme, DayThemeProvider } from '@/ui/dayTheme';
import { BottomPanel } from '@/ui/hud/BottomPanel';
import { MINI_BAR_H, MiniBar } from '@/ui/hud/MiniBar';
import { TapHint } from '@/ui/hud/TapHint';
import { TopHud } from '@/ui/hud/TopHud';
import { Splash } from '@/ui/Splash';
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
  const offset = useSharedValue(0);
  const [rootView, setRootView] = useState<ComponentRef<typeof View> | null>(null);
  // Immersive mode: the scene without the bottom panel (a thin bar instead); remembered across launches.
  const [immersive, setImmersive] = useState(launchPrefs.immersive);
  const glass = useGlassRegistry(rootView, launchPrefs.immersive ? 1 : 0);
  const immersiveA = glass.alphas.immersive;
  useEffect(() => {
    immersiveA.set(withTiming(immersive ? 1 : 0, { duration: 250, easing: Easing.out(Easing.quad) }));
  }, [immersive, immersiveA]);
  useEffect(() => {
    if (immersive !== launchPrefs.immersive) void storage.setImmersive(immersive);
  }, [immersive]);
  const toggleImmersive = useCallback(() => {
    setImmersive((on) => !on);
    dispatch({ type: 'closeBubble' });
  }, []);

  // `now` follows the store's 60 s clock so the scene input stays stable between ticks.
  const base = useMemo(() => buildBase(d, d.clock), [d]);
  const v = useMemo(() => buildView(base, d, offsetH), [base, d, offsetH]);
  // The day is the theme: sheets and bubbles follow the scene's light at the selected hour.
  const theme = useMemo(() => dayTheme(lightOf(v.hSel, v.m.gloom, base.sun), v.m.gloom), [v.hSel, v.m.gloom, base.sun]);
  const sceneInput = useMemo(() => buildSceneInput(base, d.island.english_name, !reduceMotion), [base, d.island.english_name, reduceMotion]);

  // ── sheets ──
  const openSheet = useCallback(
    (o: OpenSheet) => {
      if (o.sheet === 'isle') dataStore.ensureIsle(dataStore.getState().island);
      dispatch({ type: 'openSheet', ...o });
    },
    [dispatch],
  );
  /** the alert box on the activity sheets → Weather sheet, alert in focus */
  const openWarning = useCallback(() => openSheet({ sheet: 'wx', focus: 'warning' }), [openSheet]);
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
      pickerIslands(ui.query.trim().toLowerCase(), st.islands, st.island, st.recents).forEach((I) => dataStore.ensureWx(I));
    }, PREFETCH_MS);
    return () => clearTimeout(t);
  }, [pickerOpen, ui.query, hasList]);

  const pickIsland = useCallback((I: ApiIsland) => {
    dataStore.pickIsland(I);
    dispatch({ type: 'picked' });
  }, []);

  // ── location / first run ──
  const setGeo = useCallback((g: GeoStatus) => dispatch({ type: 'geo', geo: g }), []);
  const openWelcome = useCallback(() => dispatch({ type: 'openSheet', sheet: 'welcome' }), []);
  const perm = useLocator({ geo: ui.geo, sheetOpen: ui.sheetOpen, setGeo, openWelcome, pick: pickIsland });
  const locate = useCallback(() => void locator.locate(), []);

  // ── splash ──
  const [splash, setSplash] = useState(true);
  // The opaque splash covers the scene until its fade-out starts: no painting behind it.
  const [splashCover, setSplashCover] = useState(true);
  const onSplashEnding = useCallback(() => setSplashCover(false), []);
  const wxNow = d.wx[wxKey(d.island)];
  const splashReady = !!wxNow && wxNow !== 'loading' && ui.geo !== 'locating';
  const onSplashDone = useCallback(() => {
    setSplash(false);
    locator.splashDone();
  }, []);

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
      bottom: frame.h - (Math.max(14, insets.bottom) - 14) - (immersive ? MINI_BAR_H + 30 : 210),
    });
    return { content, pos };
  }, [ui.bubble, base, v, d, frame, scale, insets.top, insets.bottom, immersive]);

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
        return <ActsSheet whenLabel={v.whenLabel} groups={buildGroups(v)} actsSrc={v.actsSrc} warning={v.m.warning} onWarning={openWarning} onAct={(id) => openSheet({ sheet: 'act', actId: id })} onClose={closeSheet} />;
      case 'act': {
        const det = buildDetail(base, v, ui.actId);
        return det ? (
          <ActSheet d={det} whenLabel={v.whenLabel} actsSrc={v.actsSrc} warning={v.m.warning} onWarning={openWarning} onBack={() => openSheet({ sheet: 'acts' })} onClose={closeSheet} />
        ) : (
          <ActsSheet whenLabel={v.whenLabel} groups={buildGroups(v)} actsSrc={v.actsSrc} warning={v.m.warning} onWarning={openWarning} onAct={(id) => openSheet({ sheet: 'act', actId: id })} onClose={closeSheet} />
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
  }, [ui.sheet, ui.actId, ui.focus, ui.query, ui.geo, perm, base, v, d, openSheet, openWarning, closeSheet, pickIsland, locate]);

  return (
    <GlassProvider api={glass}>
      <DayThemeProvider value={theme}>
        <View
          ref={setRootView}
          collapsable={false}
          style={s.root}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width && height && (width !== frame.w || height !== frame.h)) setFrame({ w: width, h: height });
          }}>
          <SceneCanvas input={sceneInput} offset={offset} glass={glass} onTap={onSceneTap} paused={ui.sheetOpen || splashCover} />
          <TopHud
            v={v}
            onMenu={() => openSheet({ sheet: 'menu' })}
            onIsland={() => openSheet({ sheet: 'island' })}
            onTemp={() => dispatch({ type: 'openBubble', kind: 'temp', x: 340, y: 90 })}
            onWarning={() => dispatch({ type: 'openBubble', kind: 'warning', x: 200, y: 250 })}
            onRetry={dataStore.retryNow}
            onRefresh={dataStore.refresh}
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
            immersive={immersive}
            onImmersive={toggleImmersive}
          />
          <MiniBar
            v={v}
            offset={offset}
            onHour={setOffsetH}
            onScrubStart={() => dispatch({ type: 'scrub' })}
            onNow={onNow}
            onAll={() => openSheet({ sheet: 'acts' })}
            immersive={immersive}
            onExit={toggleImmersive}
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
          {splash ? <Splash ready={splashReady} onEnding={onSplashEnding} onDone={onSplashDone} /> : null}
          <StatusBar style={splash ? 'dark' : v.darkSky ? 'light' : 'dark'} />
        </View>
      </DayThemeProvider>
    </GlassProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.sceneBg, overflow: 'hidden' },
});
