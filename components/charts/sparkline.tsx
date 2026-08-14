import { cn } from "@/lib/cn";

/**
 * Trend line for a metric card. Hand-rolled SVG rather than a charting library:
 * a polyline plus an area fill is a few lines of maths, and the smallest chart
 * dependency worth having is ~100KB — real weight on a Kenyan mobile connection
 * for something this simple.
 *
 * Decorative by definition: the number beside it carries the value, and the
 * delta states the direction. Hidden from assistive tech to avoid noise.
 */
export function Sparkline({
  data,
  className,
  stroke = "var(--color-primary)",
  fill = true,
  width = 120,
  height = 32,
}: {
  data: number[];
  className?: string;
  stroke?: string;
  fill?: boolean;
  width?: number;
  height?: number;
}) {
  if (data.length === 0) return null;

  // A flat series should sit on the baseline, not divide by zero.
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const pad = 2;
  const usable = height - pad * 2;

  const points = data.map((value, i) => {
    const x = i * step;
    const y = pad + usable - ((value - min) / span) * usable;
    return [x, y] as const;
  });

  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} ${width},${height} 0,${height}`;
  const gradientId = `spark-${stroke.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full", className)}
      aria-hidden="true"
      focusable="false"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gradientId})`} />
        </>
      )}
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
