// apps/api/src/modules/admin/data-retention.service.ts
//
// Nightly retention purge for every append-only table in the schema, driven by
// `DATA_RETENTION_RULES`. Replaces the former `QueueObservabilityRetentionService`,
// which purged exactly one of the six tables that need it — and not the one
// that grows fastest (`keepa_usage_log`, ~26M rows/year).
//
// Policy (which tables, which floors, the SQL) lives in the pure, unit-tested
// `data-retention.manifest.ts`. This file is the BullMQ + pg shell.
//
// Fail-soft throughout: a purge failure is logged and the next nightly tick
// retries. It must never throw into the API process, and one failing table
// must never stop the other five — disk hygiene is not worth an outage.

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import {
  buildRetentionDeleteSql,
  clampRetentionDays,
  DATA_RETENTION_BATCH_SIZE,
  DATA_RETENTION_MAX_BATCHES,
  DATA_RETENTION_RULES,
  type DataRetentionRule,
  type DataRetentionTableResult,
} from './data-retention.manifest';

/** Dedicated BullMQ queue for the nightly purge. */
export const DATA_RETENTION_QUEUE = 'data-retention';

/** Job name on that queue. */
const PURGE_JOB = 'purge-expired-rows';

/** Daily, off the :00 mark so it does not collide with hourly schedulers. */
const DEFAULT_RETENTION_CRON = '17 3 * * *';

interface DeletedCountRow {
  deleted: string;
}

@Processor(DATA_RETENTION_QUEUE, { concurrency: 1 })
@Injectable()
export class DataRetentionService extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    @InjectQueue(DATA_RETENTION_QUEUE) private readonly retentionQueue: Queue,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly platformSettings: PlatformSettingsService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Cron is consumed once here, at boot — changing it needs a restart, which
    // is why it stays an env var rather than a panel setting. The WINDOWS are
    // panel-tunable; the schedule is not.
    const cron =
      this.configService.get<string>('DATA_RETENTION_CRON') ??
      this.configService.get<string>('QUEUE_OBSERVABILITY_RETENTION_CRON') ??
      DEFAULT_RETENTION_CRON;
    try {
      await this.retentionQueue.add(
        PURGE_JOB,
        {},
        {
          repeat: { pattern: cron },
          jobId: 'data-retention-tick',
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        },
      );
      this.logger.log(
        `Data retention purge scheduled: cron="${cron}", ${DATA_RETENTION_RULES.length} table(s).`,
      );
    } catch (err: unknown) {
      // Fail-soft: a scheduling failure must not abort boot.
      this.logger.warn(
        `Failed to schedule data retention purge: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async process(job: Job): Promise<DataRetentionTableResult[]> {
    if (job.name !== PURGE_JOB) {
      return [];
    }
    return this.purgeAll();
  }

  /**
   * Purge every table in the manifest. Tables are processed sequentially so
   * the job never holds several long-running DELETEs at once. Public so an
   * operator script can trigger it out of band.
   */
  async purgeAll(): Promise<DataRetentionTableResult[]> {
    const results: DataRetentionTableResult[] = [];
    for (const rule of DATA_RETENTION_RULES) {
      results.push(await this.purgeTable(rule));
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deletedRows, 0);
    const failures = results.filter((r) => r.failed);
    const truncated = results.filter((r) => r.truncated);

    this.logger.log(
      `Data retention purge complete: ${totalDeleted} row(s) deleted across ${results.length} table(s)` +
        (failures.length > 0 ? `; ${failures.length} failed (${failures.map((f) => f.table).join(', ')})` : '') +
        (truncated.length > 0
          ? `; ${truncated.length} hit the batch cap and will continue next run (${truncated.map((t) => t.table).join(', ')})`
          : '') +
        '.',
    );
    return results;
  }

  /**
   * Purge one table in bounded batches.
   *
   * Batching matters: the first run after enabling retention on a long-lived
   * database can face millions of expired rows, and a single DELETE there
   * would hold locks and bloat WAL for minutes. Each statement is capped at
   * `DATA_RETENTION_BATCH_SIZE`, and the whole table is capped at
   * `DATA_RETENTION_MAX_BATCHES` per run so one backlog cannot monopolise the
   * job — the remainder is picked up tomorrow, since the purge is idempotent
   * and resumable by construction.
   */
  private async purgeTable(rule: DataRetentionRule): Promise<DataRetentionTableResult> {
    const retentionDays = await this.resolveRetentionDays(rule);
    const result: DataRetentionTableResult = {
      table: rule.table,
      deletedRows: 0,
      retentionDays,
      truncated: false,
      failed: false,
    };

    let sql: string;
    try {
      sql = buildRetentionDeleteSql(rule, DATA_RETENTION_BATCH_SIZE);
    } catch (err: unknown) {
      // An identifier failed validation — refuse to run rather than improvise.
      result.failed = true;
      result.error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Data retention refused to build SQL for ${rule.table}: ${result.error}`);
      return result;
    }

    try {
      for (let batch = 0; batch < DATA_RETENTION_MAX_BATCHES; batch += 1) {
        const rows = await this.databaseService.query<DeletedCountRow>(sql, [
          String(retentionDays),
        ]);
        const deleted = Number.parseInt(rows[0]?.deleted ?? '0', 10) || 0;
        result.deletedRows += deleted;
        if (deleted < DATA_RETENTION_BATCH_SIZE) {
          return result;
        }
      }
      // Ran out of batches with a full batch still coming back — more remains.
      result.truncated = true;
      return result;
    } catch (err: unknown) {
      result.failed = true;
      result.error = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Data retention purge failed for ${rule.table} after ${result.deletedRows} row(s): ${result.error}`,
      );
      return result;
    }
  }

  /**
   * Effective window for a rule: panel override → env → registry default, then
   * clamped to the rule's own code floor. A settings outage falls back to the
   * floor, which keeps MORE data — the safe direction.
   */
  private async resolveRetentionDays(rule: DataRetentionRule): Promise<number> {
    try {
      return clampRetentionDays(rule, await this.platformSettings.getNumber(rule.settingKey));
    } catch (err: unknown) {
      this.logger.warn(
        `Data retention could not resolve ${rule.settingKey} (${err instanceof Error ? err.message : String(err)}) — using the ${rule.minDays}-day floor.`,
      );
      return rule.minDays;
    }
  }
}
