import { useEffect, useRef, useState } from 'react';
import { people, storeys } from '../format';
import { bodyCone } from '../pile/volume';
import { hasWebGL2 } from '../render/scene';
import { heapDeaths, leaderById, LEADERS, type Estimate } from './data';
import { createRankingScene, type Anchor, type RankCamera, type RankingScene, type RankingState } from './rankingScene';

const DEFAULT: RankingState = { selected: 'hitler', estimate: 'low', camera: 'row' };

function readHash(h: string): RankingState {
  const p = new URLSearchParams(h.replace(/^#/, ''));
  const sel = p.get('leader');
  return {
    selected: LEADERS.some((l) => l.id === sel) ? sel! : DEFAULT.selected,
    estimate: p.get('estimate') === 'high' ? 'high' : 'low',
    camera: (['close', 'heap', 'row'] as RankCamera[]).find((c) => c === p.get('view')) ?? DEFAULT.camera,
  };
}
const writeHash = (s: RankingState) => `#${new URLSearchParams({ leader: s.selected, estimate: s.estimate, view: s.camera })}`;

const short = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}K`);

export function RankingApp() {
  const [state, setState] = useState<RankingState>(() => readHash(location.hash));
  const hostRef = useRef<HTMLDivElement>(null);
  const tagRefs = useRef(new Map<string, HTMLButtonElement>());
  const baseRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RankingScene | null>(null);
  const [webgl] = useState(hasWebGL2);
  const set = (patch: Partial<RankingState>) => setState((s) => ({ ...s, ...patch }));
  const selectedRef = useRef(state.selected);
  selectedRef.current = state.selected;

  useEffect(() => {
    if (!webgl || !hostRef.current) return;
    const scene = createRankingScene(hostRef.current);
    const place = (el: HTMLElement | null | undefined, a: Anchor) => {
      if (!el) return;
      el.style.transform = `translate(${a.x}px, ${a.y}px)`;
      el.style.opacity = a.visible ? '1' : '0';
      el.style.pointerEvents = a.visible ? 'auto' : 'none';
    };
    // Labels in rank order; one that would overlap a label already shown is hidden. The selected one always shows.
    scene.onAnchors((tops, base) => {
      const shown: { l: number; r: number; t: number; b: number }[] = [];
      const sel = selectedRef.current;
      const order = [...tops].sort((a, b) => (a.id === sel ? -1 : b.id === sel ? 1 : 0));
      for (const a of order) {
        const el = tagRefs.current.get(a.id);
        if (!el) continue;
        const w = el.offsetWidth, h = el.offsetHeight;
        const box = { l: a.x - w / 2, r: a.x + w / 2, t: a.y - h, b: a.y };
        const clash = shown.some((s) => box.l < s.r + 4 && box.r > s.l - 4 && box.t < s.b && box.b > s.t);
        place(el, { ...a, visible: a.visible && !clash });
        if (a.visible && !clash) shown.push(box);
      }
      place(baseRef.current, base);
    });
    sceneRef.current = scene;
    (window as unknown as { __ranking?: object }).__ranking = { bench: (n = 20) => scene.bench(n) };
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [webgl]);

  useEffect(() => {
    const onHash = () => setState(readHash(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    sceneRef.current?.update(state);
    history.replaceState(null, '', writeHash(state));
  }, [state]);

  const leader = leaderById(state.selected);
  const deaths = heapDeaths(leader, state.estimate);
  const cone = bodyCone(deaths);
  const biggest = bodyCone(Math.max(...LEADERS.map((l) => heapDeaths(l, state.estimate))));
  const ranked = LEADERS.filter((l) => l.rank !== null);
  const total = ranked.reduce((a, l) => a + heapDeaths(l, state.estimate), 0);

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="title">Standing on it: the ranking</h1>

        <div className="count">
          <div className="count-big" data-testid="headline">{people(deaths)}</div>
          <p className="count-status">
            <strong>{leader.rank ? `No. ${leader.rank}` : 'Unranked'} · {leader.name}</strong>, {leader.stated}. {leader.note}{' '}
            <span className="muted">{leader.source}</span>
          </p>
        </div>

        <div className="section" role="group" aria-label="Estimate">
          <p className="label">Estimate</p>
          <div className="chips">
            {(['low', 'high'] as Estimate[]).map((e) => (
              <button key={e} type="button" className={`chip${state.estimate === e ? ' on' : ''}`} aria-pressed={state.estimate === e} onClick={() => set({ estimate: e })}>
                {e === 'low' ? 'Low end' : 'High end'}
              </button>
            ))}
          </div>
          <p className="note">{state.estimate === 'low' ? 'The faint shell around a heap is its size at the high end.' : ''}</p>
        </div>

        <div className="section" role="group" aria-label="Camera">
          <p className="label">Camera</p>
          <div className="chips">
            {([['row', 'The whole row'], ['heap', 'One heap'], ['close', 'Close on the top']] as [RankCamera, string][]).map(([c, label]) => (
              <button key={c} type="button" className={`chip${state.camera === c ? ' on' : ''}`} aria-pressed={state.camera === c} onClick={() => set({ camera: c })}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="section">
          <p className="label">Pile size</p>
          <p className="facts" data-testid="pile-size">
            {cone.height.toFixed(1)} m tall, {(cone.radius * 2).toFixed(0)} m across. About {storeys(cone.height)} storeys.
          </p>
          <p className="facts muted">
            The tallest heap here is {biggest.height.toFixed(0)} m. All seventeen ranked heaps hold {short(total)} deaths.
          </p>
        </div>

        <div className="section">
          <p className="label">Leaders</p>
          <ol className="rank-list">
            {LEADERS.map((l) => (
              <li key={l.id}>
                <button type="button" className={`rank-row${l.id === state.selected ? ' on' : ''}`} aria-pressed={l.id === state.selected} onClick={() => set({ selected: l.id, camera: 'close' })}>
                  <span className="rk">{l.rank ?? '–'}</span>
                  <span className="nm">{l.name}</span>
                  <span className="ct">{short(heapDeaths(l, state.estimate))}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <details className="method">
          <summary>How this is measured</summary>
          <p>
            Each heap is a cone at a 35° angle of repose, sized from its total volume at 0.1 m³ per body, the same rule as the
            USAID pile. Figures are those given in the ranking list, with its wording; counting methods differ between sources,
            and the World War II tolls for Hitler and Hirohito come from the same war.
          </p>
          <p>
            The selected heap is covered in skeletons from its peak to the ground, with the most detail near the top. The
            other heaps carry skeletons at the peak and round the foot; the slope between is a textured surface of the same
            size. Where a source gives only an upper bound, the heap uses that bound in both views.
          </p>
          <p>
            Each figure on top is 1.75 m tall and dressed in the leader's period clothing. Faces are left blank, so these are
            figures in costume and not likenesses.
          </p>
        </details>
      </aside>

      <main className="scene" ref={hostRef} aria-label={`${leader.name} standing on a heap of ${people(deaths)} bodies, in a row of eighteen heaps`}>
        {!webgl && <p className="scene-msg">This view needs WebGL2, which this browser does not provide.</p>}
        {LEADERS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={`tag rank-tag${l.id === state.selected ? ' on' : ''}`}
            ref={(el) => {
              if (el) tagRefs.current.set(l.id, el);
              else tagRefs.current.delete(l.id);
            }}
            style={{ opacity: 0 }}
            onClick={() => set({ selected: l.id, camera: 'close' })}
          >
            <strong>{l.name}</strong>
            <span>{short(heapDeaths(l, state.estimate))}</span>
          </button>
        ))}
        <div className="tag" ref={baseRef} style={{ opacity: 0 }}>
          <span>1.75 m person, for scale</span>
        </div>
        <p className="hint">Drag to orbit, right-drag to pan, scroll to zoom</p>
      </main>
    </div>
  );
}
