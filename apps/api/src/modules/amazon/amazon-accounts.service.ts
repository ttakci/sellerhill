import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmazonAccountStatus,
  AmazonMarketplace,
  ProxyConnectionType,
  SUPPORTED_AMAZON_MARKETPLACES,
  type AmazonAccountPublicDto,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';

import { isValidTotpSecret, normalizeTotpSecret } from './totp-secret';

export interface AmazonAccountRow {
  id: string;
  user_id: string;
  label: string;
  email: string;
  encrypted_password: string;
  two_factor_secret: string;
  // Storefront this buyer account operates on (migration 081). Immutable
  // after creation.
  marketplace: string;
  status: string;
  last_verification_error: string | null;
  last_verified_at: Date;
  last_used_at: Date;
  created_at: Date;
  updated_at: Date;
  // A2 auto-fulfillment (migration 037). NUMERIC(10,2) arrives from pg as a string.
  auto_fulfill_enabled: boolean;
  auto_fulfill_cap_total: string | number | null;
  auto_fulfill_dry_run: boolean;
  // Self-service proxy (migration 080). User-supplied; replaces the platform pool.
  proxy_enabled: boolean;
  proxy_connection_type: string | null;
  proxy_host: string | null;
  proxy_port: number | null;
  proxy_username: string | null;
  proxy_password: string | null;
}

export interface DecryptedAmazonAccount extends AmazonAccountRow {
  decryptedPassword: string;
  decryptedTwoFactorSecret: string | null;
}

/** Per-account auto-fulfillment write payload. `undefined` = leave unchanged. */
export interface AmazonAccountAutoFulfillData {
  autoFulfillEnabled?: boolean;
  autoFulfillCapTotal?: number | null;
  autoFulfillDryRun?: boolean;
}

/** Self-service proxy write payload (migration 080). `undefined` = leave unchanged. */
export interface AmazonAccountProxyData {
  proxyEnabled?: boolean;
  proxyConnectionType?: ProxyConnectionType | null;
  proxyHost?: string | null;
  proxyPort?: number | null;
  proxyUsername?: string | null;
  /** Write-only. `undefined` = keep stored value; `null`/`''` clears it. */
  proxyPassword?: string | null;
}

@Injectable()
export class AmazonAccountsService {
  private readonly logger = new Logger(AmazonAccountsService.name);
  private readonly encryption: EncryptionUtil;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService
  ) {
    const key = this.configService.get<string>('AMAZON_ENCRYPTION_KEY');
    if (!key) {
      throw new Error('AMAZON_ENCRYPTION_KEY environment variable is required');
    }
    this.encryption = new EncryptionUtil(key);
  }

  async findAll(userId: string) {
    const rows = await this.databaseService.query<AmazonAccountRow>(
      `SELECT * FROM amazon_accounts WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    return rows.map((row) => this.toPublicDto(row));
  }

  async findOne(userId: string, id: string): Promise<AmazonAccountRow> {
    const rows = await this.databaseService.query<AmazonAccountRow>(
      `SELECT * FROM amazon_accounts WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Amazon account ${id} not found`);
    }

    return rows[0];
  }

  async getDecrypted(userId: string, id: string): Promise<DecryptedAmazonAccount> {
    const row = await this.findOne(userId, id);
    return {
      ...row,
      decryptedPassword: this.encryption.decrypt(row.encrypted_password),
      // Secondary normalization on read: any secret stored BEFORE write-time
      // normalization shipped (or via raw SQL) is recovered here so the user
      // doesn't have to re-enter it. Normalize after decrypting.
      decryptedTwoFactorSecret: row.two_factor_secret
        ? normalizeTotpSecret(this.encryption.decrypt(row.two_factor_secret))
        : null,
    };
  }

  async create(
    userId: string,
    data: {
      label?: string;
      email: string;
      password: string;
      // Required — enforced by CreateAmazonAccountDto and re-checked by
      // `assertTwoFactorSecret` below (format + presence).
      twoFactorSecret: string;
      marketplace?: AmazonMarketplace;
    } & AmazonAccountAutoFulfillData &
      AmazonAccountProxyData
  ) {
    // Guardrail: enabling auto-fulfill requires a non-null per-account spend
    // cap. Money safety — fail closed at the API boundary so the auto-fulfill
    // processor never picks an account with unbounded spend. A proxy is no
    // longer required to enable: it is now the user's own, optional choice
    // (migration 080) — see `validateProxyFields` below.
    if (data.autoFulfillEnabled) {
      this.assertCanEnable(data.autoFulfillCapTotal ?? null);
    }
    this.assertTwoFactorSecret(data.twoFactorSecret, true);
    this.validateProxyFields(data);

    // Storefront this buyer account operates on (migration 081). Immutable
    // after creation — UpdateAmazonAccountDto has no matching field. Only
    // AmazonMarketplace.AMAZON_US is supported today (see amazon.constants.ts);
    // resolved (not `data.marketplace` directly) so an omitted field always
    // gets the real default rather than `undefined` in the INSERT.
    const marketplace = data.marketplace ?? AmazonMarketplace.AMAZON_US;
    if (!SUPPORTED_AMAZON_MARKETPLACES.includes(marketplace)) {
      // FE maps via getErrorI18nKey → amazon:amazon.errors.unsupportedMarketplace
      throw new BadRequestException('amazon.errors.unsupportedMarketplace');
    }

    const encryptedPassword = this.encryption.encrypt(data.password);
    // Normalize the 2FA secret before encrypting: Amazon shows the secret in
    // space-separated blocks ("abcd efgh …") and users paste it verbatim.
    // otplib's base32 decoder throws on the space, so strip whitespace/separators
    // and uppercase once at write time — the stored value is canonical.
    const encryptedTwoFactor = data.twoFactorSecret
      ? this.encryption.encrypt(normalizeTotpSecret(data.twoFactorSecret) ?? '')
      : null;

    // Defaults match migration 037 (FALSE / NULL / FALSE) when fields are omitted.
    const autoFulfillEnabled = data.autoFulfillEnabled ?? false;
    const autoFulfillCapTotal = data.autoFulfillCapTotal ?? null;
    const autoFulfillDryRun = data.autoFulfillDryRun ?? false;

    // Proxy defaults match migration 080 (FALSE / NULL everywhere).
    const proxyEnabled = data.proxyEnabled ?? false;
    const proxyConnectionType = data.proxyConnectionType ?? null;
    const proxyHost = data.proxyHost ?? null;
    const proxyPort = data.proxyPort ?? null;
    const proxyUsername = data.proxyUsername ?? null;
    const encryptedProxyPassword = data.proxyPassword ? this.encryption.encrypt(data.proxyPassword) : null;

    const rows = await this.databaseService.query<AmazonAccountRow>(
      `INSERT INTO amazon_accounts
         (user_id, label, email, encrypted_password, two_factor_secret, marketplace, status,
          auto_fulfill_enabled, auto_fulfill_cap_total, auto_fulfill_dry_run,
          proxy_enabled, proxy_connection_type, proxy_host, proxy_port, proxy_username, proxy_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        userId,
        data.label || null,
        data.email,
        encryptedPassword,
        encryptedTwoFactor,
        marketplace,
        AmazonAccountStatus.VERIFYING,
        autoFulfillEnabled,
        autoFulfillCapTotal,
        autoFulfillDryRun,
        proxyEnabled,
        proxyConnectionType,
        proxyHost,
        proxyPort,
        proxyUsername,
        encryptedProxyPassword,
      ]
    );

    return this.toPublicDto(rows[0]);
  }

  async update(
    userId: string,
    id: string,
    data: {
      label?: string;
      email?: string;
      password?: string;
      twoFactorSecret?: string;
    } & AmazonAccountAutoFulfillData &
      AmazonAccountProxyData
  ): Promise<{ account: AmazonAccountPublicDto; credentialsChanged: boolean }> {
    const existing = await this.findOne(userId, id);

    // Resolve the *effective* cap after this update — the guardrail must consider
    // the new value being set, not just the existing row.
    const rawCap =
      data.autoFulfillCapTotal !== undefined ? data.autoFulfillCapTotal : existing.auto_fulfill_cap_total;
    // NUMERIC(10,2) arrives from pg as a string — normalize for the guardrail.
    const effectiveCap = rawCap === null || rawCap === undefined ? null : Number(rawCap);
    // Effective enabled flag: dto wins if provided, otherwise the existing row.
    const enablingNow = data.autoFulfillEnabled === true
      || (data.autoFulfillEnabled === undefined && !!existing.auto_fulfill_enabled);

    if (enablingNow) {
      this.assertCanEnable(effectiveCap);
    }
    // Every account must carry a TOTP secret. If the row has none yet (legacy,
    // or INVALID for exactly this reason) the edit must supply one; if it
    // already has one, a blank field keeps it and only a provided value is
    // format-checked.
    if (!existing.two_factor_secret) {
      this.assertTwoFactorSecret(data.twoFactorSecret, true);
    } else if (data.twoFactorSecret !== undefined) {
      this.assertTwoFactorSecret(data.twoFactorSecret, false);
    }
    this.validateProxyFields(data);

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    let credentialsChanged = false;

    if (data.label !== undefined) {
      updates.push(`label = $${paramIndex}`);
      params.push(data.label);
      paramIndex++;
    }

    if (data.email !== undefined && data.email !== existing.email) {
      updates.push(`email = $${paramIndex}`);
      params.push(data.email);
      paramIndex++;
      credentialsChanged = true;
    }

    if (data.password !== undefined) {
      updates.push(`encrypted_password = $${paramIndex}`);
      params.push(this.encryption.encrypt(data.password));
      paramIndex++;
      credentialsChanged = true;
    }

    // The TOTP secret is mandatory and has no "remove" flow, so a blank value
    // here is treated as "no change" — it must NEVER null the stored secret
    // (an empty string used to reach the `: null` branch and wipe it). Only a
    // real, normalizable value replaces it, and that is what triggers re-verify.
    const nextTwoFactorSecret = normalizeTotpSecret(data.twoFactorSecret);
    if (nextTwoFactorSecret) {
      updates.push(`two_factor_secret = $${paramIndex}`);
      params.push(this.encryption.encrypt(nextTwoFactorSecret));
      paramIndex++;
      credentialsChanged = true;
    }

    if (data.autoFulfillEnabled !== undefined) {
      updates.push(`auto_fulfill_enabled = $${paramIndex}`);
      params.push(data.autoFulfillEnabled);
      paramIndex++;
    }

    if (data.autoFulfillCapTotal !== undefined) {
      updates.push(`auto_fulfill_cap_total = $${paramIndex}`);
      params.push(data.autoFulfillCapTotal);
      paramIndex++;
    }

    if (data.autoFulfillDryRun !== undefined) {
      updates.push(`auto_fulfill_dry_run = $${paramIndex}`);
      params.push(data.autoFulfillDryRun);
      paramIndex++;
    }

    if (data.proxyEnabled !== undefined) {
      updates.push(`proxy_enabled = $${paramIndex}`);
      params.push(data.proxyEnabled);
      paramIndex++;
    }
    if (data.proxyConnectionType !== undefined) {
      updates.push(`proxy_connection_type = $${paramIndex}`);
      params.push(data.proxyConnectionType);
      paramIndex++;
    }
    if (data.proxyHost !== undefined) {
      updates.push(`proxy_host = $${paramIndex}`);
      params.push(data.proxyHost);
      paramIndex++;
    }
    if (data.proxyPort !== undefined) {
      updates.push(`proxy_port = $${paramIndex}`);
      params.push(data.proxyPort);
      paramIndex++;
    }
    if (data.proxyUsername !== undefined) {
      updates.push(`proxy_username = $${paramIndex}`);
      params.push(data.proxyUsername);
      paramIndex++;
    }
    // Write-only: `undefined` keeps the stored password, `null`/`''` clears it,
    // any other string re-encrypts. Never round-tripped back to the client.
    if (data.proxyPassword !== undefined) {
      updates.push(`proxy_password = $${paramIndex}`);
      params.push(data.proxyPassword ? this.encryption.encrypt(data.proxyPassword) : null);
      paramIndex++;
    }

    if (credentialsChanged) {
      // Re-verify against Amazon; clear any stale failure reason while in-flight.
      updates.push(`status = $${paramIndex}`);
      params.push(AmazonAccountStatus.VERIFYING);
      paramIndex++;
      updates.push(`last_verification_error = NULL`);
    }

    params.push(id, userId);
    const rows = await this.databaseService.query<AmazonAccountRow>(
      `UPDATE amazon_accounts SET ${updates.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Amazon account ${id} not found`);
    }

    return { account: this.toPublicDto(rows[0]), credentialsChanged };
  }

  /**
   * Guardrail for enabling auto-fulfill on an Amazon account: the per-account
   * spend cap must be non-null (no ceiling = unbounded spend). Money safety —
   * fail closed. A proxy is deliberately NOT required here — see the class
   * doc on `AmazonAccountProxyData`: proxying is now the user's own optional
   * choice (migration 080), and `AmazonCheckoutService` runs bare-IP when the
   * account has none configured.
   */
  private assertCanEnable(capTotal: number | null): void {
    if (capTotal === null) {
      // FE maps via getErrorI18nKey → amazon:amazon.errors.autoFulfillCapRequired
      throw new BadRequestException('amazon.errors.autoFulfillCapRequired');
    }
  }

  /**
   * A TOTP secret is mandatory for every buyer account: Amazon challenges
   * almost every automated sign-in with an OTP, and a TOTP from this secret is
   * the only challenge the workers can answer without a human (see
   * `performLogin`). Without it the account connects and then never verifies.
   *
   * `required` is `true` on create and on an edit of an account that has no
   * stored secret yet (a legacy row, or one already INVALID for this reason).
   * When the account already has a secret, an edit that leaves the field blank
   * keeps it — so `required` is `false` there and only a *provided* value is
   * format-checked.
   */
  private assertTwoFactorSecret(raw: string | undefined, required: boolean): void {
    const normalized = normalizeTotpSecret(raw);
    if (!normalized) {
      if (required) {
        // FE maps via getErrorI18nKey → amazon:amazon.errors.twoFactorSecretRequired
        throw new BadRequestException('amazon.errors.twoFactorSecretRequired');
      }
      return;
    }
    if (!isValidTotpSecret(normalized)) {
      // FE maps via getErrorI18nKey → amazon:amazon.errors.twoFactorSecretInvalid
      throw new BadRequestException('amazon.errors.twoFactorSecretInvalid');
    }
  }

  /**
   * A user who turns proxying ON is asking us to route through it — an
   * incomplete config (enabled but missing host/port) would silently launch
   * bare-IP instead, defeating the point of opting in. Validated here rather
   * than only at the DB layer so the drawer gets one consistent error key.
   */
  private validateProxyFields(data: AmazonAccountProxyData): void {
    if (data.proxyEnabled !== true) {return;}
    if (!data.proxyHost?.trim() || !data.proxyPort) {
      throw new BadRequestException('amazon.errors.proxyHostPortRequired');
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    const result = await this.databaseService.query(
      `DELETE FROM amazon_accounts WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.length === 0) {
      throw new NotFoundException(`Amazon account ${id} not found`);
    }
  }

  async updateStatus(userId: string, id: string, status: AmazonAccountStatus): Promise<void> {
    // Entering VERIFYING clears the previous failure reason so a stale error is
    // never shown next to an in-flight re-verification. The branch is resolved
    // in JS, not SQL: reusing $1 as both the assigned value and a comparison
    // operand made Postgres fail with "inconsistent types deduced for parameter
    // $1" (it infers the placeholder's type once, from all usages).
    const clearError = status === AmazonAccountStatus.VERIFYING;
    await this.databaseService.query(
      `UPDATE amazon_accounts
          SET status = $1,
              last_verification_error = CASE WHEN $4 THEN NULL ELSE last_verification_error END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND user_id = $3`,
      [status, id, userId, clearError]
    );
  }

  async markVerified(userId: string, id: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE amazon_accounts
         SET status = $1, last_verified_at = CURRENT_TIMESTAMP, last_verification_error = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3`,
      [AmazonAccountStatus.ACTIVE, id, userId]
    );
  }

  async markInvalid(userId: string, id: string, reason: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE amazon_accounts
         SET status = $1, last_verification_error = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4`,
      [AmazonAccountStatus.INVALID, reason, id, userId]
    );
  }

  async markUsed(id: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE amazon_accounts SET last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
  }

  private toPublicDto(row: AmazonAccountRow): AmazonAccountPublicDto {
    // GET /amazon/accounts is user-scoped (findAll(req.user.sub)) — the caller
    // only ever receives their own accounts, so the email is returned unmasked.
    // This lets the owner identify and manage each connected account.
    // NUMERIC(10,2) arrives from pg as a string — coerce for the JSON payload.
    const capNum = row.auto_fulfill_cap_total === null ? null : Number(row.auto_fulfill_cap_total);
    return {
      id: row.id,
      userId: row.user_id,
      label: row.label || undefined,
      email: row.email,
      marketplace: row.marketplace as AmazonMarketplace,
      status: row.status as AmazonAccountStatus,
      hasTwoFactor: !!row.two_factor_secret,
      lastVerificationError: row.last_verification_error ?? undefined,
      lastVerifiedAt: row.last_verified_at?.toISOString() || undefined,
      lastUsedAt: row.last_used_at?.toISOString() || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      autoFulfillEnabled: !!row.auto_fulfill_enabled,
      autoFulfillCapTotal: capNum !== null && Number.isFinite(capNum) ? capNum : null,
      autoFulfillDryRun: !!row.auto_fulfill_dry_run,
      proxyEnabled: !!row.proxy_enabled,
      proxyConnectionType: (row.proxy_connection_type as ProxyConnectionType | null) ?? null,
      proxyHost: row.proxy_host ?? null,
      proxyPort: row.proxy_port ?? null,
      proxyUsername: row.proxy_username ?? null,
      hasProxyPassword: !!row.proxy_password,
    };
  }
}
