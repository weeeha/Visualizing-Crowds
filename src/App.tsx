import { SceneView } from './SceneView';
import type { SceneStats } from './render/types';
import type { SceneState, Store } from './state';

export function App({ store, stats }: { store: Store<SceneState>; stats: Store<{ value: SceneStats | null }>; debug: boolean }) {
  return (
    <div className="app">
      <aside className="sidebar" aria-label="Crowd controls">
        <h1 className="title">Visualizing Crowds</h1>
      </aside>
      <SceneView store={store} stats={stats} />
    </div>
  );
}
