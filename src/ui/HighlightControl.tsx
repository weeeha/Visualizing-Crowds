export function HighlightControl({
  value,
  onChange,
}: {
  value: null | { oneIn: number };
  onChange: (v: null | { oneIn: number }) => void;
}) {
  const oneIn = value?.oneIn ?? 50;
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
        value={oneIn}
        disabled={value === null}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n) && n >= 2) onChange({ oneIn: n });
        }}
      />
    </div>
  );
}
