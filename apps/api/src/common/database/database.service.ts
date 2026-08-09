import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';

/** A scalar a query can be parameterized with. */
export type QueryScalar = string | number | boolean | null | undefined;

/**
 * A bind parameter.
 *
 * Arrays are included because `pg` serializes a JS array into a Postgres array
 * literal, which is what lets a batch write update N rows in ONE round trip
 * (`UPDATE … FROM (SELECT * FROM unnest($1::uuid[], $2::numeric[]) …)`) instead
 * of issuing N statements. Without this the fan-out has to loop.
 */
export type QueryParam = QueryScalar | QueryScalar[];

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
    await this.runMigrations();
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
   * Run pending database migrations
   */
  private async runMigrations(): Promise<void> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const { MigrationRunner } = await import('./migration-runner');
      const runner = new MigrationRunner(client);
      await runner.run();
      await client.query('COMMIT');
      this.logger.log('Database migrations completed');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Migration failed, rolled back', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query
   */
  async query<T>(text: string, params?: QueryParam[]): Promise<T[]> {
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
