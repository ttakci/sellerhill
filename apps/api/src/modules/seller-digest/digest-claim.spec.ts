import { buildDigestClaimSql, toDigestClaim } from './digest-claim';

/**
 * The claim is the whole double-send guard, so its shape is locked here. The
 * statement itself was PREPAREd against Postgres 16 when it was written.
 */
describe('buildDigestClaimSql', () => {
  const sql = buildDigestClaimSql().replace(/\s+/g, ' ');

  it('selects and stamps in one statement, skipping rows another tick holds', () => {
    expect(sql).toContain('FOR UPDATE OF u SKIP LOCKED');
    expect(sql).toMatch(/UPDATE users u SET digest_last_sent_for = due\.report_day FROM due/);
  });

  it('never trusts a stored zone Postgres does not know', () => {
    expect(sql).toContain('pg_timezone_names');
    expect(sql).toContain("ELSE 'UTC'");
  });

  it('is due only once the local send hour has come and yesterday is not summarised yet', () => {
    expect(sql).toContain('EXTRACT(HOUR FROM (now() AT TIME ZONE z.tz)) >= u.digest_send_hour');
    expect(sql).toContain('u.digest_last_sent_for < ((now() AT TIME ZONE z.tz)::date - 1)');
  });

  it('reaches only active customer accounts that have an eBay store and want the mail', () => {
    expect(sql).toContain('u.digest_enabled = TRUE');
    expect(sql).toContain("u.status = 'active'");
    expect(sql).toContain("u.role = 'customer'");
    expect(sql).toContain('EXISTS (SELECT 1 FROM ebay_accounts ea WHERE ea.user_id = u.id)');
  });
});

describe('toDigestClaim', () => {
  it('maps the row and tolerates a missing first name', () => {
    expect(
      toDigestClaim({
        user_id: 'u1',
        email: 'a@b.c',
        first_name: null,
        locale: 'tr',
        timezone: 'Europe/Istanbul',
        report_day: '2026-10-07',
      }),
    ).toEqual({
      userId: 'u1',
      email: 'a@b.c',
      firstName: '',
      locale: 'tr',
      timezone: 'Europe/Istanbul',
      reportDay: '2026-10-07',
    });
  });
});
