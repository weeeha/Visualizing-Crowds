import { useEffect, useRef, useState } from 'react';
import { createScene } from './render/createScene';
import type { SceneStats } from './render/types';
import type { SceneState, Store } from './state';

export function SceneView({ store, stats }: { store: Store<SceneState>; stats: Store<{ value: SceneStats | null }> }) {
  const ref = useRef<HTMLElement>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const scene = createScene(ref.current!);
    if (!scene) {
      setUnsupported(true);
      return;
    }
    scene.update(store.get());
    const offStore = store.subscribe(() => scene.update(store.get()));
    const offStats = scene.onStats((value) => stats.set({ value }));
    return () => {
      offStore();
      offStats();
      scene.dispose();
    };
  }, [store, stats]);

  return (
    <main className="scene" data-testid="scene" ref={ref}>
      {unsupported && <p className="scene-msg">This needs WebGL2, try a recent Chrome or Safari.</p>}
    </main>
  );
}
