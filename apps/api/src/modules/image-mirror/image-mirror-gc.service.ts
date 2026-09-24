import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extractKeepaImageName } from '@repo/shared';
import type { Job, Queue } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';

import { selectOrphanKeys } from './image-mirror-gc';
import { ImageMirrorService } from './image-mirror.service';

/** Dedicated BullMQ queue for the nightly sweep. */
export const IMAGE_MIRROR_GC_QUEUE = 'image-mirror-gc';
/** Job name on that queue. */
const IMAGE_MIRROR_GC_JOB = 'collect-orphaned-images';
/**
 * No env/platform-settings override, matching `ListingPlanLimitProcessor` —
 * this is an internal housekeeping cadence with no operator-facing reason to
 * retune it, unlike `DATA_RETENTION_CRON`'s windows.
 */
const DEFAULT_GC_CRON = '23 4 * * *';
const DELETE_BATCH = 1000;

/**
 * Collects mirrored images no live product references.
 *
 * Products are reference-counted: the last listing referencing one takes the
 * row with it (`listings.service.ts:2189`). That path fires only on explicit
 * listing deletion, not on INACTIVE, plan-limit retirement or account cascade,
 * so this sweep is what eventually collects the rest.
 *
 * Runs as a BullMQ repeatable job, like every other scheduled job in this
 * codebase (`ListingPlanLimitProcessor`, `DataRetentionService`,
 * `SubscriptionReconcileProcessor`) — not `@nestjs/schedule`, which this
 * codebase does not otherwise use.
 */
@Processor(IMAGE_MIRROR_GC_QUEUE, { concurrency: 1 })
@Injectable()
export class ImageMirrorGcService extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ImageMirrorGcService.name);

  constructor(
    @InjectQueue(IMAGE_MIRROR_GC_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly mirror: ImageMirrorService
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        IMAGE_MIRROR_GC_JOB,
        {},
        {
          repeat: { pattern: DEFAULT_GC_CRON },
          jobId: 'image-mirror-gc-tick',
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        }
      );
    } catch (error: unknown) {
      // Fail-soft: a scheduling failure must not abort boot.
      this.logger.warn(
        `Failed to schedule image GC: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async process(job: Job): Promise<void> {
    if (job.name !== IMAGE_MIRROR_GC_JOB) {
      return;
    }
    await this.sweep();
  }

  async sweep(): Promise<void> {
    if (!this.mirror.isConfigured()) {
      return;
    }

    let liveNames: Set<string>;
    try {
      liveNames = await this.loadLiveNames();
    } catch (error) {
      // Aborting is the whole point. A failed read is not evidence that no
      // products exist, and acting on it would empty the bucket.
      this.logger.error(
        `Aborting image GC: could not read the live product set (${error instanceof Error ? error.message : String(error)})`
      );
      return;
    }

    if (liveNames.size === 0) {
      this.logger.warn('Aborting image GC: the live product set is empty');
      return;
    }

    try {
      const removed = await this.deleteOrphans(liveNames);
      this.logger.log(`Image GC complete: ${removed} orphaned object(s) removed, ${liveNames.size} live`);
    } catch (error) {
      this.logger.error(`Image GC failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async loadLiveNames(): Promise<Set<string>> {
    const rows = await this.database.query<{ url: string | null }>(
      `SELECT image_urls->>0 AS url FROM products WHERE image_mirrored_at IS NOT NULL`
    );
    const names = new Set<string>();
    for (const row of rows) {
      const name = row.url ? extractKeepaImageName(row.url) : null;
      if (name) {
        names.add(name);
      }
    }
    return names;
  }

  private client(): S3Client {
    return new S3Client({
      region: 'auto',
      endpoint: `https://${this.config.get<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID') as string,
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY') as string,
      },
    });
  }

  private async deleteOrphans(liveNames: Set<string>): Promise<number> {
    const bucket = this.config.get<string>('R2_BUCKET') as string;
    const client = this.client();
    let token: string | undefined;
    let removed = 0;

    do {
      const page = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: DELETE_BATCH })
      );
      const keys = (page.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k));
      const orphans = selectOrphanKeys(keys, liveNames);
      if (orphans.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: orphans.map((Key) => ({ Key })) },
          })
        );
        removed += orphans.length;
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    return removed;
  }
}
