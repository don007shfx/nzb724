import { useEffect, useState, useSyncExternalStore } from 'react';
import { store, initialState, type AppState } from './store/store';

/**
 * Whole-state subscription. The app is small enough that re-rendering the
 * active view is cheaper than maintaining selector equality checks.
 */
export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => initialState);
}

export function useViewport(): { mobile: boolean; width: number } {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );

  useEffect(() => {
    const query = window.matchMedia('(max-width: 980px)');
    const update = () => setWidth(window.innerWidth);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return { mobile: width <= 980, width };
}

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
