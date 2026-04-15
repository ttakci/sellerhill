import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';

/**
 * Database Service
 * Manages PostgreSQL connection pool and provides query methods
 */
@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: Pool;

  constructor(private readonly configService: ConfigService) {
    this.initializePool();
  }

  async onModuleInit(): Promise<void> {
    await this.testConnection();
  }

  /**
   * Initialize PostgreSQL connection pool
   */
  private initializePool(): void {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      this.logger.warn('DATABASE_URL not configured. Database operations will fail.');
      return;
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
      max: parseInt(this.configService.get<string>('DB_POOL_MAX', '20'), 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle client', err);
    });

    this.logger.log('Database connection pool initialized');
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      const result = await client.query<{ now: Date }>('SELECT NOW()');
      client.release();
      this.logger.log(`Database connection successful. Server time: ${result.rows[0].now.toISOString()}`);
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
    }
  }

  /**
   * Execute a query
   */
  async query<T>(text: string, params?: (string | number | boolean | null | undefined)[]): Promise<T[]> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      this.logger.debug(`Query executed in ${duration}ms`);
      return result.rows as T[];
    } catch (error) {
      this.logger.error(`Query failed in ${Date.now() - start}ms`, error);
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Execute queries within a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction rolled back', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close all connections (useful for testing or graceful shutdown)
   */
  async closeAll(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Database pool closed');
    }
  }
}
