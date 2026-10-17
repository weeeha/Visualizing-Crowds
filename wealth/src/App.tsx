import { useEffect, useRef, useState } from 'react';
import { BLOOMBERG_MUSK, ESTIMATES, LOWER_ESTIMATES_NOTE, PEOPLE, estimateById, personById } from './data/figures';
import { money, people, shortDate, storeys } from './format';
import { bodyCone, cashCone } from './pile/volume';
import { createWealthScene, hasWebGL2, type ScreenAnchor, type Stats, type WealthScene, type WealthState } from './render/scene';
import { normalize, readHash, writeHash } from './urlState';

interface ChipProps<T extends string> {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  disabled?: boolean;
  note?: string;
  onChange: (v: T) => void;
}

function Chips<T extends string>({ label, options, value, disabled, note, onChange }: ChipProps<T>) {
  return (
    <div className="section" role="group" aria-label={label}>
      <p className="label">{label}</p>
      <div className="chips">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`chip${o.id === value ? ' on' : ''}`}
            aria-pressed={o.id === value}
            disabled={disabled}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="note">{note ?? ''}</p>
    </div>
  );
}

export function App() {
  const [state, setState] = useState<WealthState>(() => readHash(location.hash));
  const [stats, setStats] = useState<Stats | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const topTagRef = useRef<HTMLDivElement>(null);
  const baseTagRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WealthScene | null>(null);
  const [webgl] = useState(hasWebGL2);
  const latestStats = useRef<Stats | null>(null);
  latestStats.current = stats;

  const set = (patch: Partial<WealthState>) => setState((s) => normalize({ ...s, ...patch }));

  useEffect(() => {
    if (!webgl || !hostRef.current) return;
    const scene = createWealthScene(hostRef.current);
    scene.onStats(setStats);
    // Labels follow the 3D anchors every frame; write to the DOM directly instead of re-rendering.
    const place = (el: HTMLDivElement | null, a: ScreenAnchor) => {
      if (!el) return;
      el.style.transform = `translate(${a.x}px, ${a.y}px)`;
      el.style.opacity = a.visible ? '1' : '0';
    };
    scene.onAnchors((a) => {
      place(topTagRef.current, a.top);
      place(baseTagRef.current, a.base);
    });
    sceneRef.current = scene;
    (window as unknown as { __wealth?: object }).__wealth = { stats: () => latestStats.current, bench: (n = 30) => scene.bench(n) };
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [webgl]);

  useEffect(() => {
    sceneRef.current?.update(state);
    history.replaceState(null, '', writeHash(state));
  }, [state]);

  useEffect(() => {
    const onHash = () => setState(readHash(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const person = personById(state.personId);
  const estimate = estimateById(state.estimateId);
  const isBodies = state.mode === 'bodies';
  const isMusk = state.personId === 'musk';
  const cash = cashCone(person.netWorthUsd);
  const bodies = bodyCone(estimate.deaths);
  const shown = isBodies ? bodies : cash;
  const topName = isBodies ? 'Elon Musk' : person.name;

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="title">Standing on it</h1>

        <div className="count">
          <div className="count-big" data-testid="headline">
            {isBodies ? people(estimate.deaths) : money(person.netWorthUsd)}
          </div>
          <p className="count-status">
            {isBodies ? (
              <>
                Estimated deaths from the USAID cuts. {estimate.status}{' '}
                <a href={estimate.url} target="_blank" rel="noreferrer">
                  {estimate.source}
                </a>
              </>
            ) : (
              <>
                {person.name}'s net worth in $100 bills.{' '}
                <a href={person.url} target="_blank" rel="noreferrer">
                  {person.source}, {shortDate(person.asOf)}
                </a>
              </>
            )}
          </p>
        </div>

        <Chips
          label="Pile"
          value={state.mode}
          options={[
            { id: 'cash', label: 'Cash' },
            { id: 'bodies', label: 'Bodies' },
          ]}
          note={isMusk ? '' : 'Bodies pile is for Elon Musk only.'}
          onChange={(mode) => set(mode === 'bodies' ? { mode, personId: 'musk' } : { mode })}
        />

        <Chips
          label="Person"
          value={state.personId}
          options={PEOPLE.map((p) => ({ id: p.id, label: p.name }))}
          onChange={(personId) => set({ personId, mode: personId === 'musk' ? state.mode : 'cash' })}
        />

        <Chips
          label="Death estimate"
          value={state.estimateId}
          disabled={!isBodies}
          options={ESTIMATES.map((e) => ({ id: e.id, label: `${e.label}, ${people(e.deaths)}` }))}
          onChange={(estimateId) => set({ estimateId })}
        />

        <Chips
          label="Figures"
          value={state.bodyStyle}
          disabled={!isBodies}
          options={[
            { id: 'skeleton', label: 'Skeletons' },
            { id: 'mannequin', label: 'Mannequins' },
            { id: 'shroud', label: 'Shrouded' },
          ]}
          onChange={(bodyStyle) => set({ bodyStyle })}
        />

        <Chips
          label="Camera"
          value={state.camera}
          options={[
            { id: 'close', label: 'Close on the top' },
            { id: 'whole', label: 'Whole pile' },
          ]}
          onChange={(camera) => set({ camera })}
        />

        <div className="section">
          <p className="label">Pile size</p>
          <p className="facts" data-testid="pile-size">
            {shown.height.toFixed(1)} m tall, {(shown.radius * 2).toFixed(0)} m across. About {storeys(shown.height)} storeys.
          </p>
          <p className="facts muted">
            {isMusk
              ? `The bodies pile at ${people(estimate.deaths)} is ${(bodies.height / cashCone(personById('musk').netWorthUsd).height).toFixed(1)}× the height of the cash pile.`
              : `Elon Musk's cash pile is ${cashCone(personById('musk').netWorthUsd).height.toFixed(1)} m tall.`}
          </p>
        </div>

        <details className="method">
          <summary>How this is measured</summary>
          <p>
            Each pile is a cone at a 35° angle of repose, sized from its total volume. A $100 bill is 156 × 66 × 0.11 mm, about
            1.13 cm³, so $1T is about 10 billion bills and 11,400 m³. A piled body is taken as 0.1 m³, averaged across adults and
            children, since more than half of the estimated deaths are children.
          </p>
          <p>Only the outer two layers are drawn. Under them is a solid core of the same shape, so the outline is the true size.</p>
          <p>
            Death figures are model estimates, not counted deaths. The default is the low end of CGD's range. Other analyses put the
            number in the tens of thousands (
            <a href={LOWER_ESTIMATES_NOTE.url} target="_blank" rel="noreferrer">
              {LOWER_ESTIMATES_NOTE.source}
            </a>
            ).
          </p>
          <p>
            Net worth is Forbes real-time. Bloomberg listed Elon Musk at {money(BLOOMBERG_MUSK.netWorthUsd)} on{' '}
            {shortDate(BLOOMBERG_MUSK.asOf)} (
            <a href={BLOOMBERG_MUSK.url} target="_blank" rel="noreferrer">
              {BLOOMBERG_MUSK.source}
            </a>
            ), which would make the cash pile {cashCone(BLOOMBERG_MUSK.netWorthUsd).height.toFixed(1)} m tall.
          </p>
          <p>The note texture is stylized and does not reproduce US currency.</p>
        </details>

        <p className="debug" data-testid="stats">
          {stats ? `${people(stats.instances)} pieces drawn · ${stats.fps ? `${stats.fps} fps while moving` : 'redraws only when the camera moves'}` :' '}
        </p>
      </aside>

      <main className="scene" ref={hostRef} aria-label={`${topName} standing on a pile of ${isBodies ? 'bodies' : 'cash'}`}>
        {!webgl && <p className="scene-msg">This view needs WebGL2, which this browser does not provide.</p>}
        <div className="tag" ref={topTagRef} style={{ opacity: 0 }}>
          <strong>{topName}</strong>
          <span>{isBodies ? `on ${people(estimate.deaths)} bodies` : money(person.netWorthUsd)}</span>
        </div>
        <div className="tag" ref={baseTagRef} style={{ opacity: 0 }}>
          <span>1.75 m person, for scale</span>
        </div>
        <p className="hint">Drag to orbit, scroll to zoom</p>
      </main>
    </div>
  );
}
