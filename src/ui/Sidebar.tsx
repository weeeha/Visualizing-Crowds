import type { ReactNode } from 'react';
import { PLACES, getPlace } from '../places/index';
import type { SceneStats } from '../render/types';
import type { Density, SceneState, Store } from '../state';
import { ChipGroup } from './ChipGroup';
import { CountControl } from './CountControl';
import { HighlightControl } from './HighlightControl';
import { formatCount } from './logScale';
import { useStore } from './useStore';
import { compareLines } from './venues';
import './sidebar.css';

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 1, label: 'Loose' },
  { value: 2.5, label: 'Concert' },
  { value: 4.5, label: 'Packed' },
];

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2 className="label">{label}</h2>
      {children}
    </section>
  );
}

export function Sidebar({ store, stats, debug }: { store: Store<SceneState>; stats: Store<{ value: SceneStats | null }>; debug: boolean }) {
  const s = useStore(store);
  const st = useStore(stats).value;
  const lines = compareLines(s.count);
  const setCamera = (preset: 'aerial' | 'eye') => store.set({ camera: { preset, nonce: s.camera.nonce + 1 } });
  const status = st?.overflow ? (
    <span className="warn">Overflow: {getPlace(s.placeId).name} holds about {formatCount(st.capacity)} at this density.</span>
  ) : (
    'people'
  );
  return (
    <aside className="sidebar" aria-label="Crowd controls">
      <h1 className="title">Visualizing Crowds</h1>
      <CountControl count={s.count} onChange={(count) => store.set({ count })} status={status} />
      <Section label="Place">
        <ChipGroup label="Place" options={PLACES.map((p) => ({ value: p.id, label: p.name }))} value={s.placeId} onChange={(placeId) => store.set({ placeId })} />
      </Section>
      <Section label="Density">
        <ChipGroup label="Density" options={DENSITY_OPTIONS} value={s.density} onChange={(density) => store.set({ density })} />
      </Section>
      <Section label="Compare">
        {lines.length > 0 ? (
          <ul className="compare">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
        ) : (
          <p className="compare muted">Smaller than every reference venue.</p>
        )}
      </Section>
      <Section label="Camera">
        <div className="chips">
          <button type="button" className="chip" onClick={() => setCamera('aerial')}>Aerial view</button>
          <button type="button" className="chip" onClick={() => setCamera('eye')}>Eye-level view</button>
        </div>
      </Section>
      <Section label="Highlight">
        <HighlightControl value={s.highlight} onChange={(highlight) => store.set({ highlight })} />
      </Section>
      {debug && st && (
        <p className="debug">
          {st.fps} fps · {formatCount(st.nearSprites)} sprites · {formatCount(st.midPoints)} dots · r {Math.round(st.radius)} m
        </p>
      )}
    </aside>
  );
}
