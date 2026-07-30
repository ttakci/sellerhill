/**
 * P&L matrix helpers: heat-map intensity + client-side CSV export.
 * The matrix is 12 columns × ~15 rows and already in memory, so no API round-trip.
 */

/** 0…1 intensity of `value` relative to the largest absolute value in its row. */
export function heatIntensity(value: number, rowValues: number[]): number {
  let max = 0;
  for (const v of rowValues) {
    const abs = Math.abs(v);
    if (Number.isFinite(abs) && abs > max) {
      max = abs;
    }
  }
  if (max <= 0 || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.abs(value) / max, 1);
}

const escapeCell = (value: string): string =>
  /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** RFC-4180 CSV from already-labelled rows (values stay raw numbers). */
export function buildPnlCsv(params: {
  parameterLabel: string;
  columnLabels: string[];
  rows: { label: string; values: number[] }[];
}): string {
  const header = [params.parameterLabel, ...params.columnLabels].map(escapeCell).join(',');
  const body = params.rows.map((row) =>
    [escapeCell(row.label), ...row.values.map((v) => String(v))].join(','),
  );
  return [header, ...body].join('\r\n');
}

/** UTF-8 byte-order mark — makes Excel read the file as UTF-8. */
const BOM = '\uFEFF';

/** Triggers a browser download for the given CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  // UTF-8 BOM so Excel opens Turkish characters correctly.
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
