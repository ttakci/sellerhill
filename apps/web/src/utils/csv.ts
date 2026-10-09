/**
 * Client-side CSV export for the list pages that page through the API
 * (returns, cancellations): every row matching the current filters, not
 * just the page on screen.
 */

export type CsvCell = string | number | null | undefined;

/** A page of rows plus the total the API reports for the whole filtered set. */
export interface CsvPage<T> {
  items: T[];
  total: number;
}

/** No export may page through more than this many rows (the listings export caps at 5,000 too). */
export const CSV_EXPORT_MAX_ROWS = 5000;

/*
 * A cell that starts with = + - @ (or a tab / carriage return) is run as a
 * formula by Excel and Sheets, and buyer-written text reaches these files —
 * so such a cell is prefixed with an apostrophe (OWASP's CSV-injection rule).
 * The one exception is a cell that is WHOLLY a negative figure ("-12,50",
 * "-$3.10"): it stays a number. "-2+3+cmd|..." is not wholly a figure.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NEGATIVE_FIGURE = /^-[$€£₺]?\d[\d.,]*$/;

const isFormulaLike = (text: string): boolean => FORMULA_START.test(text) && !PLAIN_NEGATIVE_FIGURE.test(text);

const toCell = (value: CsvCell): string => {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = isFormulaLike(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** Header row + rows, every cell quoted, CRLF line ends (what Excel expects). */
export const buildCsv = (headers: string[], rows: CsvCell[][]): string =>
  [headers, ...rows].map((row) => row.map(toCell).join(',')).join('\r\n');

/**
 * Reads page after page until the reported total is reached (or a page comes
 * back short), never past `maxRows`.
 */
export const fetchAllPages = async <T>(
  fetchPage: (page: number, limit: number) => Promise<CsvPage<T>>,
  pageSize: number,
  maxRows: number = CSV_EXPORT_MAX_ROWS
): Promise<T[]> => {
  const all: T[] = [];
  for (let page = 1; all.length < maxRows; page += 1) {
    const { items, total } = await fetchPage(page, pageSize);
    all.push(...items);
    if (items.length < pageSize || all.length >= total) {
      break;
    }
  }
  return all.slice(0, maxRows);
};

/** Saves the CSV as `<fileStem>_<YYYY-MM-DD>.csv`. A BOM keeps Excel reading it as UTF-8 (ş, ğ, ı…). */
export const downloadCsv = (fileStem: string, headers: string[], rows: CsvCell[][]): void => {
  const blob = new Blob(['﻿', buildCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${fileStem}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
