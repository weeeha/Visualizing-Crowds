import { useEffect, useRef, useState } from 'react';
import { createScene } from './render/createScene';
import type { SceneStats } from './render/types';
import type { SceneState, Store } from './state';

export function SceneView({ store, stats }: { store: Store<SceneState>; stats: Store<{ value: SceneStats | null }> }) {
  const ref = useRef<HTMLElement>(null);
  const [problem, setProblem] = useState<null | 'unsupported' | 'failed'>(null);

  useEffect(() => {
    let scene: ReturnType<typeof createScene>;
    try {
      scene = createScene(ref.current!);
    } catch (err) {
      console.warn('Scene failed to start', err);
      setProblem('failed');
      return;
    }
    if (!scene) {
      setProblem('unsupported');
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
      {problem === 'unsupported' && <p className="scene-msg">This needs WebGL2, try a recent Chrome or Safari.</p>}
      {problem === 'failed' && <p className="scene-msg">The 3D view could not start in this browser.</p>}
    </main>
  );
}
