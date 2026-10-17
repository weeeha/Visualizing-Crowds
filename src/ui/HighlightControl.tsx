import { useEffect, useState } from 'react';

export function HighlightControl({
  value,
  onChange,
}: {
  value: null | { oneIn: number };
  onChange: (v: null | { oneIn: number }) => void;
}) {
  const oneIn = value?.oneIn ?? 50;
  // Local text so partial input ("1" on the way to "100", or empty) is allowed while typing.
  const [text, setText] = useState(String(oneIn));
  useEffect(() => setText(String(oneIn)), [oneIn]);
  const commit = () => {
    const n = Math.round(Number(text));
    if (value === null || !Number.isFinite(n) || text.trim() === '') return setText(String(oneIn));
    const next = Math.max(2, n);
    setText(String(next));
    if (next !== oneIn) onChange({ oneIn: next });
  };
  return (
    <div className="highlight">
      <label>
        <input type="checkbox" checked={value !== null} onChange={(e) => onChange(e.target.checked ? { oneIn } : null)} />
        Highlight 1 in
      </label>
      <input
        type="number"
        aria-label="Highlight ratio"
        min={2}
        step={1}
        value={text}
        disabled={value === null}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
      />
    </div>
  );
}
