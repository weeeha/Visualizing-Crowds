import { useEffect, useState, type ReactNode } from 'react';
import { countToPos, formatCount, parseCount, posToCount, shortCount } from './logScale';

const STEPS = 1000;
const TICKS = [50, 1_000, 100_000, 1_000_000, 20_000_000];

/** `status` sits under the big number in a slot reserved at rest, so an overflow message never shifts the panel. */
export function CountControl({ count, onChange, status }: { count: number; onChange: (n: number) => void; status: ReactNode }) {
  const [text, setText] = useState(formatCount(count));
  useEffect(() => setText(formatCount(count)), [count]);
  const commit = () => {
    const n = parseCount(text);
    setText(formatCount(n ?? count)); // always show the committed value, even when the count is unchanged
    if (n !== null) onChange(n);
  };
  return (
    <div className="count">
      <div className="count-big" data-testid="count-big">{formatCount(count)}</div>
      <div className="count-status" role="status">{status}</div>
      <input
        className="count-slider"
        type="range"
        aria-label="People count"
        min={0}
        max={STEPS}
        step={1}
        value={Math.round(countToPos(count) * STEPS)}
        onChange={(e) => onChange(posToCount(Number(e.target.value) / STEPS))}
      />
      <div className="ticks" aria-hidden="true">
        {TICKS.map((t) => (
          <span key={t} style={{ left: `${countToPos(t) * 100}%` }}>{shortCount(t)}</span>
        ))}
      </div>
      <input
        className="count-input"
        aria-label="Exact people count"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
      />
    </div>
  );
}
