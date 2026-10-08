import { UserRole, UserStatus } from '@repo/shared';

/**
 * One row the hourly tick claimed: a seller whose local send hour has come and
 * whose previous local day has not been summarised yet.
 */
export interface DigestClaim {
  userId: string;
  email: string;
  firstName: string;
  locale: string | null;
  /** The zone the day was computed in (validated; UTC when the stored one is empty or unknown). */
  timezone: string;
  /** The seller's local day the summary covers, `YYYY-MM-DD`. */
  reportDay: string;
}

export interface DigestClaimRow {
  user_id: string;
  email: string;
  first_name: string | null;
  locale: string | null;
  timezone: string;
  report_day: string;
}

/**
 * Claims due sellers and stamps `digest_last_sent_for` in ONE statement, so two
 * ticks (or two replicas) can never claim the same seller for the same day.
 *
 * - The zone is checked against `pg_timezone_names` inside the statement: a
 *   name Postgres does not know would raise 22023 and fail the whole batch.
 * - "Due" = the local hour has reached the seller's send hour AND the last
 *   summarised day is older than local yesterday. A tick that is missed (deploy,
 *   Redis down) is caught by the next one; nobody gets two mails for one day.
 * - Only active customer accounts with at least one eBay store (the same
 *   predicate `EbayAccountGuard` uses: any row).
 *
 * `$1` = batch size.
 */
export function buildDigestClaimSql(): string {
  return `
    WITH zones AS MATERIALIZED (SELECT name FROM pg_timezone_names),
    due AS (
      SELECT u.id,
             z.tz,
             ((now() AT TIME ZONE z.tz)::date - 1) AS report_day
        FROM users u
        CROSS JOIN LATERAL (
          SELECT CASE
                   WHEN u.timezone IS NOT NULL AND EXISTS (SELECT 1 FROM zones WHERE zones.name = u.timezone)
                   THEN u.timezone
                   ELSE 'UTC'
                 END AS tz
        ) z
       WHERE u.digest_enabled = TRUE
         AND u.status = '${UserStatus.ACTIVE}'
         AND u.role = '${UserRole.CUSTOMER}'
         AND EXISTS (SELECT 1 FROM ebay_accounts ea WHERE ea.user_id = u.id)
         AND EXTRACT(HOUR FROM (now() AT TIME ZONE z.tz)) >= u.digest_send_hour
         AND (u.digest_last_sent_for IS NULL
              OR u.digest_last_sent_for < ((now() AT TIME ZONE z.tz)::date - 1))
       ORDER BY u.id
       LIMIT $1::int
       FOR UPDATE OF u SKIP LOCKED
    )
    UPDATE users u
       SET digest_last_sent_for = due.report_day
      FROM due
     WHERE u.id = due.id
    RETURNING u.id AS user_id,
              u.email,
              u.first_name,
              u.locale,
              due.tz AS timezone,
              to_char(due.report_day, 'YYYY-MM-DD') AS report_day`;
}

export function toDigestClaim(row: DigestClaimRow): DigestClaim {
  return {
    userId: row.user_id,
    email: row.email,
    firstName: row.first_name ?? '',
    locale: row.locale,
    timezone: row.timezone,
    reportDay: row.report_day,
  };
}
