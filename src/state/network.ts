/** Minimal connection state (subset of NetInfo's `NetInfoState`). */
export interface NetState {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
}

/** Online unless NetInfo says otherwise (`null` = not known yet). */
export const isOnline = (s: NetState) => s.isConnected !== false && s.isInternetReachable !== false;

/**
 * Calls `cb` each time the connection comes back (offline → online). The first state only sets the baseline.
 * `subscribe` is NetInfo's `addEventListener` (injected for tests); returns the unsubscribe function.
 */
export function onReconnect(subscribe: (l: (s: NetState) => void) => () => void, cb: () => void): () => void {
  let prev: boolean | null = null;
  return subscribe((s) => {
    const on = isOnline(s);
    if (prev === false && on) cb();
    prev = on;
  });
}
