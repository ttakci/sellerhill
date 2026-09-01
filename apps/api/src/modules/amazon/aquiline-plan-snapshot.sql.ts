// apps/api/src/modules/amazon/aquiline-plan-snapshot.sql.ts
//
// `aquiline_plan_snapshot` is append-only and mirrors `keepa_balance`: every
// row is a point-in-time picture of the provider plan, and the admin card
// reads exactly ONE row — the most recent.
//
// That makes the write shared rather than per-writer. Two different call sites
// learn different halves of the picture, and neither ever learns both:
//
//   - `assign` answers with plan_limit / plan_used / plan_remaining, but says
//     nothing about profiles.
//   - the profile-ceiling check counts profiles, which are metered too and,
//     unlike shipments, NEVER reset — but it makes no shipment call.
//
// If each wrote only its own columns, the newest row would be half-null and
// the other half of the picture would silently disappear from the admin card
// the moment the other writer ran. Worse, `isPlanExhausted` reads
// `plan_remaining` off the latest row, so a profiles-only row landing after a
// `planRemaining: 0` row would re-open the short-circuit and spend a call on a
// guaranteed 402. So each write CARRIES FORWARD whatever it does not know from
// the previous row, and the latest row is always the whole current picture.
//
// `plan_code` / `window_key` stay NULL and are carried forward the same way.
// The original reason was cost — a `getMe` call was assumed to spend plan
// usage. Aquiline confirmed on 2026-08-26 that it does not: only a successful
// new `assign` is metered, and every GET is free. So the remaining reason is
// latency, not money: `getMe` is a network round-trip and the conversion path
// is already four provider calls deep, so it does not belong there either.
//
// That leaves `window_key` — the date the allowance resets, which is genuinely
// useful to an operator — unavailable to the admin card. Populating it is now
// a free call from somewhere OFF the hot path (an admin read, or a low-rate
// scheduled refresh); it is deliberately not built yet because adding a
// provider round-trip to an admin page load needs its own fail-soft handling.
// Until then an em dash is honest; a fabricated value is not.

/**
 * Insert one snapshot row, carrying forward every counter the caller passes as
 * NULL from the most recent row. The LEFT JOIN LATERAL over `(SELECT 1)` is
 * what makes it work on an empty table too — a plain `FROM (…latest…)` would
 * insert nothing at all on the very first write.
 *
 * Params, in order: `$1` plan_limit, `$2` plan_used, `$3` plan_remaining,
 * `$4` profiles_used — each nullable, each meaning "unknown, keep the previous
 * value" rather than zero.
 */
export const AQUILINE_PLAN_SNAPSHOT_INSERT_SQL = `
  INSERT INTO aquiline_plan_snapshot
    (plan_code, window_key, plan_limit, plan_used, plan_remaining, profiles_used, captured_at)
  SELECT prev.plan_code,
         prev.window_key,
         COALESCE($1::INT, prev.plan_limit),
         COALESCE($2::INT, prev.plan_used),
         COALESCE($3::INT, prev.plan_remaining),
         COALESCE($4::INT, prev.profiles_used),
         NOW()
    FROM (SELECT 1) AS anchor
    LEFT JOIN LATERAL (
      SELECT plan_code, window_key, plan_limit, plan_used, plan_remaining, profiles_used
        FROM aquiline_plan_snapshot
       ORDER BY captured_at DESC
       LIMIT 1
    ) AS prev ON TRUE
`;

/** Bind order for {@link AQUILINE_PLAN_SNAPSHOT_INSERT_SQL}. Exists so no call
 *  site has to remember the positional order of four same-typed nullable ints —
 *  transposing `planUsed` and `planRemaining` would be invisible in review and
 *  would make the admin card report the opposite of the truth. */
export function buildAquilinePlanSnapshotParams(input: {
  planLimit?: number | null;
  planUsed?: number | null;
  planRemaining?: number | null;
  profilesUsed?: number | null;
}): [number | null, number | null, number | null, number | null] {
  return [
    input.planLimit ?? null,
    input.planUsed ?? null,
    input.planRemaining ?? null,
    input.profilesUsed ?? null,
  ];
}
