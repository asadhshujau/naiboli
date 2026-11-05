import { onReconnect, type NetState } from '../network';

describe('onReconnect', () => {
  it('fires only on offline → online transitions', () => {
    let emit: (s: NetState) => void = () => {};
    const cb = jest.fn();
    const off = jest.fn();
    const unsub = onReconnect((l) => ((emit = l), off), cb);
    emit({ isConnected: true, isInternetReachable: null }); // baseline
    emit({ isConnected: true, isInternetReachable: true });
    expect(cb).not.toHaveBeenCalled();
    emit({ isConnected: false, isInternetReachable: false });
    emit({ isConnected: true, isInternetReachable: null }); // connected, reachability unknown yet → online
    expect(cb).toHaveBeenCalledTimes(1);
    emit({ isConnected: true, isInternetReachable: false }); // wifi without internet
    emit({ isConnected: true, isInternetReachable: true });
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    expect(off).toHaveBeenCalled();
  });

  it('launching offline then connecting fires', () => {
    let emit: (s: NetState) => void = () => {};
    const cb = jest.fn();
    onReconnect((l) => ((emit = l), () => {}), cb);
    emit({ isConnected: false });
    emit({ isConnected: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
