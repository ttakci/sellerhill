/**
 * Shared 429/5xx backoff for eBay REST calls.
 *
 * Extracted so the taxonomy service retries exactly like the listing client
 * does; a second, slightly-different implementation is how one of these paths
 * ends up without backoff (the create path was missing it entirely, so a single
 * transient eBay 500 burned a whole BullMQ attempt for that ASIN).
 */

interface RetryableAxiosError {
  response?: { status?: number; headers?: Record<string, string> };
}

export function isRetryableAxiosError(error: unknown): error is RetryableAxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as RetryableAxiosError).response?.status === 'number'
  );
}

/** Transient failures that are safe to retry after a backoff. */
export function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Parse an HTTP `Retry-After` header into ms (delta-seconds form only). */
export function parseRetryAfterMs(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) {
    return null;
  }
  return Math.max(0, seconds) * 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export interface RetryLogger {
  warn(message: string): void;
}

/**
 * Charges the application's daily eBay quota before a call goes out.
 *
 * Injected as a callback rather than imported so this module stays free of Nest
 * DI and remains unit-testable, and so a caller that has no budget context
 * (a script, a test) simply omits it.
 */
export type BudgetGate = () => Promise<void>;

/**
 * Run `request`, retrying transient eBay failures with `Retry-After`-aware backoff.
 *
 * When `acquireBudget` is supplied it runs before EVERY attempt, not once per
 * call: a retry is a real HTTP request that eBay counts against the daily
 * quota, so charging only the first attempt would let a run of 429s spend four
 * times what the governor recorded.
 */
export async function withEbayRateLimitRetry<T>(
  request: () => Promise<T>,
  options: { maxAttempts?: number; logger?: RetryLogger; acquireBudget?: BudgetGate } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      // Throws EbayBudgetExhaustedError, which is deliberately NOT retryable
      // here — waiting out a daily quota inside an HTTP retry loop would pin a
      // worker for hours. The queue defers the job instead.
      await options.acquireBudget?.();
      return await request();
    } catch (error: unknown) {
      lastError = error;
      if (!isRetryableAxiosError(error) || !isTransientStatus(error.response!.status!)) {
        throw error;
      }
      if (attempt === maxAttempts) {
        break;
      }
      const status = error.response!.status!;
      const retryAfterMs = parseRetryAfterMs(error.response!.headers?.['retry-after']);
      const backoffMs = retryAfterMs ?? 500 * 2 ** (attempt - 1);
      options.logger?.warn(`eBay API ${status} (attempt ${attempt}/${maxAttempts}) — backing off for ${backoffMs}ms`);
      await sleep(backoffMs);
    }
  }

  throw lastError;
}
