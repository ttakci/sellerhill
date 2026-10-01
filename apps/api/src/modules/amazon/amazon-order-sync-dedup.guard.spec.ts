import * as fs from 'fs';
import * as path from 'path';

/**
 * The auto cost-capture queue must never enqueue under a fixed `jobId`.
 *
 * BullMQ silently ignores an add whose jobId is still held by a KEPT job, and
 * `removeOnComplete: 100` keeps completed jobs — so `jobId: acct-<id>` let the
 * first run's completed job block every later tick. On production the queue
 * ran once (2026-09-23) and then never again until 2026-10-01, with no error
 * anywhere. Per-account collapsing goes through `deduplication`, which releases
 * the id when the job finishes.
 */
describe('amazon-order-sync enqueue (guard)', () => {
  const files = ['amazon-order-sync.processor.ts', 'amazon-order-sync.queue.ts'];

  it.each(files)('%s enqueues with deduplication, not a fixed jobId', (file) => {
    const src = fs
      .readFileSync(path.join(__dirname, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    // A literal/template jobId in an add() option; `jobId: job.id` (log
    // context in the worker) is not an enqueue option.
    expect(src).not.toMatch(/jobId\s*:\s*[`'"]/);
    expect(src).toMatch(/deduplication\s*:\s*\{\s*id\s*:\s*`acct-\$\{/);
  });
});
