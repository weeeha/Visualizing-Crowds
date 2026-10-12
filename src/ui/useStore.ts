import { useSyncExternalStore } from 'react';
import type { Store } from '../state';

export const useStore = <T,>(store: Store<T>): T => useSyncExternalStore(store.subscribe, store.get);
