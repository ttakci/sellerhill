import * as fs from 'fs';
import * as path from 'path';

import { Logger } from '@nestjs/common';
import { PoolClient } from 'pg';

interface MigrationRow {
  name: string;
}

export class MigrationRunner {
  private readonly logger = new Logger(MigrationRunner.name);

  constructor(private readonly client: PoolClient) {}

  async run(): Promise<void> {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const { rows } = await this.client.query<MigrationRow>('SELECT name FROM migrations');
    const executed = new Set(rows.map((r) => r.name));

    const migrationsDir = this.resolveMigrationsDir();
    if (!fs.existsSync(migrationsDir)) {
      this.logger.warn(`Migrations directory not found: ${migrationsDir}`);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      this.logger.log('No migration files found');
      return;
    }

    const pending = files.filter((f) => !executed.has(f));

    if (pending.length === 0) {
      this.logger.log('No pending migrations');
      return;
    }

    this.logger.log(`Running ${pending.length} pending migration(s)...`);

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      this.logger.log(`  → ${file}`);
      await this.client.query(sql);
      await this.client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
    }

    this.logger.log(`Applied ${pending.length} migration(s) successfully`);
  }

  private resolveMigrationsDir(): string {
    // __dirname is src/common/database or dist/common/database
    // ../../.. goes from database → common → src → api root
    return path.resolve(__dirname, '../../../migrations');
  }
}
