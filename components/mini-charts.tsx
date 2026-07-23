// Dependency-free charts (CSS/flex). Pure presentational — safe to server-render.

type Point = { label: string; value: number };

export function DailyBars({ data }: { data: Point[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-sm text-neutral-500">No activity yet.</p>;
  }
  return (
    <div className="flex h-32 items-end gap-1">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-neutral-800"
          style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
          title={`${d.label}: ${d.value}`}
        />
      ))}
    </div>
  );
}

export function HBars({ data }: { data: Point[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-sm text-neutral-500">No data yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 truncate" title={d.label}>
            {d.label}
          </span>
          <div className="h-3 flex-1 rounded bg-neutral-100">
            <div
              className="h-3 rounded bg-neutral-800"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right tabular-nums">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
