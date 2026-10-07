import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_USER_TIMEZONE } from '@repo/shared';

import { DatabaseService } from '../database/database.service';

/**
 * The seller's time zone. Names are validated against POSTGRES
 * (`pg_timezone_names`), not Node: SQL is what consumes them, and a name Node
 * accepts but Postgres does not would make every dashboard query fail (22023).
 */
@Injectable()
export class TimezoneService {
  private readonly logger = new Logger(TimezoneService.name);
  private names: Promise<Set<string>> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  private loadNames(): Promise<Set<string>> {
    if (!this.names) {
      this.names = this.databaseService
        .query<{ name: string }>('SELECT name FROM pg_timezone_names')
        .then((rows) => new Set(rows.map((row) => row.name)))
        .catch((error: unknown) => {
          this.names = null; // retry on the next call
          throw error;
        });
    }
    return this.names;
  }

  async isValid(name: string): Promise<boolean> {
    if (!name || name.length > 64) {
      return false;
    }
    return (await this.loadNames()).has(name);
  }

  /** The stored zone, or UTC when it is empty, unknown to Postgres, or unreadable. */
  async getForUser(userId: string): Promise<string> {
    try {
      const rows = await this.databaseService.query<{ timezone: string | null }>(
        'SELECT timezone FROM users WHERE id = $1',
        [userId],
      );
      const stored = rows[0]?.timezone;
      if (!stored) {
        return DEFAULT_USER_TIMEZONE;
      }
      if (await this.isValid(stored)) {
        return stored;
      }
      this.logger.warn(`users.timezone for ${userId} is not a Postgres zone; using UTC`);
    } catch (error) {
      this.logger.warn(`timezone lookup failed for ${userId}; using UTC: ${String(error)}`);
    }
    return DEFAULT_USER_TIMEZONE;
  }
}
