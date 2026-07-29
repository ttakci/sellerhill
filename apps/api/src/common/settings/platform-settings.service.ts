// apps/api/src/modules/admin/platform-settings.service.ts
//
// Runtime settings resolver: DB override -> env var -> code default.
//
// Every consumer that used `configService.get('SOME_KNOB')` can call
// `getNumber(PlatformSettingKey.X)` instead and become operator-tunable at
// runtime. A deployment with an empty `platform_settings` table resolves
// identically to the old env-only behavior, so adopting this is never a
// behavior change on its own.
//
// Caching: the whole override set is loaded in one query and cached for
// CACHE_TTL_MS. Writes invalidate the local cache immediately; other API
// replicas converge within the TTL. That bound is deliberate — settings are
// operator actions measured in minutes, and a per-call DB read on hot paths
// (every queue job, every admin request) would not pay for itself.
//
// Secrets: registry entries flagged `isSecret` are stored 'enc:'-prefixed
// (AES-256-GCM, same key as Amazon credentials) and are NEVER returned by
// `list()` — only `hasValue` reports whether one is configured.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformSettingKey,
  PlatformSettingSource,
  type PlatformSettingDto,
  type PlatformSettingsListDto,
} from '@repo/shared';

import { DatabaseService } from '../database/database.service';
import { EncryptionUtil } from '../utils/encryption.util';

import {
  coerceBoolean,
  coerceNumber,
  validateSettingValue,
} from './platform-settings.helpers';
import {
  PLATFORM_SETTINGS_BY_KEY,
  PLATFORM_SETTING_DEFINITIONS,
  type PlatformSettingDefinition,
} from './platform-settings.registry';

/** Prefix marking an encrypted-at-rest secret setting value. */
const SECRET_ENC_PREFIX = 'enc:';

/** How long a loaded override set is trusted before re-reading the table. */
const CACHE_TTL_MS = 30_000;

interface OverrideRow {
  key: string;
  value: string;
  updated_at: Date;
}

interface Override {
  value: string;
  updatedAt: Date;
}

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);
  private readonly encryption: EncryptionUtil;
  private cache: Map<string, Override> | null = null;
  private cacheLoadedAt = 0;
  /** In-flight load, so a burst of concurrent reads issues one query. */
  private inflight: Promise<Map<string, Override>> | null = null;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    const key = process.env.AMAZON_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('AMAZON_ENCRYPTION_KEY environment variable is required');
    }
    this.encryption = new EncryptionUtil(key);
  }

  /** Resolved boolean for a BOOLEAN setting. */
  async getBoolean(key: PlatformSettingKey): Promise<boolean> {
    const definition = this.definitionOrThrow(key);
    const fallback = coerceBoolean(definition.defaultValue, false);
    return coerceBoolean(await this.resolveRaw(definition), fallback);
  }

  /** Resolved number for a NUMBER setting, clamped to the registry bounds. */
  async getNumber(key: PlatformSettingKey): Promise<number> {
    const definition = this.definitionOrThrow(key);
    const fallback = coerceNumber(definition.defaultValue, 0, definition.min, definition.max);
    return coerceNumber(
      await this.resolveRaw(definition),
      fallback,
      definition.min,
      definition.max,
    );
  }

  /** Resolved string; null when neither an override, an env var nor a default exists. */
  async getString(key: PlatformSettingKey): Promise<string | null> {
    return this.resolveRaw(this.definitionOrThrow(key));
  }

  /**
   * Every registry entry with its effective value and provenance, for the
   * admin UI. Secret values are redacted to null.
   */
  async list(): Promise<PlatformSettingsListDto> {
    const overrides = await this.loadOverrides();
    const settings: PlatformSettingDto[] = PLATFORM_SETTING_DEFINITIONS.map((definition) => {
      const override = overrides.get(definition.key);
      const envValue = this.envValue(definition);
      const resolved = override
        ? this.decrypt(override.value, definition)
        : (envValue ?? definition.defaultValue);
      const source = override
        ? PlatformSettingSource.DATABASE
        : envValue !== null
          ? PlatformSettingSource.ENV
          : PlatformSettingSource.DEFAULT;
      return {
        key: definition.key,
        category: definition.category,
        type: definition.type,
        value: definition.isSecret ? null : resolved,
        defaultValue: definition.isSecret ? null : definition.defaultValue,
        source,
        envVar: definition.envVar,
        requiresRestart: definition.requiresRestart ?? false,
        isSecret: definition.isSecret ?? false,
        hasValue: resolved !== null && resolved.length > 0,
        min: definition.min ?? null,
        max: definition.max ?? null,
        options: definition.options ?? null,
        updatedAt: override ? override.updatedAt.toISOString() : null,
      };
    });
    return { generatedAt: new Date().toISOString(), settings };
  }

  /**
   * Write an operator override. The raw value is validated + normalized
   * against the registry first, so an invalid value can never reach a
   * consumer. Audited in `audit_logs` with the value REDACTED for secrets.
   */
  async set(key: PlatformSettingKey, rawValue: string, actorUserId: string): Promise<void> {
    const definition = this.definitionOrThrow(key);
    const validation = validateSettingValue(definition, rawValue);
    if (!validation.ok) {
      throw new BadRequestException(`admin.errors.setting.${validation.reason}`);
    }
    const stored = definition.isSecret
      ? SECRET_ENC_PREFIX + this.encryption.encrypt(validation.normalized)
      : validation.normalized;

    await this.databaseService.transaction(async (client) => {
      await client.query(
        `INSERT INTO platform_settings (key, value, updated_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               updated_by = EXCLUDED.updated_by,
               updated_at = CURRENT_TIMESTAMP`,
        [definition.key, stored, actorUserId],
      );
      await client.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          actorUserId,
          'PLATFORM_SETTING_CHANGE',
          'platform_setting',
          definition.key,
          JSON.stringify({
            key: definition.key,
            // A secret's value never enters the audit trail, only the fact of the change.
            value: definition.isSecret ? null : validation.normalized,
            isSecret: definition.isSecret ?? false,
            changedAt: new Date().toISOString(),
          }),
        ],
      );
    });
    this.invalidate();
  }

  /**
   * Drop the override so the key falls back to its env var / code default.
   * This is the escape hatch when a panel change makes things worse.
   */
  async reset(key: PlatformSettingKey, actorUserId: string): Promise<void> {
    const definition = this.definitionOrThrow(key);
    await this.databaseService.transaction(async (client) => {
      await client.query('DELETE FROM platform_settings WHERE key = $1', [definition.key]);
      await client.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          actorUserId,
          'PLATFORM_SETTING_RESET',
          'platform_setting',
          definition.key,
          JSON.stringify({ key: definition.key, changedAt: new Date().toISOString() }),
        ],
      );
    });
    this.invalidate();
  }

  /** Drop the cached override set so the next read re-queries. */
  invalidate(): void {
    this.cache = null;
    this.cacheLoadedAt = 0;
  }

  // --- internals -------------------------------------------------------------

  private definitionOrThrow(key: PlatformSettingKey): PlatformSettingDefinition {
    const definition = PLATFORM_SETTINGS_BY_KEY.get(key);
    if (!definition) {
      throw new NotFoundException('admin.errors.settingNotFound');
    }
    return definition;
  }

  /** DB override -> env -> default, as a raw (decrypted) string. */
  private async resolveRaw(definition: PlatformSettingDefinition): Promise<string | null> {
    const overrides = await this.loadOverrides();
    const override = overrides.get(definition.key);
    if (override) {
      return this.decrypt(override.value, definition);
    }
    return this.envValue(definition) ?? definition.defaultValue;
  }

  private envValue(definition: PlatformSettingDefinition): string | null {
    const raw = this.configService.get<string>(definition.envVar);
    if (raw === undefined || raw === null) {return null;}
    const value = String(raw).trim();
    return value.length === 0 ? null : value;
  }

  private decrypt(stored: string, definition: PlatformSettingDefinition): string {
    if (!definition.isSecret || !stored.startsWith(SECRET_ENC_PREFIX)) {
      return stored;
    }
    try {
      return this.encryption.decrypt(stored.slice(SECRET_ENC_PREFIX.length));
    } catch (error: unknown) {
      // A key rotation can orphan a stored secret. Fail soft to the env value
      // rather than throwing inside whatever consumer asked for it.
      this.logger.error(
        `Failed to decrypt setting ${definition.key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.envValue(definition) ?? '';
    }
  }

  private async loadOverrides(): Promise<Map<string, Override>> {
    if (this.cache && Date.now() - this.cacheLoadedAt < CACHE_TTL_MS) {
      return this.cache;
    }
    if (this.inflight) {
      return this.inflight;
    }
    this.inflight = this.queryOverrides()
      .then((loaded) => {
        this.cache = loaded;
        this.cacheLoadedAt = Date.now();
        return loaded;
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  private async queryOverrides(): Promise<Map<string, Override>> {
    try {
      const rows = await this.databaseService.query<OverrideRow>(
        'SELECT key, value, updated_at FROM platform_settings',
      );
      return new Map(rows.map((r) => [r.key, { value: r.value, updatedAt: r.updated_at }]));
    } catch (error: unknown) {
      // Table missing (pre-migration boot) or a transient DB error must never
      // break a consumer — every key then resolves from env/default as before.
      this.logger.warn(
        `platform_settings read failed, falling back to env/defaults: ${error instanceof Error ? error.message : String(error)}`,
      );
      return new Map();
    }
  }
}
