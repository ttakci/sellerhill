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
 */
describe('admin.service.ts refresh-lag query shape', () => {
  const source = fs.readFileSync(path.join(__dirname, 'admin.service.ts'), 'utf8');

  it('binds FILTER directly to the MIN(...) aggregate, not to the surrounding expression', () => {
    expect(source).toContain('MIN(p.next_refresh_at) FILTER (WHERE');
  });

  it('never re-introduces FILTER attached to a closing paren after MIN(...)', () => {
    // The broken shape closed the parenthesized `(NOW() - MIN(...))`
    // expression BEFORE attaching FILTER, i.e. "MIN(p.next_refresh_at)) FILTER".
    expect(source).not.toMatch(/MIN\(p\.next_refresh_at\)\)\s*FILTER/);
  });
});
