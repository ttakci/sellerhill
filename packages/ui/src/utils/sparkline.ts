/**
 * Polyline points for a sparkline in viewBox units (x 0…width, y 0…height,
 * y grows downward). Scales between the series' min and max; a series with no
 * spread (all zeros, a constant, a single point) is drawn flat — at the
 * baseline when it is zero, mid-height otherwise — never NaN.
 */
export function buildSparklinePoints(values: number[], width: number, height: number, padding = 1): string {
  const top = padding;
  const bottom = height - padding;
  const mid = (top + bottom) / 2;
  const fmt = (n: number) => String(Math.round(n * 100) / 100);
  if (values.length === 0) {
    return `0,${fmt(bottom)} ${fmt(width)},${fmt(bottom)}`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) {
    const y = max === 0 ? bottom : mid;
    return `0,${fmt(y)} ${fmt(width)},${fmt(y)}`;
  }
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((v, i) => `${fmt(i * step)},${fmt(bottom - ((v - min) / (max - min)) * (bottom - top))}`)
    .join(' ');
}
