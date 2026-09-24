import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';

import { isObjectOldEnoughToDelete, selectOrphanKeys } from './image-mirror-gc';
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
 * Same value and same reasoning as `ImageMirrorService`'s S3 client: the SDK's
 * own default is no timeout at all, and `requestTimeout` alone only WARNS on
 * breach — `throwOnRequestTimeout` is required to actually bound the call. A
 * stalled R2 list/delete must not hang the nightly job indefinitely.
 */
const S3_REQUEST_TIMEOUT_MS = 15_000;

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
  private s3Client: S3Client | null = null;

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

  /**
   * Reads the name actually mirrored for each product, not the current
   * `image_urls->>0` — see migration 117. `image_urls` is refreshed from
   * Keepa and changes when Amazon rotates the primary image; the published
   * description was written once and still embeds the old name, so the live
   * set has to reflect what was embedded, not what is current.
   */
  private async loadLiveNames(): Promise<Set<string>> {
    const rows = await this.database.query<{ name: string | null }>(
      `SELECT mirrored_image_name AS name FROM products WHERE mirrored_image_name IS NOT NULL`
    );
    const names = new Set<string>();
    for (const row of rows) {
      if (row.name) {
        names.add(row.name);
      }
    }
    return names;
  }

  private client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${this.config.get<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID') as string,
          secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY') as string,
        },
        requestHandler: {
          requestTimeout: S3_REQUEST_TIMEOUT_MS,
          throwOnRequestTimeout: true,
        },
      });
    }
    return this.s3Client;
  }

  private async deleteOrphans(liveNames: Set<string>): Promise<number> {
    const bucket = this.config.get<string>('R2_BUCKET') as string;
    const client = this.client();
    let token: string | undefined;
    let removed = 0;
    // Computed once per sweep — pagination completes in seconds, far shorter
    // than the 48h safety margin, so a single "now" for the whole run is fine.
    const now = new Date();

    do {
      const page = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: DELETE_BATCH })
      );
      const contents = page.Contents ?? [];
      const keys = contents.map((o) => o.Key).filter((k): k is string => Boolean(k));
      const lastModifiedByKey = new Map(contents.map((o) => [o.Key, o.LastModified]));
      const orphans = selectOrphanKeys(keys, liveNames).filter((key) =>
        isObjectOldEnoughToDelete(lastModifiedByKey.get(key), now)
      );
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
