import { Processor, WorkerHost } from '@nestjs/bullmq';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import {
  extractCorrelationId,
  generateCorrelationId,
  KeepaUsageSource,
  ListingFailureCode,
  ListingJobKind,
  ListingStatus,
  type ExistingListingImportQueueData,
  type ListingBatchQueueJobData,
  type ListingCreationData,
  type ListingFailureDetails,
  type ListingQueueJobData,
  type ProductData,
} from '@repo/shared';
import { DelayedError, Job } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';
import { EbayBudgetExhaustedError } from '../../common/ebay-budget/ebay-budget.errors';
import { deferralDelayMs } from '../../common/ebay-budget/ebay-call-budget.helpers';
import { getCorrelation, withCorrelation } from '../../common/observability/correlation.context';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayBulkService, type BulkListingDraft, type BulkListingOutcome } from '../ebay/ebay-bulk.service';
import { EbayService } from '../ebay/ebay.service';

import { summarizeAspectResolution } from './aspect-audit';
import { KeepaUsageService } from './keepa-usage.service';
import { KeepaService } from './keepa.service';
import { classifyListingFailure } from './listing-failure';
import { ListingImportService } from './listing-import.service';
import { ListingStrategyService } from './listing-strategy.service';
import { LISTING_BATCH_JOB } from './listings.constants';
import { ListingsService } from './listings.service';

function listingsWorkerConcurrency(): number {
  const raw = Number(process.env.LISTINGS_WORKER_CONCURRENCY ?? 2);
  if (!Number.isFinite(raw)) {
    return 2;
  }
  return Math.min(16, Math.max(1, Math.floor(raw)));
}

@Processor('listings', { concurrency: listingsWorkerConcurrency() })
export class ListingProcessorService extends WorkerHost {
  private readonly logger = new Logger(ListingProcessorService.name);

  constructor(
    private readonly listingsService: ListingsService,
    private readonly keepaService: KeepaService,
    private readonly keepaUsageService: KeepaUsageService,
    private readonly ebayService: EbayService,
    private readonly ebayBulkService: EbayBulkService,
    private readonly listingStrategyService: ListingStrategyService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => ListingImportService))
    private readonly listingImportService: ListingImportService
  ) {
    super();
  }

  /**
   * Process a listing job task from the queue
   */
  async process(
    job: Job<ListingQueueJobData | ExistingListingImportQueueData>,
    token?: string
  ): Promise<void> {
    return withCorrelation(
      {
        correlationId: extractCorrelationId(job) ?? generateCorrelationId(),
        queueName: 'listings',
        jobId: job.id,
        origin: 'worker',
      },
      async () => {
        if (job.data.kind === ListingJobKind.EXISTING_IMPORT) {
          const data = job.data ;
          try {
            await this.listingImportService.processImport(data);
          } catch (error) {
            const terminal = job.attemptsMade + 1 >= (job.opts.attempts || 1);
            await this.listingImportService.markFailure(
              data,
              error instanceof Error ? error.message : String(error),
              terminal
            );
            if (!terminal) {
              throw error;
            }
          }
          return;
        }
        if (job.name === LISTING_BATCH_JOB) {
          await this.processListingBatch(job as unknown as Job<ListingBatchQueueJobData>, token);
          return;
        }
        await this.processListing(job as Job<ListingQueueJobData>, token);
      }
    );
  }

  /**
   * Create up to 25 listings on one store with three eBay calls.
   *
   * Per-ASIN work that costs us nothing at eBay — the duplicate check, Keepa
   * resolution, pricing, AI content, category and aspect resolution — still
   * runs per item. Only the WRITES are shared, which is where the quota goes.
   *
   * Per-item results are still written to `listing_job_items` individually, so
   * the job UI keeps the same granularity it had when every ASIN was its own
   * BullMQ job.
   */
  private async processListingBatch(job: Job<ListingBatchQueueJobData>, token?: string): Promise<void> {
    const {
      jobId,
      userId,
      ebayAccountId,
      listingSettingsGroupId,
      paymentPolicyId,
      shippingPolicyId,
      returnPolicyId,
      asDraft,
      items,
    } = job.data;

    // Checked before every batch, so a cancel stops the queue within one batch
    // rather than at the end of the job. An in-flight batch is allowed to
    // finish — its eBay calls are already spent, and abandoning them would
    // leave listings on eBay with no row on our side.
    if (await this.listingsService.isJobCancelled(jobId)) {
      this.logger.log(`Job ${jobId} was cancelled; skipping a batch of ${items.length} ASIN(s)`);
      return;
    }

    this.logger.log(
      `Processing batch of ${items.length} ASIN(s) for job ${jobId}${asDraft ? ' (drafts)' : ''}`
    );
    await this.ebayService.assertAccountOwnership(userId, ebayAccountId);

    const policies = { paymentId: paymentPolicyId, shippingId: shippingPolicyId, returnId: returnPolicyId };
    const drafts: BulkListingDraft[] = [];
    const context = new Map<string, { asin: string; productId: string; data: ListingCreationData }>();
    let merchantLocationKey = 'default';
    let accountId = ebayAccountId;

    for (const item of items) {
      try {
        if (await this.listingsService.isAsinListed(userId, item.asin)) {
          await this.recordDuplicate(jobId, userId, item.asin, item.listingJobItemId);
          continue;
        }

        const { productData, productId } = await this.resolveProductData(item.asin, userId);
        const listingData = await this.listingStrategyService.prepareListingData(
          userId,
          productData,
          listingSettingsGroupId,
          ebayAccountId,
          { applyContentAi: true }
        );

        // Drafts may hold a zero-stock ASIN so the seller can prepare it and
        // publish once Amazon restocks; a live publish must never push qty 0.
        if (!asDraft && listingData.quantity === 0) {
          throw new Error(
            `Cannot list ASIN ${item.asin}: Stock is 0. ` +
              `Amazon stock (${productData.stock}) is less than user preferred quantity.`
          );
        }

        if (asDraft) {
          // Stop before every eBay call. Category and item specifics are
          // resolved at publish, so an abandoned draft costs no quota at all.
          await this.persistDraft(job.data, item, productId, listingData);
          continue;
        }

        const prepared = await this.ebayService.prepareListingDraft(
          userId,
          listingData,
          item.asin,
          ebayAccountId
        );
        merchantLocationKey = prepared.merchantLocationKey;
        accountId = prepared.accountId;

        drafts.push({
          key: item.listingJobItemId,
          asin: item.asin,
          sku: prepared.sku,
          data: listingData,
          policies,
          categoryId: prepared.categoryId,
          categoryName: prepared.categoryName,
          categoryAspects: prepared.categoryAspects,
          resolution: prepared.resolution,
        });
        context.set(item.listingJobItemId, { asin: item.asin, productId, data: listingData });
      } catch (error: unknown) {
        // A spent quota is a platform condition, not a defect in this ASIN:
        // park the whole batch rather than failing items that were never tried.
        if (error instanceof EbayBudgetExhaustedError) {
          await this.deferUntilBudgetResets(job, token, error);
          return;
        }
        await this.recordItemFailure(jobId, userId, item.asin, item.listingJobItemId, error);
      }
    }

    if (drafts.length === 0) {
      return;
    }

    // A throw here (transport failure, an unusable account, a spent quota) must
    // not leave prepared items with no status. They would sit at the job-item
    // default forever and the job would never reach a terminal state — which is
    // exactly what happened before this guard existed: two ASINs stuck showing
    // the initial status while the job stayed "processing" for good.
    let outcomes: BulkListingOutcome[];
    try {
      outcomes = await this.ebayBulkService.createListings(accountId, merchantLocationKey, drafts);
    } catch (error: unknown) {
      if (error instanceof EbayBudgetExhaustedError) {
        await this.deferUntilBudgetResets(job, token, error);
        return;
      }
      await this.failPreparedItems(job, jobId, userId, drafts, error);
      return;
    }

    const answered = new Set(outcomes.map((outcome) => outcome.key));
    for (const outcome of outcomes) {
      const prepared = context.get(outcome.key);
      if (!prepared) {
        this.logger.error(
          `Bulk create answered for item ${outcome.key}, which this batch did not send (job ${jobId})`
        );
        continue;
      }

      if (!outcome.ok || !outcome.listingId) {
        // Defence in depth against a phantom listing: an ACTIVE row with no
        // eBay item id does not exist on eBay, can never be matched to an
        // order, and blocks re-listing the ASIN.
        await this.recordItemFailure(
          jobId,
          userId,
          prepared.asin,
          outcome.key,
          new Error(outcome.error ?? 'eBay did not return a listing id for this item.')
        );
        continue;
      }

      const audit = summarizeAspectResolution(outcome.resolution);
      const listingId = await this.listingsService.createListing({
        userId,
        asin: prepared.asin,
        productId: prepared.productId,
        listingSettingsGroupId,
        paymentPolicyId,
        shippingPolicyId,
        returnPolicyId,
        ebayItemId: outcome.listingId,
        title: prepared.data.title,
        price: prepared.data.price,
        purchasePrice: prepared.data.purchasePrice,
        estimatedProfit: prepared.data.estimatedProfit,
        profitMargin: prepared.data.profitMargin,
        roi: prepared.data.roi,
        quantity: prepared.data.quantity,
        ebayCategoryName: outcome.categoryName,
        ebayCategoryId: outcome.categoryId,
        aspectResolution: audit.summary,
        aspectAutofilledCount: audit.autofilledCount,
        ebayAccountId,
        status: ListingStatus.ACTIVE,
      });

      await this.listingsService.updateJobItemResult(jobId, prepared.asin, {
        productId: prepared.productId,
        listingId,
        status: ListingStatus.ACTIVE,
        ebayItemId: outcome.listingId,
      });
      this.quotaEnforcement.consumeForCreate(userId, outcome.key);
    }

    // Every prepared item has to end terminal. An item eBay never answered for
    // is a failure, never a silent skip — the same rule `correlateBulkResponses`
    // applies to a missing response entry.
    const unanswered = drafts.filter((draft) => !answered.has(draft.key));
    if (unanswered.length > 0) {
      await this.failPreparedItems(
        job,
        jobId,
        userId,
        unanswered,
        new Error('eBay returned no result for this item in the bulk response.')
      );
    }

    const created = outcomes.filter((outcome) => outcome.ok).length;
    this.logger.log(`Batch for job ${jobId}: ${created}/${drafts.length} listing(s) published`);
  }

  /**
   * Close out prepared items when the write phase itself failed.
   *
   * Mirrors the per-ASIN contract: RETRYING while BullMQ attempts remain (the
   * reservation stays held so a retry cannot oversell the slot), terminal ERROR
   * on the last one with the reservation released. Rethrows on a non-final
   * attempt so BullMQ actually performs the retry.
   */
  private async failPreparedItems(
    job: Job,
    jobId: string,
    userId: string,
    drafts: BulkListingDraft[],
    error: unknown
  ): Promise<void> {
    const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);
    const failure = classifyListingFailure(error);

    for (const draft of drafts) {
      await this.listingsService.updateJobItemResult(jobId, draft.asin, {
        status: isLastAttempt ? ListingStatus.ERROR : ListingStatus.RETRYING,
        errorMessage: failure.message,
        failureCode: failure.code,
        failureDetails: this.withTrace(failure.details),
      });
      if (isLastAttempt) {
        await this.quotaEnforcement.releaseForCreate(userId, draft.key);
      }
    }

    this.logger.error(
      `Bulk write failed for ${drafts.length} item(s) in job ${jobId}: ` +
        `[${failure.code}] ${failure.message}${isLastAttempt ? '' : ' — will retry'}`
    );

    if (!isLastAttempt) {
      throw error;
    }
  }

  /**
   * Stamp the request trace onto a failure.
   *
   * Surfaced to the seller as a reference code: it is the same correlation id
   * already threaded through HTTP, the queue and the logs, so a support case
   * quoting it can be traced end-to-end instead of reconstructed from a
   * timestamp and an ASIN.
   */
  private withTrace(details: ListingFailureDetails | undefined): ListingFailureDetails {
    return { ...(details ?? {}), correlationId: getCorrelation().correlationId };
  }

  /**
   * Write a DRAFT listing row — the batch path's terminal step for a draft job.
   *
   * No eBay id, no category, no item specifics: all of that is resolved by
   * `publishListing` later, which is what makes a draft free. The quota is paid
   * once, at publish, exactly as it would have been on a direct create — a
   * draft never doubles the cost, it defers it.
   */
  private async persistDraft(
    data: ListingBatchQueueJobData,
    item: { asin: string; listingJobItemId: string },
    productId: string,
    listingData: ListingCreationData
  ): Promise<void> {
    const listingId = await this.listingsService.createListing({
      userId: data.userId,
      asin: item.asin,
      productId,
      listingSettingsGroupId: data.listingSettingsGroupId,
      paymentPolicyId: data.paymentPolicyId,
      shippingPolicyId: data.shippingPolicyId,
      returnPolicyId: data.returnPolicyId,
      ebayItemId: null,
      title: listingData.title,
      price: listingData.price,
      purchasePrice: listingData.purchasePrice,
      estimatedProfit: listingData.estimatedProfit,
      profitMargin: listingData.profitMargin,
      roi: listingData.roi,
      quantity: listingData.quantity,
      ebayCategoryName: listingData.category ?? '',
      aspectAutofilledCount: 0,
      ebayAccountId: data.ebayAccountId,
      status: ListingStatus.DRAFT,
    });

    await this.listingsService.updateJobItemResult(data.jobId, item.asin, {
      productId,
      listingId,
      status: ListingStatus.ACTIVE,
    });
    this.logger.log(`Created draft listing ${listingId} for ASIN ${item.asin}`);
  }

  /** An ASIN the user already has listed or drafted — never a retryable failure. */
  private async recordDuplicate(
    jobId: string,
    userId: string,
    asin: string,
    listingJobItemId: string
  ): Promise<void> {
    this.logger.warn(`ASIN ${asin} is already listed/draft for user ${userId}. Skipping.`);
    await this.listingsService.updateJobItemResult(jobId, asin, {
      status: ListingStatus.ERROR,
      errorMessage: 'DUPLICATE_LISTING: This ASIN is already in your active or draft listings.',
      failureCode: ListingFailureCode.DUPLICATE_LISTING,
      failureDetails: { retryable: false },
    });
    await this.quotaEnforcement.releaseForCreate(userId, listingJobItemId);
  }

  /**
   * Terminal failure for one item in a batch.
   *
   * Always terminal, by design: the other 24 items in this batch succeeded, so
   * re-running the job would re-attempt work that already landed. Transient
   * causes were exhausted before we got here — 429/5xx were retried four times
   * at the HTTP layer and the aspect self-heal already re-derived the item
   * specifics — so what remains is a rejection of this ASIN's own input, which
   * a further attempt cannot change.
   */
  private async recordItemFailure(
    jobId: string,
    userId: string,
    asin: string,
    listingJobItemId: string,
    error: unknown
  ): Promise<void> {
    const failure = classifyListingFailure(error);
    this.logger.error(`Batch item ${asin} failed in job ${jobId}: [${failure.code}] ${failure.message}`);

    await this.listingsService.updateJobItemResult(jobId, asin, {
      status: ListingStatus.ERROR,
      errorMessage: failure.message,
      failureCode: failure.code,
      failureDetails: this.withTrace(failure.details),
    });
    await this.quotaEnforcement.releaseForCreate(userId, listingJobItemId);
  }

  /**
   * Park a job until the platform's shared eBay quota resets.
   *
   * `moveToDelayed` is used rather than rethrowing so BullMQ does NOT count
   * this as a failed attempt: the listing is untried, and burning its three
   * retries against a quota that only refills at UTC midnight would turn a
   * temporary platform-wide condition into a permanent per-listing failure.
   */
  private async deferUntilBudgetResets(
    job: Job,
    token: string | undefined,
    error: EbayBudgetExhaustedError
  ): Promise<void> {
    const delay = deferralDelayMs(error.resetAt, new Date());
    this.logger.warn(
      `Deferring job ${job.id} for ${Math.round(delay / 60_000)} min — ${error.message}`
    );

    if (!token) {
      // No worker token means the job cannot be re-parked; rethrowing at least
      // gets it a BullMQ retry rather than silently dropping the listing.
      throw error;
    }

    await job.moveToDelayed(Date.now() + delay, token);
    throw new DelayedError();
  }

  private async processListing(job: Job<ListingQueueJobData>, token?: string): Promise<void> {
    const {
      jobId,
      userId,
      asin,
      ebayAccountId,
      listingSettingsGroupId,
      paymentPolicyId,
      shippingPolicyId,
      returnPolicyId,
      asDraft = false,
      listingJobItemId,
    } = job.data;

    if (await this.listingsService.isJobCancelled(jobId)) {
      this.logger.log(`Job ${jobId} was cancelled; skipping ASIN ${asin}`);
      return;
    }

    this.logger.log(`Processing ASIN ${asin} for job ${jobId}${asDraft ? ' (draft)' : ''}`);

    // 0. Check if ASIN is already active or draft for this user
    const isAlreadyListed = await this.listingsService.isAsinListed(userId, asin);
    if (isAlreadyListed) {
      this.logger.warn(`ASIN ${asin} is already listed/draft for user ${userId}. Skipping.`);
      await this.listingsService.updateJobItemResult(jobId, asin, {
        status: ListingStatus.ERROR,
        errorMessage: 'DUPLICATE_LISTING: This ASIN is already in your active or draft listings.',
        failureCode: ListingFailureCode.DUPLICATE_LISTING,
        failureDetails: { retryable: false },
      });
      // A duplicate never created a listing — release the reservation so the
      // held slot is freed for the next create. (Non-draft path only; drafts
      // never reserved.)
      if (!asDraft && listingJobItemId) {
        await this.quotaEnforcement.releaseForCreate(userId, listingJobItemId);
      }
      return;
    }

    try {
      // 1. Resolve product data — cached, or one Keepa fetch guarded by a
      //    per-ASIN advisory lock so concurrent creates of the same uncached
      //    ASIN (bulk uploads, multi-tenant) make exactly ONE provider call.
      const { productData, productId } = await this.resolveProductData(asin, userId);

      // 3. Prepare listing data (Price, stock, etc. based on strategy group)
      await this.ebayService.assertAccountOwnership(userId, ebayAccountId);
      // applyContentAi: create path only (shared LLM when group flags + LLM_CONTENT_ENABLED)
      const listingData = await this.listingStrategyService.prepareListingData(
        userId,
        productData,
        listingSettingsGroupId,
        ebayAccountId,
        { applyContentAi: true }
      );

      // Drafts: allow zero stock so users can prepare OOS ASINs and publish later.
      // Live publish: block zero stock so we never push qty 0 to eBay on create.
      if (!asDraft && listingData.quantity === 0) {
        throw new Error(
          `Cannot list ASIN ${asin}: Stock is 0. ` +
            `Amazon stock (${productData.stock}) is less than user preferred quantity. ` +
            `Please adjust your listing settings group stock preferences, wait for Amazon to restock, or save as draft.`
        );
      }

      let ebayItemId: string | undefined;
      let categoryName = productData.category ?? '';
      let ebayCategoryId: string | undefined;
      let aspectAudit: { summary: Record<string, unknown>; autofilledCount: number } | undefined;

      if (!asDraft) {
        // 4. Create eBay listing (REST API)
        const created = await this.ebayService.createListingWithRest(
          userId,
          productId,
          listingData,
          {
            paymentId: paymentPolicyId,
            shippingId: shippingPolicyId,
            returnId: returnPolicyId,
          },
          asin,
          ebayAccountId
        );
        ebayItemId = created.listingId;
        categoryName = created.categoryName;
        ebayCategoryId = created.categoryId;
        aspectAudit = summarizeAspectResolution(created.aspectResolution);

        // Defence in depth against a phantom listing: an ACTIVE row whose
        // `ebay_item_id` is empty does not exist on eBay, can never be matched
        // to an order (order sync keys on this column), and blocks re-listing
        // the ASIN as a duplicate.
        if (!ebayItemId) {
          throw new Error(`eBay did not return a listing id for ASIN ${asin}; refusing to record the listing.`);
        }
      }

      // 5. Create listing record (ACTIVE with eBay id, or DRAFT without)
      const listingId = await this.listingsService.createListing({
        userId,
        asin,
        productId,
        listingSettingsGroupId,
        paymentPolicyId,
        shippingPolicyId,
        returnPolicyId,
        ebayItemId: ebayItemId ?? null,
        title: listingData.title,
        price: listingData.price,
        purchasePrice: listingData.purchasePrice,
        estimatedProfit: listingData.estimatedProfit,
        profitMargin: listingData.profitMargin,
        roi: listingData.roi,
        quantity: listingData.quantity,
        ebayCategoryName: categoryName,
        ebayCategoryId,
        aspectResolution: aspectAudit?.summary ?? null,
        aspectAutofilledCount: aspectAudit?.autofilledCount ?? 0,
        ebayAccountId: ebayAccountId || undefined,
        status: asDraft ? ListingStatus.DRAFT : ListingStatus.ACTIVE,
      });

      // 6. Update job item success (job-item ACTIVE = processed successfully)
      await this.listingsService.updateJobItemResult(jobId, asin, {
        productId,
        listingId,
        status: ListingStatus.ACTIVE,
        ebayItemId,
      });

      // 7. Consume the billing-quota reservation for this job-item (non-draft
      //    creates only — drafts never reserved). Fail-soft + idempotent.
      if (!asDraft && listingJobItemId) {
        this.quotaEnforcement.consumeForCreate(userId, listingJobItemId);
      }

      this.logger.log(
        asDraft
          ? `Successfully created draft listing ${listingId} for ASIN ${asin}`
          : `Successfully created eBay listing ${ebayItemId} for ASIN ${asin}`
      );
    } catch (error: unknown) {
      // Budget exhaustion is not a failure of this listing — the platform's
      // shared daily eBay quota is spent. Park the job until it resets, keep
      // the billing reservation held (the work is still coming), and leave the
      // item in RETRYING so the UI reports "waiting", not "failed".
      if (error instanceof EbayBudgetExhaustedError) {
        await this.listingsService.updateJobItemResult(jobId, asin, {
          status: ListingStatus.RETRYING,
          errorMessage: error.message,
          failureCode: ListingFailureCode.PROVIDER_BUDGET_EXHAUSTED,
          failureDetails: { retryable: true },
        });
        await this.deferUntilBudgetResets(job, token, error);
        return;
      }

      // One classifier owns every failure shape (ours, eBay's, transport), so
      // the UI can show an actionable reason instead of a raw eBay string.
      const failure = classifyListingFailure(error);

      // Honour the classifier's own verdict instead of retrying blindly.
      //
      // By the time we are here, transient causes have already been retried
      // four times at the HTTP layer (429/5xx, `Retry-After`-aware) and the
      // aspect self-heal has already re-derived the item specifics. What is
      // left is usually a rejection of the INPUT — wrong category, invalid
      // identifier, missing business policy — where the same request produces
      // the same answer. Re-running the job then re-pays Keepa, the LLM content
      // rewrite and the whole publish sequence for a guaranteed second refusal;
      // a permanently broken ASIN could burn ~27 eBay calls before giving up.
      const canRetry = failure.details?.retryable !== false;
      const isLastAttempt = !canRetry || job.attemptsMade + 1 >= (job.opts.attempts || 1);

      this.logger.error(
        `Error processing ASIN ${asin} in job ${jobId}: [${failure.code}] ${failure.message} ` +
          `(Attempt ${job.attemptsMade + 1}${canRetry ? '' : ', not retryable'})`
      );

      await this.listingsService.updateJobItemResult(jobId, asin, {
        status: isLastAttempt ? ListingStatus.ERROR : ListingStatus.RETRYING,
        errorMessage: failure.message,
        failureCode: failure.code,
        failureDetails: this.withTrace(failure.details),
      });

      // Billing-quota release: only on PERMANENT failure (terminal ERROR). On
      // intermediate RETRYING the reservation stays held so a BullMQ retry
      // doesn't oversell the slot. Drafts never reserved.
      if (!asDraft && listingJobItemId && isLastAttempt) {
        await this.quotaEnforcement.releaseForCreate(userId, listingJobItemId);
      }

      if (!isLastAttempt) {
        throw error; // Rethrow to trigger BullMQ retry
      }
    }
  }

  /**
   * Cached-or-fetch product resolution for the create path.
   *
   * - Cache hit (valid title + images): 0 Keepa tokens; the product is already
   *   on the stale-driven refresh schedule. Re-listing never blocks on Keepa.
   * - Cache miss: pg advisory lock keyed on the ASIN serializes concurrent
   *   creates; after acquiring the lock the cache is re-checked, so N parallel
   *   jobs for one uncached ASIN produce exactly one Keepa call.
   * - Usage + balance are recorded from the response meta BEFORE product
   *   validation — tokens Keepa charged for an empty/invalid response are real
   *   spend and must not vanish from accounting.
   */
  async resolveProductData(
    asin: string,
    userId: string
  ): Promise<{ productData: ProductData; productId: string }> {
    const cached = this.asUsableCache(await this.listingsService.getProductByAsin(asin));
    if (cached) {
      this.logger.log(`Using cached product data for ASIN ${asin} (no Keepa call)`);
      return cached;
    }

    // Advisory lock scope: this transaction/connection only. hashtext() maps
    // the ASIN into the bigint keyspace; collisions merely over-serialize.
    return this.databaseService.transaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('keepa-create'), hashtext($1))`, [asin]);

      // Another worker may have fetched + cached while we waited on the lock.
      const cachedAfterLock = this.asUsableCache(await this.listingsService.getProductByAsin(asin));
      if (cachedAfterLock) {
        this.logger.log(`ASIN ${asin} was cached by a concurrent create while waiting on lock (no Keepa call)`);
        return cachedAfterLock;
      }

      this.logger.log(`Fetching product data for ASIN ${asin} from Keepa`);
      const { product: keepaProduct, meta } = await this.keepaService.getProductDetailsWithMeta(asin);

      // Record real token spend + balance snapshot regardless of data quality.
      await this.keepaUsageService.logUsage({
        asin,
        tokens: meta.tokensConsumed,
        source: KeepaUsageSource.CREATE,
        userIds: [userId],
      });
      await this.keepaUsageService.captureBalance(meta);

      if (!keepaProduct) {
        throw new Error(
          `Keepa returned no product for ASIN ${asin}. The ASIN may be invalid or Amazon is blocking the request.`
        );
      }
      if (!keepaProduct.title || keepaProduct.title === 'Unknown Product') {
        throw new Error(`Keepa could not resolve a valid title for ASIN ${asin}.`);
      }

      keepaProduct.rawKeepaData = keepaProduct.raw;
      this.logger.log(
        `Keepa data received: price=${keepaProduct.price.current} USD, stock=${keepaProduct.stock ?? 0}`
      );

      const productId = await this.listingsService.findOrCreateProduct(asin, keepaProduct);
      return { productData: keepaProduct, productId };
    });
  }

  async prepareImportedListingData(
    userId: string,
    productData: ProductData,
    listingSettingsGroupId: string,
    ebayAccountId: string
  ) {
    return this.listingStrategyService.prepareListingData(
      userId,
      productData,
      listingSettingsGroupId,
      ebayAccountId
    );
  }

  /** A cached product row is reusable when it has a real title and ≥1 image. */
  private asUsableCache(
    existing: { id: string; data: ProductData } | null
  ): { productData: ProductData; productId: string } | null {
    if (
      existing &&
      existing.data.title &&
      existing.data.title !== 'Unknown Product' &&
      existing.data.imageUrls?.length > 0
    ) {
      return { productData: existing.data, productId: existing.id };
    }
    return null;
  }
}
