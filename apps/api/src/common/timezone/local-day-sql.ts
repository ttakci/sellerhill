/**
 * Local-calendar-day bounds for a timestamptz column.
 *
 * A filter ALWAYS compares the raw column against two instants (local midnight
 * of `from`, local midnight of the day after `to`) — index-friendly, and right
 * on a 23- or 25-hour DST day. Never cast the column (`col AT TIME ZONE tz`) in
 * a WHERE; that is for GROUP BY buckets only.
 *
 * Arguments are SQL expressions (placeholders like `$2`, or `w.d_from`), never
 * user text.
 */
export function localDayStartSql(dateExpr: string, tzExpr: string): string {
  return `((${dateExpr})::date::timestamp AT TIME ZONE (${tzExpr})::text)`;
}

export function localDayEndExclusiveSql(dateExpr: string, tzExpr: string): string {
  return `(((${dateExpr})::date + 1)::timestamp AT TIME ZONE (${tzExpr})::text)`;
}

export function buildLocalRangeSql(column: string, fromExpr: string, toExpr: string, tzExpr: string): string {
  return `${column} >= ${localDayStartSql(fromExpr, tzExpr)} AND ${column} < ${localDayEndExclusiveSql(toExpr, tzExpr)}`;
}
