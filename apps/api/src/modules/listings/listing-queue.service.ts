import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
    type CreateListingsRequest,
    type ListingBatchQueueJobData,
    type ListingJobDto,
} from '@repo/shared';
import { Queue } from 'bullmq';

import { stampCurrentCorrelation } from '../../common/observability/queue-correlation';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { chunkForBulk } from '../ebay/ebay-bulk.helpers';

import { LISTING_BATCH_JOB } from './listings.constants';
import { ListingsService } from './listings.service';

@Injectable()
export class ListingQueueService {
  private readonly logger = new Logger(ListingQueueService.name);

  constructor(
    @InjectQueue('listings') private readonly listingQueue: Queue,
    private readonly listingsService: ListingsService,
    private readonly quotaEnforcement: QuotaEnforcementService,
  ) {}

  /**
   * Add a bulk listing creation job to the queue.
   *
   * Billing quota gate (BILLING_ENFORCEMENT_ENABLED): for non-draft bulk
   * creates, reserve N active-listings slots under an advisory lock BEFORE
   * enqueuing. Drafts are excluded from quota (they don't occupy a slot until
   * publish). If the reserve would exceed the limit, throw QuotaExhaustedError
   * — the controller surfaces it as a structured 4xx (no jobs enqueued).
   */
  async addListingJob(
    userId: string,
    request: CreateListingsRequest,
  ): Promise<ListingJobDto> {
    const { asins } = request;

    // Every create goes out as a batch, and a batch carries exactly one seller
    // token — so the store is required, not optional. It always was in the
    // type and in the UI; the old code just degraded silently to a per-ASIN
    // path when a raw API caller left it out (the controller binds a plain
    // interface, so nothing validates the body). Now it is refused up front
    // instead of enqueuing work that cannot resolve an account.
    if (!request.ebayAccountId) {
      throw new BadRequestException('An eBay store must be selected to create listings');
    }

    // 1. Create job record in database (returns the created job items)
    const job = await this.listingsService.createJob(userId, request);
    this.logger.log(`Created listing job ${job.id} for user ${userId} with ${asins.length} ASINs`);

    // 2. Billing-quota gate: reserve slots for NON-DRAFT creates only. Drafts
    //    are excluded from quota (they reserve at publish time). Race-safe:
    //    reserveForBulkCreate takes a transaction-scoped advisory lock.
    const asDraft = Boolean(request.asDraft);
    if (!asDraft && job.items.length > 0) {
      try {
        await this.quotaEnforcement.reserveForBulkCreate(userId, job.items.map((i) => i.id));
      } catch (error) {
        /*
         * Roll the job back. The reservation needs the job-item ids as its
         * source keys, so the rows have to exist before the gate can run —
         * which meant a refused create still left a job in the import list,
         * stuck at "0 / N, waiting" forever: nothing was queued to advance it
         * and nothing was queued to fail it either. The seller saw an
         * "Internal server error" dialog AND a phantom job.
         *
         * Cleanup is best-effort and never masks the refusal: the seller must
         * be told why they were refused even if the tidy-up itself fails.
         */
        await this.listingsService
          .deleteUnstartedJob(userId, job.id)
          .catch((cleanupError: unknown) =>
            this.logger.error(
              `Could not roll back refused job ${job.id}: ${
                cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
              }`,
            ),
          );
        throw error;
      }
    }

    // 3. Enqueue the work. job.items is already deduped/filtered by createJob;
    //    every task carries its job-item id so the worker can consume or
    //    release the quota reservation.
    //
    //    Live creates go out in chunks of 25 (eBay's bulk maximum) so a
    //    2,000-ASIN upload costs ~240 eBay calls instead of ~6,000. Chunking is
    //    purely size-based on a set we already know in full — a 3-ASIN job
    //    ships immediately as a batch of 3, it never waits to fill a chunk.
    //
    //    Drafts go through the same batch and stop before the eBay writes. They
    //    cost no quota either way; sharing the pipeline is what keeps the
    //    duplicate check, Keepa resolution, pricing and content rules identical
    //    between "save for later" and "publish now".
    //
    //    There is no opt-out and no per-item path to fall back to. A per-item
    //    fallback would cost 25x the quota for identical output — the payload
    //    builders are shared, so both paths produced the same listing — which
    //    made it a switch whose only possible effect was to make things worse.
    const opts = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    };

    const jobs = chunkForBulk(job.items).map((chunk) => ({
      name: LISTING_BATCH_JOB,
      data: stampCurrentCorrelation({
        jobId: job.id,
        userId,
        ebayAccountId: request.ebayAccountId,
        listingSettingsGroupId: request.listingSettingsGroupId,
        paymentPolicyId: request.paymentPolicyId,
        shippingPolicyId: request.shippingPolicyId,
        returnPolicyId: request.returnPolicyId,
        asDraft,
        items: chunk.map((item) => ({ asin: item.asin, listingJobItemId: item.id })),
      } as ListingBatchQueueJobData),
      opts,
    }));

    if (jobs.length > 0) {
      await this.listingQueue.addBulk(jobs);
      this.logger.log(
        `Added ${jobs.length} task(s) to listings queue for job ${job.id} ` +
          `(bulk, ${job.items.length} ASINs)`
      );
    }

    // Strip the internal items field before returning the DTO.
    const { items: _items, ...dto } = job;
    void _items;
    return dto;
  }

  /**
   * Hand back the plan slots reserved for ASINs a cancelled job will never list.
   *
   * Fail-soft and per item: `releaseForCreate` is idempotent, and a reservation
   * that fails to release only makes the seller's own quota look fuller than it
   * is — never a reason to fail the cancel the user asked for.
   */
  async releaseCancelledReservations(userId: string, listingJobItemIds: string[]): Promise<void> {
    for (const itemId of listingJobItemIds) {
      try {
        await this.quotaEnforcement.releaseForCreate(userId, itemId);
      } catch (error: unknown) {
        this.logger.warn(
          `Could not release the quota reservation for cancelled item ${itemId}: ` +
            `${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  // Seller-triggered per-item retry was REMOVED (2026-08-09).
  //
  // eBay quota is metered per application and shared by every seller, so a
  // retry button spends a common resource on the attempt least likely to
  // succeed: by the time an item is terminally failed, transient causes have
  // already been retried four times at the HTTP layer (429/5xx) and the aspect
  // self-heal has already re-derived the item specifics. What remains are
  // rejections of the input itself — a wrong category, an invalid identifier, a
  // missing business policy — where the same request produces the same answer.
  //
  // The endpoint, its controller route and the FE action were removed with it;
  // a failed ASIN is simply reported as failed.
}
