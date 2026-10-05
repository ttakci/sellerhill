import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient } from 'pg';

/** Serializes a store's remote campaign snapshot and mutations across API workers. */
@Injectable()
export class CampaignAccountLockService implements OnModuleDestroy {
  private readonly logger = new Logger(CampaignAccountLockService.name);
  private readonly accountTails = new Map<string, Promise<void>>();
  private readonly lockPool: Pool | undefined;

  constructor(config: ConfigService) {
    const databaseUrl = config.get<string>('DATABASE_URL');
    if (databaseUrl) {
      const pool = new Pool({
        connectionString: databaseUrl,
        max: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      pool.on('error', (error: Error) => {
        this.logger.error('Unexpected error on an idle campaign-lock connection', error);
      });
      this.lockPool = pool;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.lockPool?.end();
  }

  async run<T>(accountId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.accountTails.get(accountId) ?? Promise.resolve();
    let releaseTurn!: () => void;
    const turn = new Promise<void>((resolve) => {
      releaseTurn = resolve;
    });
    const tail = previous.then(() => turn);
    this.accountTails.set(accountId, tail);
    await previous;

    const lockPool = this.lockPool;
    if (!lockPool) {
      releaseTurn();
      if (this.accountTails.get(accountId) === tail) {
        this.accountTails.delete(accountId);
      }
      throw new Error('DATABASE_URL is required for campaign account locking');
    }

    let client: PoolClient | undefined;
    const key = `sellerhill.ebay-campaign:${accountId}`;
    let acquired = false;
    let destroySessionWithError: Error | undefined;
    let operationResult!: T;
    let operationFailed = false;
    let operationError: unknown;
    try {
      // Same-process waiters queue before taking a pool connection. The advisory
      // lock still coordinates this account with other API workers.
      client = await lockPool.connect();
      await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [key]);
      acquired = true;
      operationResult = await operation();
    } catch (error: unknown) {
      operationFailed = true;
      operationError = error;
      if (client && !acquired) {
        destroySessionWithError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (acquired && client) {
      try {
        await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [key]);
      } catch (error: unknown) {
        destroySessionWithError = error instanceof Error ? error : new Error(String(error));
        operationFailed = true;
        operationError = error;
      }
    }

    try {
      client?.release(destroySessionWithError);
    } finally {
      releaseTurn();
      if (this.accountTails.get(accountId) === tail) {
        this.accountTails.delete(accountId);
      }
    }

    if (operationFailed) {
      throw operationError;
    }
    return operationResult;
  }
}
