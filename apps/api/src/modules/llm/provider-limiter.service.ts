import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AssistantLeaseStatus,
  AssistantLimitReason,
  AssistantLimiterReadiness,
  AssistantReservationStatus,
  LlmUsagePurpose,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { RedisService } from '../../common/redis/redis.service';

const SCRIPT_NAME = 'llm-provider-acquire';
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export interface ProviderLimiterRequest {
  userId?: string;
  purpose: LlmUsagePurpose;
  generationAttemptId?: string;
  estimatedPromptTokens?: number;
  maxCompletionTokens?: number;
  estimatedEmbeddingTokens?: number;
}

export interface ProviderLimiterPermit {
  leaseId: string;
  reservedTokens: number;
  release(): Promise<void>;
}

export class ProviderLimitError extends Error {
  constructor(readonly reason: AssistantLimitReason) {
    super(reason);
    this.name = ProviderLimitError.name;
  }
}

@Injectable()
export class ProviderLimiterService implements OnModuleInit {
  private readonly provider: string;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly database: DatabaseService
  ) {
    this.provider = this.config.get<string>('LLM_PROVIDER', 'default');
  }

  async onModuleInit(): Promise<void> {
    const source = readFileSync(join(__dirname, 'provider-limiter.lua'), 'utf8');
    this.redis.registerScript(SCRIPT_NAME, source);
    await this.rebuild();
  }

  async acquire(request: ProviderLimiterRequest): Promise<ProviderLimiterPermit> {
    const now = new Date();
    const leaseId = randomUUID();
    const reservedTokens =
      (request.estimatedPromptTokens ?? 0) +
      (request.maxCompletionTokens ?? 0) +
      (request.estimatedEmbeddingTokens ?? 0);
    const userKey = request.userId ?? 'system';
    const minute = Math.floor(now.getTime() / MINUTE_MS);
    const keys = this.keys(userKey, minute);
    const result = await this.redis.runScript(SCRIPT_NAME, keys, [
      now.getTime(),
      this.number('LLM_PROVIDER_RPM', 60),
      this.number('LLM_USER_CONCURRENCY', 1),
      this.number('LLM_PROVIDER_CONCURRENCY', 5),
      MINUTE_MS,
      leaseId,
      this.number('LLM_LEASE_TTL_MS', 120_000),
      reservedTokens,
      this.number('LLM_PROVIDER_TPM', 100_000),
    ]);
    const values = result as number[];
    if (Number(values[0]) !== 1) {
      throw new ProviderLimitError(this.reason(Number(values[1])));
    }

    try {
      await this.persistLease(request, leaseId, now);
      if (request.generationAttemptId && reservedTokens > 0) {
        await this.reserveAssistantQuota(request, reservedTokens, now);
      }
    } catch (error) {
      await this.releaseRedis(keys, leaseId);
      throw error;
    }

    return {
      leaseId,
      reservedTokens,
      release: () => this.release(request, leaseId, keys),
    };
  }

  async reconcile(generationAttemptId: string, usageLogId: string): Promise<void> {
    await this.database.transaction(async (client) => {
      const usage = await client.query<{ total: number }>(
        `SELECT COALESCE(prompt_tokens,0)+COALESCE(completion_tokens,0)+COALESCE(embedding_tokens,0) AS total
         FROM llm_usage_log WHERE id=$1`,
        [usageLogId]
      );
      const actual = Number(usage.rows[0]?.total ?? 0);
      const reservations = await client.query<{ id: string; ledger_id: number; reserved_tokens: number }>(
        `SELECT id,ledger_id,reserved_tokens FROM assistant_quota_reservations
         WHERE generation_attempt_id=$1 AND status=$2 FOR UPDATE`,
        [generationAttemptId, AssistantReservationStatus.RESERVED]
      );
      for (const reservation of reservations.rows) {
        const inserted = await client.query(
          `INSERT INTO assistant_quota_reconciliations
           (generation_attempt_id,reservation_id,source_key,window_start,window_end,reserved_tokens,actual_tokens,delta_tokens,status,completed_at)
           SELECT $1,$2,source_key,l.window_start,l.window_end,$3,$4,$4-$3,'completed',NOW()
           FROM assistant_quota_reservations r JOIN assistant_quota_ledger l ON l.id=r.ledger_id WHERE r.id=$2
           ON CONFLICT DO NOTHING RETURNING id`,
          [generationAttemptId, reservation.id, reservation.reserved_tokens, actual]
        );
        if (inserted.rowCount === 0) {continue;}
        await client.query(
          `UPDATE assistant_quota_ledger SET reserved_tokens=GREATEST(0,reserved_tokens-$2),actual_tokens=actual_tokens+$3,version=version+1,updated_at=NOW() WHERE id=$1`,
          [reservation.ledger_id, reservation.reserved_tokens, actual]
        );
        await client.query(
          `UPDATE assistant_quota_reservations SET status=$2,actual_tokens=$3,reconciled_at=NOW(),updated_at=NOW() WHERE id=$1`,
          [reservation.id, AssistantReservationStatus.RECONCILED, actual]
        );
      }
      await client.query(`UPDATE assistant_generation_attempts SET llm_usage_log_id=$2 WHERE id=$1`, [generationAttemptId, usageLogId]);
    });
  }

  async rebuild(): Promise<void> {
    const readiness = this.readinessKey();
    await this.redis.command.set(readiness, AssistantLimiterReadiness.REBUILDING);
    try {
      const now = new Date();
      const leases = await this.database.query<{ id: string; scope_key: string; expires_at: Date }>(
        `SELECT id,scope_key,expires_at FROM assistant_concurrency_leases WHERE status=$1 AND expires_at>NOW()`,
        [AssistantLeaseStatus.ACTIVE]
      );
      const usage = await this.database.query<{ total: number }>(
        `SELECT COALESCE(SUM(COALESCE(prompt_tokens,0)+COALESCE(completion_tokens,0)+COALESCE(embedding_tokens,0)),0)::bigint AS total
         FROM llm_usage_log WHERE provider=$1 AND requested_at>=date_trunc('minute',NOW())`,
        [this.provider]
      );
      const minute = Math.floor(now.getTime() / MINUTE_MS);
      const providerConcurrency = this.redis.keys.key('llm', 'concurrency', 'provider', this.provider);
      await this.redis.command.del(providerConcurrency);
      for (const lease of leases) {
        const expiry = new Date(lease.expires_at).getTime();
        await this.redis.command.zadd(lease.scope_key, expiry, lease.id);
        await this.redis.command.zadd(providerConcurrency, expiry, lease.id);
      }
      await this.redis.command.set(this.redis.keys.key('llm', 'tokens', this.provider, String(minute)), Number(usage[0]?.total ?? 0), 'PX', MINUTE_MS);
      await this.database.query(
        `INSERT INTO assistant_limiter_state(scope_key,readiness,checkpoint_at,checkpoint_value) VALUES($1,$2,NOW(),$3)
         ON CONFLICT(scope_key) DO UPDATE SET readiness=$2,checkpoint_at=NOW(),checkpoint_value=$3,version=assistant_limiter_state.version+1,updated_at=NOW(),error_code=NULL`,
        [readiness, AssistantLimiterReadiness.READY, Number(usage[0]?.total ?? 0)]
      );
      await this.redis.command.set(readiness, AssistantLimiterReadiness.READY);
    } catch (error) {
      await this.redis.command.set(readiness, AssistantLimiterReadiness.FAILED);
      throw error;
    }
  }

  private async persistLease(request: ProviderLimiterRequest, leaseId: string, now: Date): Promise<void> {
    if (!request.generationAttemptId) {return;}
    const expiry = new Date(now.getTime() + this.number('LLM_LEASE_TTL_MS', 120_000));
    await this.database.query(
      `INSERT INTO assistant_concurrency_leases(id,generation_attempt_id,scope_key,owner_id,status,expires_at)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(generation_attempt_id,scope_key) DO NOTHING`,
      [leaseId, request.generationAttemptId, this.redis.keys.key('llm', 'concurrency', 'user', request.userId ?? 'system'), request.userId ?? request.generationAttemptId, AssistantLeaseStatus.ACTIVE, expiry.toISOString()]
    );
  }

  private async reserveAssistantQuota(request: ProviderLimiterRequest, tokens: number, now: Date): Promise<void> {
    if (request.purpose !== LlmUsagePurpose.ASSISTANT || !request.userId || !request.generationAttemptId) {return;}
    const start = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
    const end = new Date(start.getTime() + DAY_MS);
    const limit = this.number('LLM_ASSISTANT_DAILY_TOKENS', 50_000);
    await this.database.transaction(async (client) => {
      const ledger = await client.query<{ id: number; reserved_tokens: number; actual_tokens: number }>(
        `INSERT INTO assistant_quota_ledger(scope,user_id,window_start,window_end,token_limit) VALUES('user',$1,$2,$3,$4)
         ON CONFLICT(user_id,window_start,window_end) WHERE scope='user' DO UPDATE SET updated_at=NOW()
         RETURNING id,reserved_tokens,actual_tokens`,
        [request.userId, start.toISOString(), end.toISOString(), limit]
      );
      const row = ledger.rows[0];
      if (Number(row.reserved_tokens) + Number(row.actual_tokens) + tokens > limit) {throw new ProviderLimitError(AssistantLimitReason.USER_DAILY_TOKENS);}
      await client.query(`UPDATE assistant_quota_ledger SET reserved_tokens=reserved_tokens+$2,version=version+1 WHERE id=$1`, [row.id, tokens]);
      await client.query(
        `INSERT INTO assistant_quota_reservations(generation_attempt_id,scope,ledger_id,source_key,estimated_prompt_tokens,estimated_completion_tokens,estimated_embedding_tokens,reserved_tokens,status,expires_at)
         VALUES($1,'user',$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
        [request.generationAttemptId, row.id, request.purpose, request.estimatedPromptTokens ?? 0, request.maxCompletionTokens ?? 0, request.estimatedEmbeddingTokens ?? 0, tokens, AssistantReservationStatus.RESERVED, new Date(now.getTime()+this.number('LLM_LEASE_TTL_MS',120_000)).toISOString()]
      );
    });
  }

  private async release(request: ProviderLimiterRequest, leaseId: string, keys: string[]): Promise<void> {
    await this.releaseRedis(keys, leaseId);
    if (request.generationAttemptId) {
      await this.database.query(`UPDATE assistant_concurrency_leases SET status=$2,released_at=NOW() WHERE id=$1 AND status=$3`, [leaseId, AssistantLeaseStatus.RELEASED, AssistantLeaseStatus.ACTIVE]);
    }
  }

  private releaseRedis(keys: string[], leaseId: string): Promise<unknown> {
    return this.redis.command.multi().zrem(keys[2], leaseId).zrem(keys[3], leaseId).exec();
  }

  private keys(user: string, minute: number): string[] {
    return [this.readinessKey(), this.redis.keys.key('llm','rpm',user,String(minute)), this.redis.keys.key('llm','concurrency','user',user), this.redis.keys.key('llm','concurrency','provider',this.provider), this.redis.keys.key('llm','tokens',this.provider,String(minute))];
  }
  private readinessKey(): string { return this.redis.keys.key('llm','readiness',this.provider); }
  private number(key: string, fallback: number): number { const value=Number(this.config.get<string>(key)); return Number.isFinite(value)&&value>0?value:fallback; }
  private reason(code: number): AssistantLimitReason { return ({1:AssistantLimitReason.USER_REQUEST_RATE,2:AssistantLimitReason.USER_CONCURRENCY,4:AssistantLimitReason.GLOBAL_CONCURRENCY,5:AssistantLimitReason.GLOBAL_TOKEN_CAPACITY,6:AssistantLimitReason.LIMITER_UNAVAILABLE} as Record<number,AssistantLimitReason>)[code] ?? AssistantLimitReason.LIMITER_UNAVAILABLE; }
}
