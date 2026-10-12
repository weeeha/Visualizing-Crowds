import { SceneView } from './SceneView';
import { Sidebar } from './ui/Sidebar';
import type { SceneStats } from './render/types';
import type { SceneState, Store } from './state';

export function App({ store, stats, debug }: { store: Store<SceneState>; stats: Store<{ value: SceneStats | null }>; debug: boolean }) {
  return (
    <div className="app">
      <Sidebar store={store} stats={stats} debug={debug} />
      <SceneView store={store} stats={stats} />
    </div>
  );
}
