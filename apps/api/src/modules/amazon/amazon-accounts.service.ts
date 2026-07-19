import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AmazonAccountStatus, type AmazonAccountPublicDto } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';

import { ProxyService } from './proxy.service';

export interface AmazonAccountRow {
  id: string;
  user_id: string;
  label: string;
  email: string;
  encrypted_password: string;
  two_factor_secret: string;
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

@Injectable()
export class AmazonAccountsService {
  private readonly logger = new Logger(AmazonAccountsService.name);
  private readonly encryption: EncryptionUtil;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly proxyService: ProxyService
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
      decryptedTwoFactorSecret: row.two_factor_secret
        ? this.encryption.decrypt(row.two_factor_secret)
        : null,
    };
  }

  async create(
    userId: string,
    data: {
      label?: string;
      email: string;
      password: string;
      twoFactorSecret?: string;
    } & AmazonAccountAutoFulfillData
  ) {
    // Guardrail: enabling auto-fulfill requires a configured proxy AND a non-null
    // per-account spend cap. Money/ban safety — fail closed at the API boundary
    // so the auto-fulfill processor never picks an account that would route over
    // the user's residential IP or spend without a ceiling. The FE maps this
    // BadRequestException to `showMessage` via the standard error interceptor;
    // i18n keys land in Task 10/11.
    if (data.autoFulfillEnabled) {
      this.assertCanEnable(data.autoFulfillCapTotal ?? null);
    }

    const encryptedPassword = this.encryption.encrypt(data.password);
    const encryptedTwoFactor = data.twoFactorSecret
      ? this.encryption.encrypt(data.twoFactorSecret)
      : null;

    // Defaults match migration 037 (FALSE / NULL / FALSE) when fields are omitted.
    const autoFulfillEnabled = data.autoFulfillEnabled ?? false;
    const autoFulfillCapTotal = data.autoFulfillCapTotal ?? null;
    const autoFulfillDryRun = data.autoFulfillDryRun ?? false;

    const rows = await this.databaseService.query<AmazonAccountRow>(
      `INSERT INTO amazon_accounts
         (user_id, label, email, encrypted_password, two_factor_secret, status,
          auto_fulfill_enabled, auto_fulfill_cap_total, auto_fulfill_dry_run)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        data.label || null,
        data.email,
        encryptedPassword,
        encryptedTwoFactor,
        AmazonAccountStatus.VERIFYING,
        autoFulfillEnabled,
        autoFulfillCapTotal,
        autoFulfillDryRun,
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
    } & AmazonAccountAutoFulfillData
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

    if (data.twoFactorSecret !== undefined) {
      updates.push(`two_factor_secret = $${paramIndex}`);
      params.push(data.twoFactorSecret ? this.encryption.encrypt(data.twoFactorSecret) : null);
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
   * Guardrail for enabling auto-fulfill on an Amazon account.
   * Throws `BadRequestException` (FE maps to `showMessage`) when:
   *   - no proxy is configured (would route Amazon checkout over the user's
   *     residential IP = ban risk); OR
   *   - the per-account spend cap is null (no ceiling = unbounded spend).
   * Money/ban safety — fail closed.
   */
  private assertCanEnable(capTotal: number | null): void {
    if (!this.proxyService.isConfigured()) {
      // FE maps via getErrorI18nKey → amazon:amazon.errors.autoFulfillProxyRequired
      throw new BadRequestException('amazon.errors.autoFulfillProxyRequired');
    }
    if (capTotal === null || capTotal === undefined) {
      // FE maps via getErrorI18nKey → amazon:amazon.errors.autoFulfillCapRequired
      throw new BadRequestException('amazon.errors.autoFulfillCapRequired');
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
    await this.databaseService.query(
      `UPDATE amazon_accounts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3`,
      [status, id, userId]
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
    };
  }
}
