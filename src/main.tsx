import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import type { SceneStats } from './render/types';
import { createStore, DEFAULT_STATE, type SceneState } from './state';
import { parseUrlState, serializeUrlState } from './urlState';
import './styles.css';

const debug = new URLSearchParams(location.search).has('debug');
const store = createStore<SceneState>(parseUrlState(location.search, DEFAULT_STATE));
const stats = createStore<{ value: SceneStats | null }>({ value: null });

let urlTimer = 0;
store.subscribe(() => {
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    history.replaceState(null, '', `?${serializeUrlState(store.get())}${debug ? '&debug' : ''}`);
  }, 200);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} stats={stats} debug={debug} />
  </StrictMode>,
);
