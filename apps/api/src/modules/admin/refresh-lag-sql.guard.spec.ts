import * as fs from 'fs';
import * as path from 'path';

/**
 * PostgreSQL only accepts `FILTER (WHERE ...)` immediately after a bare
 * aggregate/window function call — never attached to a larger expression
 * built from one. The refresh-lag query in `admin.service.ts` originally
 * read `(NOW() - MIN(p.next_refresh_at)) FILTER (WHERE ...)`, attaching
 * FILTER to the subtraction rather than to `MIN(...)`, which is a syntax
 * error on every execution (`ERROR: syntax error at or near "FILTER"`,
 * verified live against a real Postgres 16 instance running this schema —
 * see task-12-report.md, "Fix round 1"). Since this query runs unconditionally
 * for both product-data providers, that one line took down the whole
 * `GET /v1/admin/operations/summary` endpoint.
 *
 * This is a plain string in a template literal, so no unit test that mocks
 * `DatabaseService.query` can catch a syntax error in it — a source-grep is
 * the only test-time signal that the correct shape hasn't regressed.
 *
 * The positive assertion is anchored on the FULL expression and matched
 * AFTER stripping comments (task-12-rereview.md, finding 2): the
 * explanatory paragraph above the query quotes the shorter fragment
 * `MIN(p.next_refresh_at) FILTER (WHERE` verbatim in backticks, so a bare
 * `.toContain(...)` of just that fragment against the raw file is satisfied
 * by the comment alone, whether or not the real SQL still has it. See the
 * mutation-resistance test below for a reproduction of exactly that gap.
 */

// Strips `//` line comments and `/* */` block comments before matching, so a
// comment that quotes the SQL shape cannot satisfy an assertion meant to
// prove the QUERY still has that shape.
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const FULL_EXPRESSION = 'EXTRACT(EPOCH FROM (NOW() - MIN(p.next_refresh_at) FILTER (WHERE';

describe('admin.service.ts refresh-lag query shape', () => {
  const rawSource = fs.readFileSync(path.join(__dirname, 'admin.service.ts'), 'utf8');
  const source = stripComments(rawSource);

  it('binds FILTER directly to the MIN(...) aggregate, not to the surrounding expression', () => {
    // Anchored on the FULL expression (not just the "MIN(...) FILTER (WHERE"
    // fragment) and matched after stripping comments — see the file header
    // for why a shorter, unstripped needle is vacuous here.
    expect(source).toContain(FULL_EXPRESSION);
  });

  it('never re-introduces FILTER attached to a closing paren after MIN(...)', () => {
    // The broken shape closed the parenthesized `(NOW() - MIN(...))`
    // expression BEFORE attaching FILTER, i.e. "MIN(p.next_refresh_at)) FILTER".
    expect(source).not.toMatch(/MIN\(p\.next_refresh_at\)\)\s*FILTER/);
  });

  it('is not vacuous: fails if the FILTER clause is deleted from the SQL, even though the comment above it still quotes it', () => {
    // Reproduces task-12-rereview.md's mutation A2 against the REAL file: the
    // SQL occurrence of the full expression (never the comment, which does
    // not contain "EXTRACT(EPOCH FROM (NOW() -") is located and only the
    // FILTER clause immediately following it is deleted — valid SQL, but a
    // silent behavior change (the lag figure could go negative, since
    // NOW() - MIN(next_refresh_at) over ALL rows including future ones is
    // negative). The comment quoting "MIN(p.next_refresh_at) FILTER (WHERE"
    // survives this mutation untouched, which is exactly what let the old,
    // unstripped/unanchored assertion pass regardless.
    const sqlIndex = rawSource.indexOf(FULL_EXPRESSION);
    expect(sqlIndex).toBeGreaterThan(-1);
    const markerEnd = rawSource.indexOf(') / 60 AS lag_minutes,', sqlIndex);
    expect(markerEnd).toBeGreaterThan(sqlIndex);
    const sqlSliceEnd = markerEnd + ') / 60 AS lag_minutes,'.length;

    const beforeSql = rawSource.slice(0, sqlIndex);
    const sqlSlice = rawSource.slice(sqlIndex, sqlSliceEnd);
    const afterSql = rawSource.slice(sqlSliceEnd);

    const mutatedSqlSlice = sqlSlice.replace(' FILTER (WHERE p.next_refresh_at < NOW())', '');
    // Sanity: the mutation actually landed on the SQL, not on nothing.
    expect(mutatedSqlSlice).not.toBe(sqlSlice);

    const mutatedRaw = beforeSql + mutatedSqlSlice + afterSql;
    // The comment quoting the fragment is untouched by this mutation — the
    // trap the old assertion fell into is still present.
    expect(mutatedRaw).toContain('MIN(p.next_refresh_at) FILTER (WHERE');

    const mutatedSource = stripComments(mutatedRaw);
    expect(mutatedSource).not.toContain(FULL_EXPRESSION);
  });
});
