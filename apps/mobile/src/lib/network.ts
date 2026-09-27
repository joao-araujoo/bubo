import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * `true` only when the device is known to be offline (unknown reachability counts as online, so
 * we never show a false "offline" banner on start-up).
 */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOffline(state.isConnected === false || state.isInternetReachable === false);
      }),
    [],
  );
  return offline;
}
