import * as fs from 'fs';
import * as path from 'path';

/**
 * The seller-facing surface must never carry a provider's raw error text.
 *
 * eBay's own wording ("Input data for tag <BrandMPN> is invalid or missing",
 * "MPN has an invalid value of 021500000529") names internal fields and error
 * ids. To a seller it is noise that looks like a defect in their product; to an
 * engineer it is the whole diagnosis. So the two audiences are split: sellers
 * get the localized `failureCode` message, operators get the raw text in the
 * admin panel.
 *
 * Source-grepped rather than unit-tested because the failure mode is a field
 * quietly reappearing in a DTO mapping — nothing throws, it just leaks.
 */
const LISTINGS_DIR = __dirname;
const SHARED_LISTINGS = path.join(
  __dirname,
  '..','..','..','..','..','packages','shared','src','domain','listings'
);
const WEB_JOB_DETAILS = path.join(
  __dirname,
  '..','..','..','..','..','apps','web','src','features','listings','listing-jobs','details'
);

function read(dir: string, file: string): string {
  return fs.readFileSync(path.join(dir, file), 'utf8');
}

describe('listing failure visibility', () => {
  it('keeps the raw provider message out of the customer DTO', () => {
    const source = read(SHARED_LISTINGS, 'listings.types.ts');
    const start = source.indexOf('export interface ListingJobItemDto');
    expect(start).toBeGreaterThan(-1);
    const dto = source.slice(start, source.indexOf('}', start));

    expect(dto).not.toMatch(/errorMessage/);
    expect(dto).toMatch(/failureCode/);
  });

  it('does not map error_message into the customer job-item DTO', () => {
    const body = read(LISTINGS_DIR, 'listings.service.ts');
    const start = body.indexOf('private mapJobItemToDto(');
    expect(start).toBeGreaterThan(-1);
    const method = body.slice(start, body.indexOf('\n  }', start));

    expect(method).not.toMatch(/errorMessage:/);
  });

  it('still persists the raw message for operators', () => {
    // Hiding it from sellers must not mean discarding it — the admin panel is
    // the only place it can be read, so the write path has to keep filling it.
    expect(read(LISTINGS_DIR, 'listings.service.ts')).toMatch(/error_message/);
  });

  it('exposes the raw message only through the admin surface', () => {
    const admin = read(path.join(__dirname, '..', 'admin'), 'admin-listing-failures.service.ts');
    expect(admin).toMatch(/technicalMessage/);
    expect(admin).toMatch(/error_message/);
  });

  it('renders only the localized reason in the seller job view', () => {
    for (const file of ['ListingJobDetailsPage.container.tsx', 'ListingJobDetailsPage.component.tsx']) {
      expect(read(WEB_JOB_DETAILS, file)).not.toMatch(/item\.errorMessage/);
    }
  });
});

describe('listing retry discipline', () => {
  it('offers no seller-facing retry action', () => {
    // eBay's quota is metered per application and shared by every seller, so a
    // retry button spends a common resource on the attempt least likely to
    // succeed: transient causes were already retried four times at the HTTP
    // layer, and the aspect self-heal already re-derived the item specifics.
    expect(read(WEB_JOB_DETAILS, 'ListingJobDetailsPage.container.tsx')).not.toMatch(/RetryJobItem/);
    // Match the route decorator, not the comment that records the removal.
    expect(read(LISTINGS_DIR, 'listings.controller.ts')).not.toMatch(/@Post\(['"][^'"]*retry/);
    expect(read(LISTINGS_DIR, 'listing-queue.service.ts')).not.toMatch(/async retryJobItem\(/);
  });

  it('lets the worker retry only failures a retry could fix', () => {
    // The classifier already marks input rejections `retryable: false`; the
    // worker used to ignore that and rethrow anyway, re-paying Keepa, the LLM
    // rewrite and the whole publish sequence for a guaranteed second refusal.
    const source = read(LISTINGS_DIR, 'listing-processor.service.ts');
    expect(source).toMatch(/failure\.details\?\.retryable !== false/);
    expect(source).toMatch(/!canRetry \|\| job\.attemptsMade/);
  });

  it('batches every create, drafts included, with no fallback switch', () => {
    // A per-item path would cost 25x the quota for byte-identical output, so
    // there is nothing to toggle. Drafts share the pipeline too — they cost no
    // eBay calls either way, and one pipeline means one set of rules.
    const source = read(LISTINGS_DIR, 'listing-queue.service.ts');
    expect(source).toMatch(/const useBulk = Boolean\(request\.ebayAccountId\)/);
    expect(source).not.toMatch(/EBAY_BULK_ENABLED/);
  });

  it('cancelling a job never touches an ASIN that already published', () => {
    // "What went out, went out": cancelling stops the queue, it does not roll
    // back listings that already cost eBay quota. ACTIVE items are excluded
    // from the close-out, and the seller's plan slots for the stopped ASINs are
    // handed back so they are not counted against a listing that never existed.
    const source = read(LISTINGS_DIR, 'listings.service.ts');
    const start = source.indexOf('async cancelJob(');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf('\n  /**', start));

    expect(body).toMatch(/status NOT IN \(\$4, \$1\)/);
    expect(body).toMatch(/ListingStatus\.ACTIVE/);
    expect(body).toMatch(/ListingJobStatus\.CANCELLED/);
    expect(body).toMatch(/cancelledItemIds/);
  });

  it('keeps a cancelled job cancelled when a late batch reports in', () => {
    // An in-flight batch is allowed to finish, so updateJobCounts still runs
    // after the cancel. It must not recompute the status back to PROCESSING.
    const source = read(LISTINGS_DIR, 'listings.service.ts');
    const start = source.indexOf('private async updateJobCounts(');
    const body = source.slice(start, source.indexOf('\n  /**', start));
    expect(body).toMatch(/CASE WHEN status = \$6 THEN status ELSE \$4 END/);
  });

  it('stops queued work by checking the flag, not by scanning the queue', () => {
    // BullMQ jobs are enqueued without stable ids, so finding them would mean
    // scanning the whole shared queue on every cancel. Both workers re-read the
    // job status instead, which is bounded and cannot miss a job.
    const source = read(LISTINGS_DIR, 'listing-processor.service.ts');
    expect(source.match(/isJobCancelled\(jobId\)/g) ?? []).toHaveLength(2);
  });

  it('never spends an eBay call on a draft', () => {
    // A draft defers the quota to publish; it must not pay it twice. The batch
    // path returns before category resolution and the bulk writes.
    const source = read(LISTINGS_DIR, 'listing-processor.service.ts');
    const draftBranch = source.slice(source.indexOf('if (asDraft) {'), source.indexOf('prepareListingDraft'));
    expect(draftBranch).toMatch(/persistDraft/);
    expect(draftBranch).toMatch(/continue;/);

    const persist = source.slice(source.indexOf('private async persistDraft('));
    const body = persist.slice(0, persist.indexOf('\n  /**'));
    expect(body).not.toMatch(/ebayService|ebayBulkService/);
    expect(body).toMatch(/ebayItemId: null/);
  });
});
