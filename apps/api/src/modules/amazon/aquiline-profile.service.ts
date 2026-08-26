// apps/api/src/modules/amazon/aquiline-profile.service.ts
//
// Creates and maintains the one Aquiline "profile" a seller's Amazon orders
// are grouped under. A profile CANNOT be deleted — `/v1/profiles/{id}`
// exposes only GET and PATCH — one provider account serves every environment,
// and the purchased plan includes exactly `AQUILINE_MAX_PROFILES` (10 on
// Starter) of them. Every path here is written around that: create as late as
// possible, exactly once, and never speculatively.
//
// `ensureProfile` NEVER throws. Every failure — an incomplete address, a
// provider error of any kind, the profile ceiling, a DB error — returns
// `null`, and the caller (a later task, `TrackingConversionService`) falls
// back to sending the raw Amazon tracking number under its real carrier. That
// fallback is honest and correct, so a profile is an optimization on top of
// it, never a hard dependency the conversion pipeline can be blocked by.

import { Injectable, Logger } from '@nestjs/common';
import {
  AmazonMarketplace,
  AquilineAccountOrigin,
  PlatformSettingKey,
  type AquilineStoreAddress,
} from '@repo/shared';
import type { PoolClient } from 'pg';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import {
  AQUILINE_PLAN_SNAPSHOT_INSERT_SQL,
  buildAquilinePlanSnapshotParams,
} from './aquiline-plan-snapshot.sql';
import { buildAquilineProfileId, fingerprintProfile } from './aquiline-profile.helpers';
import {
  AquilineClient,
  AquilineError,
  AquilineErrorKind,
  type AquilineConfig,
} from './aquiline.client';

/** Amazon has no sandbox and no non-US site the platform supports today (see
 *  CLAUDE.md "Multi-marketplace architecture") — this mirrors the constant
 *  literal `AmazonCheckoutService`/`AmazonScrapingService` already navigate
 *  to, kept local since profile creation is the only Aquiline concern that
 *  needs it. */
const AMAZON_MARKETPLACE_HOST = 'www.amazon.com';

/**
 * Per-call ceiling for the two provider calls made while the GLOBAL
 * profile-create advisory lock is held.
 *
 * The lock is deliberately global (one profile ceiling for the whole provider
 * account) and is held across `listProfiles` + `createProfile`. At the normal
 * `AQUILINE_TIMEOUT_MS` (15s) each of those can take ~46s after the client's
 * three bounded retries, so the worst case is ~90s of a Postgres transaction —
 * and every other seller's first conversion queues behind it, each holding a
 * pooled connection while it waits.
 *
 * Bounding the TIMEOUT is the right lever, and restructuring the lock is not:
 * the ceiling check and the create have to be atomic or two users can both see
 * 9/10 and both create, and a profile can never be deleted to recover. So the
 * race stays closed and the wait is made short — worst case ~16s per call
 * instead of ~46s. A call that trips this bound fails the same way any other
 * provider failure does: `ensureProfile` returns null and the conversion falls
 * back to the honest pass-through, retried on the next tick.
 */
const AQUILINE_LOCKED_CALL_TIMEOUT_MS = 5_000;

interface AquilineProfileRow {
  profile_id: string;
  fingerprint: string | null;
}

interface GlobalStoreSettingsAddressRow {
  ship_from_name: string | null;
  ship_from_phone: string | null;
  ship_from_address_line1: string | null;
  ship_from_address_line2: string | null;
  ship_from_city: string | null;
  country: string | null;
  state: string | null;
  zip_code: string | null;
}

@Injectable()
export class AquilineProfileService {
  private readonly logger = new Logger(AquilineProfileService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly client: AquilineClient,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /**
   * Returns the Aquiline profile id for (userId, marketplace) — creating or
   * PATCHing it as needed — or `null` when the caller must pass the raw
   * Amazon tracking number through instead.
   *
   * Decision order (mirrors the task brief):
   *  1. Resolve the ship-from address from the user's global `store_settings`
   *     row. Incomplete (missing street/city/country) → `null`. Creating a
   *     profile without a deliverable address burns a permanent slot on
   *     something the provider may refuse outright.
   *  2. Compute the deterministic id + a fingerprint of everything a PATCH
   *     would change.
   *  3. A cached row with a matching fingerprint returns immediately — NO
   *     provider call at all, so a misconfigured/revoked token still serves
   *     the cached id.
   *  4. A cached row with a stale fingerprint PATCHes and updates the row.
   *  5. No row: a GLOBAL advisory lock (fixed namespace, no per-user
   *     component — see the lock acquisition below for why) serializes EVERY
   *     seller's first-create against every other seller's, because
   *     `AQUILINE_MAX_PROFILES` is a ceiling on the whole provider account,
   *     not per user. The row is re-read inside the lock, the profile
   *     ceiling is checked against `listProfiles()` BEFORE creating (the
   *     resource cannot be reclaimed), and only then is the profile created
   *     — all of it under the one lock, held for the whole sequence.
   */
  async ensureProfile(
    userId: string,
    marketplace: AmazonMarketplace,
    hintEmail: string | null,
  ): Promise<string | null> {
    const address = await this.resolveShipFromAddress(userId);
    if (!address) {
      this.logger.warn(
        `Aquiline profile skipped for user ${userId}: no complete ship-from address configured in Store Settings`,
      );
      return null;
    }

    const config = await this.resolveConfig();
    const profileId = buildAquilineProfileId(config.profilePrefix, userId, marketplace);
    // The label has no separate source field in `store_settings` — the
    // profile id itself is deterministic, always available and matches the
    // precedent `aquiline-probe.ts` already uses (`label: args.createProfile`).
    const label = profileId;
    const fingerprint = fingerprintProfile(label, address);

    const existing = await this.readRow(userId, marketplace);
    if (existing) {
      if (existing.fingerprint === fingerprint) {
        return existing.profile_id;
      }
      const patched = await this.callPatchProfile(
        existing.profile_id,
        userId,
        label,
        address,
        config,
      );
      if (!patched) {
        return null;
      }
      // A failed fingerprint write must not lose a profile id we already
      // hold — log and keep the id; the next call simply re-PATCHes.
      try {
        await this.db.query(
          `UPDATE aquiline_profiles SET fingerprint = $1, synced_at = NOW() WHERE user_id = $2 AND marketplace = $3`,
          [fingerprint, userId, marketplace],
        );
      } catch (err) {
        this.logger.error(
          `Aquiline profile ${existing.profile_id} PATCHed but the fingerprint write failed for user ${userId}: ${describeAquilineError(err)}`,
        );
      }
      return existing.profile_id;
    }

    try {
      return await this.db.transaction(async (client) => {
        // GLOBAL lock — fixed namespace, deliberately NO per-user component.
        // A per-user key (the original, reviewed-out version of this lock)
        // only stops one user creating two profiles; it does nothing to stop
        // two DIFFERENT users, each taking a different lock key, both
        // observing 9/10 from `listProfiles()` and both creating — 11
        // profiles on a 10-profile plan, permanently, with no DELETE to
        // recover. `AQUILINE_MAX_PROFILES` is a ceiling on the whole
        // provider account, not per user, so the lock that protects it must
        // be too. A global lock is strictly stronger than a per-user one —
        // it already serializes two attempts for the SAME user — so there is
        // no separate per-user lock to keep. Contention is a non-issue: a
        // profile is created once per seller for the lifetime of the
        // account. Held for the WHOLE sequence below (re-read, ceiling
        // check, create, insert) — releasing it early would reopen exactly
        // the race this fixes.
        await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
          'aquiline-profile-create',
        ]);

        // Every provider call made while this transaction holds the lock uses a
        // SHORTER per-call timeout than the rest of this service — see
        // AQUILINE_LOCKED_CALL_TIMEOUT_MS. It is the only config field that
        // differs; base URL, token, prefix and ceiling are untouched. Defined
        // here, right after acquiring the lock, so EVERY call under the lock
        // uses it — a slow/hung provider must hold this transaction's pooled
        // connection for a bounded time, not up to the full outer timeout.
        const lockedConfig: AquilineConfig = {
          ...config,
          timeoutMs: Math.min(config.timeoutMs, AQUILINE_LOCKED_CALL_TIMEOUT_MS),
        };

        // Another request may have created the profile while we waited on
        // the lock.
        const rowAfterLock = await this.readRowWithClient(client, userId, marketplace);
        if (rowAfterLock) {
          if (rowAfterLock.fingerprint === fingerprint) {
            return rowAfterLock.profile_id;
          }
          const patched = await this.callPatchProfile(
            rowAfterLock.profile_id,
            userId,
            label,
            address,
            lockedConfig,
          );
          if (!patched) {
            return null;
          }
          // A failed fingerprint write must not lose a profile id we already
          // hold — log and keep the id rather than forcing pass-through over
          // a bookkeeping failure. The next call re-PATCHes (harmless) since
          // the stored fingerprint is still stale.
          try {
            await client.query(
              `UPDATE aquiline_profiles SET fingerprint = $1, synced_at = NOW() WHERE user_id = $2 AND marketplace = $3`,
              [fingerprint, userId, marketplace],
            );
          } catch (err) {
            this.logger.error(
              `Aquiline profile ${rowAfterLock.profile_id} PATCHed but the fingerprint write failed for user ${userId}: ${describeAquilineError(err)}`,
            );
          }
          return rowAfterLock.profile_id;
        }

        // Ceiling guard — checked BEFORE creation, because the slot can
        // never be reclaimed once spent.
        let profileCount: number;
        try {
          const list = await this.client.listProfiles(lockedConfig);
          profileCount = list.items.length;
        } catch (err) {
          this.logger.error(
            `Aquiline profile-ceiling check failed for user ${userId}: ${describeAquilineError(err)}`,
          );
          return null;
        }
        // The ceiling check is the ONLY place the platform ever learns how many
        // profiles are in use, and profiles are the one metered Aquiline
        // resource that never resets. Recording it here is what stops the
        // admin card's profile figure rendering an em dash forever. Best-effort
        // and outside the lock's own client on purpose: a bookkeeping failure
        // must not abort the transaction that is about to create a permanent,
        // paid resource.
        void this.recordProfilesUsed(profileCount);

        if (profileCount >= config.maxProfiles) {
          this.logger.error(
            `Aquiline profile ceiling reached (${profileCount}/${config.maxProfiles}) — refusing to create a profile for user ${userId}, marketplace ${marketplace}`,
          );
          return null;
        }

        let createdProfileId: string | null;
        try {
          const created = await this.client.createProfile(
            {
              accountOrigin: AquilineAccountOrigin.AMAZON,
              profileId,
              label,
              marketplaceHost: AMAZON_MARKETPLACE_HOST,
              ...(hintEmail ? { amazonAccountEmail: hintEmail } : {}),
              storeAddress: address,
            },
            lockedConfig,
          );
          createdProfileId = created.profileId || profileId;
        } catch (err) {
          createdProfileId = await this.recoverFromCreateConflict(profileId, err, lockedConfig);
          if (!createdProfileId) {
            this.logger.error(
              `Aquiline createProfile failed for user ${userId}, marketplace ${marketplace}: ${describeAquilineError(err)}`,
            );
            return null;
          }
          this.logger.warn(
            `Aquiline createProfile for user ${userId} answered a conflict; recovered existing profile ${createdProfileId} via GET (crash-recovery path)`,
          );
        }

        // Same "don't lose an id we already hold" rule as the PATCH branch
        // above: the provider profile now genuinely exists (created or
        // recovered), so a local persistence failure must not turn a real,
        // billable resource into a `null` that forces pass-through. The
        // deterministic id makes this self-healing — the next call's
        // createProfile will hit the same conflict and recover the same id
        // via GET, then persist it.
        try {
          await client.query(
            `INSERT INTO aquiline_profiles (user_id, marketplace, profile_id, fingerprint, synced_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (user_id, marketplace) DO UPDATE
               SET profile_id = EXCLUDED.profile_id,
                   fingerprint = EXCLUDED.fingerprint,
                   synced_at = NOW()`,
            [userId, marketplace, createdProfileId, fingerprint],
          );
        } catch (err) {
          this.logger.error(
            `Aquiline profile ${createdProfileId} created but the local row write failed for user ${userId}: ${describeAquilineError(err)}`,
          );
        }

        return createdProfileId;
      });
    } catch (err) {
      this.logger.error(
        `Aquiline profile creation failed for user ${userId}, marketplace ${marketplace}: ${describeAquilineError(err)}`,
      );
      return null;
    }
  }

  /** Persist the observed profile count into `aquiline_plan_snapshot`,
   *  carrying the shipment counters forward from the previous row (see
   *  `aquiline-plan-snapshot.sql.ts` for why the carry-forward matters). Never
   *  throws and is never awaited by the create path — it is bookkeeping. */
  private async recordProfilesUsed(profilesUsed: number): Promise<void> {
    try {
      await this.db.query(
        AQUILINE_PLAN_SNAPSHOT_INSERT_SQL,
        buildAquilinePlanSnapshotParams({ profilesUsed }),
      );
    } catch (err) {
      this.logger.warn(
        `Could not record the Aquiline profile count (${profilesUsed}): ${describeAquilineError(err)}`,
      );
    }
  }

  /** Resolve the effective Aquiline provider config (DB override → env →
   *  default), the same panel-tunable resolution every other consumer of
   *  `PlatformSettingsService` uses. This never throws and never makes a
   *  network call — it only fails to produce a *usable* config, which the
   *  provider calls below discover on their own (`AquilineErrorKind.NOT_CONFIGURED`). */
  private async resolveConfig(): Promise<AquilineConfig> {
    const [baseUrl, token, profilePrefix, maxProfiles, timeoutMs] = await Promise.all([
      this.platformSettings.getString(PlatformSettingKey.AQUILINE_BASE_URL),
      this.platformSettings.getString(PlatformSettingKey.AQUILINE_API_KEY),
      this.platformSettings.getString(PlatformSettingKey.AQUILINE_PROFILE_PREFIX),
      this.platformSettings.getNumber(PlatformSettingKey.AQUILINE_MAX_PROFILES),
      this.platformSettings.getNumber(PlatformSettingKey.AQUILINE_TIMEOUT_MS),
    ]);
    return {
      baseUrl: baseUrl || 'https://aquiline-tracking.com/app/api/integration',
      token: token || null,
      profilePrefix: profilePrefix || 'sh',
      maxProfiles: Number.isFinite(maxProfiles) && maxProfiles > 0 ? maxProfiles : 10,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000,
    };
  }

  /** Never throws — a read failure is reported the same way as "no row
   *  found": the caller falls through to the create-or-recover path, which
   *  is safe even on a false negative because the id is deterministic and
   *  `recoverFromCreateConflict` adopts the real row via GET if it turns out
   *  one already existed. */
  private async readRow(
    userId: string,
    marketplace: AmazonMarketplace,
  ): Promise<AquilineProfileRow | null> {
    try {
      const rows = await this.db.query<AquilineProfileRow>(
        `SELECT profile_id, fingerprint FROM aquiline_profiles WHERE user_id = $1 AND marketplace = $2`,
        [userId, marketplace],
      );
      return rows[0] ?? null;
    } catch (err) {
      this.logger.error(
        `Aquiline profile lookup failed for user ${userId}: ${describeAquilineError(err)}`,
      );
      return null;
    }
  }

  /** Same never-throws contract as `readRow`, for use inside the advisory-lock
   *  transaction. */
  private async readRowWithClient(
    client: PoolClient,
    userId: string,
    marketplace: AmazonMarketplace,
  ): Promise<AquilineProfileRow | null> {
    try {
      const { rows } = await client.query<AquilineProfileRow>(
        `SELECT profile_id, fingerprint FROM aquiline_profiles WHERE user_id = $1 AND marketplace = $2`,
        [userId, marketplace],
      );
      return rows[0] ?? null;
    } catch (err) {
      this.logger.error(
        `Aquiline profile lookup (locked) failed for user ${userId}: ${describeAquilineError(err)}`,
      );
      return null;
    }
  }

  /** Ship-from address the profile is created/PATCHed with, read from the
   *  user's GLOBAL `store_settings` row — a profile is a user-level resource
   *  while `store_settings` also has per-store rows, so the global one is the
   *  only coherent source. Required: `address_line1`, `city`, `country`.
   *  Never throws — a DB failure here is indistinguishable from "no complete
   *  address configured" and returns `null` the same way. */
  private async resolveShipFromAddress(userId: string): Promise<AquilineStoreAddress | null> {
    let rows: GlobalStoreSettingsAddressRow[];
    try {
      rows = await this.db.query<GlobalStoreSettingsAddressRow>(
        `SELECT ship_from_name, ship_from_phone, ship_from_address_line1,
                ship_from_address_line2, ship_from_city, country, state, zip_code
         FROM store_settings
         WHERE user_id = $1 AND is_global = TRUE
         LIMIT 1`,
        [userId],
      );
    } catch (err) {
      this.logger.error(
        `Aquiline ship-from address lookup failed for user ${userId}: ${describeAquilineError(err)}`,
      );
      return null;
    }
    const row = rows[0];
    if (!row) {
      return null;
    }

    const addressLine1 = row.ship_from_address_line1?.trim();
    const city = row.ship_from_city?.trim();
    const country = row.country?.trim();
    if (!addressLine1 || !city || !country) {
      return null;
    }

    const { firstName, lastName } = splitShipFromName(row.ship_from_name);

    return {
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
      address_line1: addressLine1,
      ...(row.ship_from_address_line2?.trim()
        ? { address_line2: row.ship_from_address_line2.trim() }
        : {}),
      city,
      ...(row.state?.trim() ? { state: row.state.trim() } : {}),
      ...(row.zip_code?.trim() ? { zip_code: row.zip_code.trim() } : {}),
      country,
      ...(row.ship_from_phone?.trim() ? { phone_number: row.ship_from_phone.trim() } : {}),
    };
  }

  /** Issue the PATCH; the two callers differ only in how they persist the
   *  refreshed fingerprint afterward (plain query vs. inside the advisory-lock
   *  transaction), so only that HTTP call is shared. Returns whether it
   *  succeeded — a failure is logged here so both call sites stay one-line. */
  private async callPatchProfile(
    profileId: string,
    userId: string,
    label: string,
    address: AquilineStoreAddress,
    config: AquilineConfig,
  ): Promise<boolean> {
    try {
      await this.client.patchProfile(
        profileId,
        { label, marketplaceHost: AMAZON_MARKETPLACE_HOST, storeAddress: address },
        config,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Aquiline patchProfile failed for user ${userId}, profile ${profileId}: ${describeAquilineError(err)}`,
      );
      return false;
    }
  }

  /**
   * `createProfile` failed. Profile ids are deterministic
   * (`{prefix}-{userId}-{marketplace}`) and we only reach this branch after
   * confirming — inside the advisory lock — that no local row exists yet. So
   * the ONLY way a brand-new id can be rejected as a duplicate is a previous
   * attempt that created it on the provider but crashed before our DB write:
   * exactly the crash-recovery case the deterministic id exists for.
   *
   * The provider's exact "already exists" response shape has never been
   * observed live (Q11 in `docs/aquiline-open-questions.md` is unanswered —
   * there is no sandbox, so nobody has been willing to spend a real profile
   * slot finding out). Rather than guess at a `code`/message string, this
   * asks the provider directly with GET: if it answers, the profile exists
   * and is ours to adopt; if that also fails, this was a genuine failure and
   * the caller falls back to pass-through.
   *
   * Deliberately skipped for kinds that can never mean "already exists":
   * asking again does not clarify an unauthorized/not-configured/transport
   * failure, and retrying on QUOTA_EXCEEDED risks a second charge for
   * something that was never created.
   */
  private async recoverFromCreateConflict(
    profileId: string,
    err: unknown,
    config: AquilineConfig,
  ): Promise<string | null> {
    if (
      !(err instanceof AquilineError) ||
      err.kind === AquilineErrorKind.NOT_CONFIGURED ||
      err.kind === AquilineErrorKind.UNAUTHORIZED ||
      err.kind === AquilineErrorKind.TRANSPORT ||
      err.kind === AquilineErrorKind.QUOTA_EXCEEDED ||
      err.kind === AquilineErrorKind.PAYLOAD_TOO_LARGE
    ) {
      return null;
    }
    try {
      const profile = await this.client.getProfile(profileId, config);
      return profile.profileId || profileId;
    } catch {
      return null;
    }
  }
}

/** First/last split of the single `ship_from_name` column, since
 *  `AquilineStoreAddress` (the provider's wire shape) carries them separately.
 *  The last whitespace-delimited token is the last name; everything before it
 *  is the first name. A single-token name has no last name. */
function splitShipFromName(name: string | null): { firstName?: string; lastName?: string } {
  const trimmed = name?.trim();
  if (!trimmed) {
    return {};
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function describeAquilineError(err: unknown): string {
  if (err instanceof AquilineError) {
    return `${err.kind}${err.code ? ` (${err.code})` : ''}: ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}
