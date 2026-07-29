// apps/api/src/modules/admin/admin-proxies.service.ts
//
// Operator-facing proxy pool management. This is the deliberate WRITE exception
// to the otherwise read-only admin module: the `proxies` table has no owning
// customer module (it is platform infrastructure operated by the admin), so
// registering purchased proxies and flipping burned ones to disabled lives
// here, behind the same ADMIN + privileged-session guard chain.
//
// Assignment is intentionally NOT writable: ProxyService owns the atomic
// claim (FOR UPDATE SKIP LOCKED, UNIQUE assigned_user_id). Manually reassigning
// from the panel would race it and break the one-user-one-IP invariant.
//
// Passwords are encrypted immediately at insert (AES-256-GCM, `enc:` prefix,
// same key as Amazon credentials) — the boot-time backfill in ProxyService
// remains only for legacy operator SQL INSERTs — and are never returned.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PlatformSettingKey,
  ProxyStatus,
  type AdminProxyDto,
  type AdminProxyListDto,
  type CreateProxyRequest,
  type UpdateProxyRequest,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';

import { buildProxyPoolSummary, classifyProxyExpiry } from './proxy-pool.helpers';

/** Prefix marking an encrypted-at-rest proxy password (shared with ProxyService). */
const PASS_ENC_PREFIX = 'enc:';

const PROXY_SELECT = `
  SELECT p.id, p.host, p.port, p.username, p.status, p.label,
         p.assigned_user_id, u.email AS assigned_user_email, p.assigned_at,
         p.expires_at, p.monthly_cost_micros::TEXT AS monthly_cost_micros,
         p.currency, p.created_at
    FROM proxies p
    LEFT JOIN users u ON u.id = p.assigned_user_id`;

interface ProxyRowDb {
  id: string;
  host: string;
  port: number;
  username: string;
  status: ProxyStatus;
  label: string | null;
  assigned_user_id: string | null;
  assigned_user_email: string | null;
  assigned_at: Date | null;
  expires_at: Date | null;
  monthly_cost_micros: string | null;
  currency: string | null;
  created_at: Date;
}

@Injectable()
export class AdminProxiesService {
  private readonly encryption: EncryptionUtil;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
  ) {
    const key = process.env.AMAZON_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('AMAZON_ENCRYPTION_KEY environment variable is required');
    }
    this.encryption = new EncryptionUtil(key);
  }

  /** Full pool listing + aggregate summary in one payload. */
  async list(): Promise<AdminProxyListDto> {
    const warnDays = await this.expiryWarnDays();
    const rows = await this.databaseService.query<ProxyRowDb>(
      `${PROXY_SELECT} ORDER BY p.created_at ASC`,
    );
    const now = new Date();
    const proxies = rows.map((row) => this.mapRow(row, now, warnDays));
    return {
      generatedAt: now.toISOString(),
      summary: buildProxyPoolSummary(proxies, warnDays),
      proxies,
    };
  }

  /** Register a purchased proxy. Password is encrypted before it touches the DB. */
  async create(request: CreateProxyRequest): Promise<AdminProxyDto> {
    const cost = this.resolveCostPair(request.monthlyCostMicros ?? null, request.currency ?? null);
    const rows = await this.databaseService.query<{ id: string }>(
      `INSERT INTO proxies (host, port, username, password, label, expires_at, monthly_cost_micros, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        request.host.trim(),
        request.port,
        request.username.trim(),
        PASS_ENC_PREFIX + this.encryption.encrypt(request.password),
        request.label?.trim() || null,
        request.expiresAt ?? null,
        cost.monthlyCostMicros,
        cost.currency,
      ],
    );
    return this.getOne(rows[0].id);
  }

  /**
   * Patch operational fields (status/label/expiry/cost). Assignment and
   * credentials are deliberately not patchable — replace a bad proxy by
   * disabling it and adding a new row.
   */
  async update(id: string, request: UpdateProxyRequest): Promise<AdminProxyDto> {
    const current = await this.getOne(id);
    const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: Array<string | number | null> = [];
    let idx = 1;
    if (request.status !== undefined && request.status !== null) {
      sets.push(`status = $${idx++}`);
      params.push(request.status);
    }
    if (request.label !== undefined) {
      sets.push(`label = $${idx++}`);
      params.push(request.label?.trim() || null);
    }
    if (request.expiresAt !== undefined) {
      sets.push(`expires_at = $${idx++}`);
      params.push(request.expiresAt);
    }
    if (request.monthlyCostMicros !== undefined || request.currency !== undefined) {
      const cost = this.resolveCostPair(
        request.monthlyCostMicros === undefined ? current.monthlyCostMicros : request.monthlyCostMicros,
        request.currency === undefined ? current.currency : request.currency,
      );
      sets.push(`monthly_cost_micros = $${idx++}`, `currency = $${idx++}`);
      params.push(cost.monthlyCostMicros, cost.currency);
    }
    params.push(id);
    await this.databaseService.query(
      `UPDATE proxies SET ${sets.join(', ')} WHERE id = $${idx}`,
      params,
    );
    return this.getOne(id);
  }

  private async getOne(id: string): Promise<AdminProxyDto> {
    const rows = await this.databaseService.query<ProxyRowDb>(
      `${PROXY_SELECT} WHERE p.id = $1`,
      [id],
    );
    if (!rows[0]) {
      throw new NotFoundException('admin.errors.proxyNotFound');
    }
    return this.mapRow(rows[0], new Date(), await this.expiryWarnDays());
  }

  /**
   * Enforce cost/currency pair-coupling: unknown cost carries no currency; a
   * known cost defaults to USD when the operator omitted the currency.
   */
  private resolveCostPair(
    monthlyCostMicros: number | null,
    currency: string | null,
  ): { monthlyCostMicros: number | null; currency: string | null } {
    if (monthlyCostMicros === null) {
      if (currency !== null) {
        throw new BadRequestException('admin.errors.currencyRequiresCost');
      }
      return { monthlyCostMicros: null, currency: null };
    }
    return { monthlyCostMicros, currency: (currency ?? 'USD').toUpperCase() };
  }

  private async expiryWarnDays(): Promise<number> {
    return this.platformSettings.getNumber(PlatformSettingKey.ADMIN_PROXY_EXPIRY_WARN_DAYS);
  }

  private mapRow(row: ProxyRowDb, now: Date, warnDays: number): AdminProxyDto {
    const expiresAt = row.expires_at;
    const expiry = classifyProxyExpiry(expiresAt, now, warnDays);
    return {
      id: row.id,
      host: row.host,
      port: row.port,
      username: row.username,
      status: row.status,
      label: row.label,
      assignedUserId: row.assigned_user_id,
      assignedUserEmail: row.assigned_user_email,
      assignedAt: row.assigned_at ? row.assigned_at.toISOString() : null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      expiryState: expiry.state,
      daysUntilExpiry: expiry.daysUntilExpiry,
      monthlyCostMicros:
        row.monthly_cost_micros === null ? null : Number.parseInt(row.monthly_cost_micros, 10),
      currency: row.currency,
      createdAt: row.created_at.toISOString(),
    };
  }
}
