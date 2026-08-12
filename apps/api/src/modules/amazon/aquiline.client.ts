// apps/api/src/modules/amazon/aquiline.client.ts
//
// HTTP client for the Aquiline tracking-conversion API (v3).
// Spec: developer.aquiline-tracking.com, read 2026-08-11.
//
//   POST /v3/shipments                  create a conversion  (X-API-Key + Idempotency-Key)
//   GET  /v3/tracking/{trackingNumber}  status + event history
//   POST /v3/webhooks/subscriptions     subscribe            (X-API-Key + X-Partner-Id)
//
// CONTRACT GAP — READ BEFORE TOUCHING `createConversion`
// ------------------------------------------------------
// The published v3 OpenAPI spec models `POST /v3/shipments` as a REAL courier
// booking: it requires `sender`, `recipient`, `parcels[{weightKg, lengthCm,
// widthCm, heightCm}]` and `serviceLevel`, and has NO property anywhere for an
// inbound/source carrier tracking number. That cannot be the call that turns an
// Amazon TBA number into an `AQUAA…YQ` number, which is the product we actually
// buy (Aquiline support, 2026-08: "Aquiline Shipments are used when creating
// new AQUA tracking numbers from the original shipment/tracking information").
// The provider confirms detailed docs are only released after subscribing, and
// offers no sandbox.
//
// So the request body below is a best-effort reading of the documented schema
// plus the source-tracking fields the product must accept, and it is marked
// TODO(confirm) — the same port-isolated treatment `buyer-message.provider.ts`
// gives the eBay Message API. Two properties make that safe rather than
// reckless: the body is built in ONE place (`buildConversionBody`), and every
// failure is typed so `TrackingConversionService` falls back to the local
// pass-through instead of blocking a shipment. Confirm the real shape with the
// provider, fix it here, and nothing else changes.

import { Injectable, Logger } from '@nestjs/common';
import {
  AQUILINE_TRACKING_NUMBER_PATTERN,
  type TrackingProviderStatusDto,
} from '@repo/shared';

/** Recipient address for a conversion, taken from the eBay buyer. */
export interface AquilineAddress {
  name: string;
  phone?: string | null;
  countryCode: string;
  city: string;
  addressLine1: string;
  addressLine2?: string | null;
  postalCode?: string | null;
}

export interface CreateConversionInput {
  /** Our order id — the provider's `externalOrderId` and our idempotency seed. */
  externalOrderId: string;
  /** The Amazon tracking number being converted. */
  sourceTrackingNumber: string;
  /** Amazon's carrier label (e.g. "Amazon Logistics"). */
  sourceCarrier?: string | null;
  recipient: AquilineAddress;
  sender?: AquilineAddress | null;
  /** Aquiline seller profile this conversion is billed to, when assigned. */
  partnerId?: string | null;
}

export interface CreateConversionOutput {
  trackingNumber: string;
  shipmentId: string | null;
  status: string | null;
}

/** Why a provider call failed, so callers can decide without parsing strings. */
export enum AquilineErrorKind {
  /** Not configured (no API key) — feature is off, not broken. */
  NOT_CONFIGURED = 'not_configured',
  /** 401/403 — bad or revoked key. */
  UNAUTHORIZED = 'unauthorized',
  /** 4xx we caused: malformed body, unknown tracking number. */
  BAD_REQUEST = 'bad_request',
  /** Plan quota exhausted. Distinct because the fix is commercial, not technical. */
  QUOTA_EXCEEDED = 'quota_exceeded',
  /** 429/5xx/network/timeout — retryable. */
  TRANSPORT = 'transport',
  /** 2xx whose body we could not use (missing/!AQUA tracking number). */
  MALFORMED_RESPONSE = 'malformed_response',
}

export class AquilineError extends Error {
  constructor(
    readonly kind: AquilineErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AquilineError';
  }
}

export interface AquilineConfig {
  baseUrl: string;
  apiKey: string | null;
  /** Default seller profile when a store has none assigned. */
  partnerId: string | null;
  timeoutMs: number;
}

/** Attempts for a retryable failure. Kept small — a seller is not waiting. */
const MAX_ATTEMPTS = 3;

@Injectable()
export class AquilineClient {
  private readonly logger = new Logger(AquilineClient.name);

  isConfigured(config: AquilineConfig): boolean {
    return Boolean(config.apiKey && config.baseUrl);
  }

  /**
   * Convert a source tracking number into an Aquiline number.
   *
   * The `Idempotency-Key` is derived from OUR order id, not generated per call.
   * That is what makes a retry free: the provider returns the original
   * shipment rather than minting (and billing) a second one. Since conversions
   * are the scarce half of every plan tier, this is a cost control as much as
   * a correctness one.
   */
  async createConversion(
    input: CreateConversionInput,
    config: AquilineConfig,
  ): Promise<CreateConversionOutput> {
    this.assertConfigured(config);

    const body = buildConversionBody(input);
    const headers: Record<string, string> = {
      'Idempotency-Key': conversionIdempotencyKey(input),
    };
    const partnerId = input.partnerId ?? config.partnerId;
    if (partnerId) {
      headers['X-Partner-Id'] = partnerId;
    }

    const json = await this.request<Record<string, unknown>>(
      'POST',
      '/shipments',
      config,
      { body, headers },
    );

    const trackingNumber = typeof json.trackingNumber === 'string' ? json.trackingNumber.trim() : '';
    if (!trackingNumber) {
      throw new AquilineError(
        AquilineErrorKind.MALFORMED_RESPONSE,
        'Conversion response carried no trackingNumber',
      );
    }
    // A number that is not AQUA-shaped means we are talking to the courier
    // product, not the conversion product. Pushing it to eBay under the
    // AQUILINE carrier would give the buyer a number that tracks nothing, so
    // refuse it here and let the caller fall back to the honest pass-through.
    if (!AQUILINE_TRACKING_NUMBER_PATTERN.test(trackingNumber)) {
      throw new AquilineError(
        AquilineErrorKind.MALFORMED_RESPONSE,
        `Conversion returned a non-Aquiline tracking number: ${trackingNumber}`,
      );
    }

    return {
      trackingNumber,
      shipmentId: typeof json.shipmentId === 'string' ? json.shipmentId : null,
      status: typeof json.status === 'string' ? json.status : null,
    };
  }

  /**
   * Current status + event history for a converted number.
   *
   * Only a reconciliation path: webhooks are the primary signal. Each call
   * spends one unit of the plan's "trackings" allowance, so it is used for
   * support tooling and for orders whose webhook never arrived — never on a
   * schedule for every open order.
   */
  async getTracking(
    trackingNumber: string,
    config: AquilineConfig,
  ): Promise<TrackingProviderStatusDto> {
    this.assertConfigured(config);
    return this.request<TrackingProviderStatusDto>(
      'GET',
      `/tracking/${encodeURIComponent(trackingNumber)}`,
      config,
    );
  }

  /**
   * Register our webhook receiver. Idempotent on the provider side by URL, and
   * called at boot, so a redeploy does not accumulate subscriptions.
   */
  async subscribeWebhook(
    input: { webhookUrl: string; events: readonly string[]; secret: string | null },
    config: AquilineConfig,
  ): Promise<{ subscriptionId: string | null }> {
    this.assertConfigured(config);
    if (!config.partnerId) {
      throw new AquilineError(
        AquilineErrorKind.NOT_CONFIGURED,
        'X-Partner-Id is required for webhook subscription management',
      );
    }
    const json = await this.request<Record<string, unknown>>('POST', '/webhooks/subscriptions', config, {
      body: {
        webhookUrl: input.webhookUrl,
        events: [...input.events],
        secret: input.secret,
      },
      headers: { 'X-Partner-Id': config.partnerId },
    });
    return { subscriptionId: typeof json.subscriptionId === 'string' ? json.subscriptionId : null };
  }

  private assertConfigured(config: AquilineConfig): void {
    if (!this.isConfigured(config)) {
      throw new AquilineError(AquilineErrorKind.NOT_CONFIGURED, 'Aquiline API key is not configured');
    }
  }

  /**
   * One HTTP call with bounded retry.
   *
   * Retries 429/5xx/network only. A 4xx is our fault or a quota wall — the
   * same request gets the same answer, and on the conversion path a blind
   * retry risks paying twice.
   */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    config: AquilineConfig,
    options?: { body?: unknown; headers?: Record<string, string> },
  ): Promise<T> {
    const url = `${config.baseUrl.replace(/\/+$/, '')}${path}`;
    let lastError: AquilineError | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'X-API-Key': config.apiKey as string,
            Accept: 'application/json',
            ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
            ...options?.headers,
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
          signal: AbortSignal.timeout(config.timeoutMs),
        });

        if (response.ok) {
          return (await response.json()) as T;
        }

        const detail = await safeText(response);
        const error = classifyHttpFailure(response.status, detail);
        if (error.kind !== AquilineErrorKind.TRANSPORT || attempt === MAX_ATTEMPTS) {
          throw error;
        }
        lastError = error;
      } catch (err) {
        if (err instanceof AquilineError) {
          if (err.kind !== AquilineErrorKind.TRANSPORT || attempt === MAX_ATTEMPTS) {
            throw err;
          }
          lastError = err;
        } else {
          // Network failure / timeout / abort.
          lastError = new AquilineError(
            AquilineErrorKind.TRANSPORT,
            `Aquiline ${method} ${path} failed: ${(err as Error).message}`,
          );
          if (attempt === MAX_ATTEMPTS) {
            throw lastError;
          }
        }
      }

      const backoffMs = 500 * 2 ** (attempt - 1);
      this.logger.warn(
        `Aquiline ${method} ${path} attempt ${attempt}/${MAX_ATTEMPTS} failed (${lastError?.message}) — retrying in ${backoffMs}ms`,
      );
      await sleep(backoffMs);
    }

    throw lastError ?? new AquilineError(AquilineErrorKind.TRANSPORT, 'Aquiline request failed');
  }
}

/**
 * Build the conversion request body.
 *
 * TODO(confirm): the source-tracking fields are unverified — see the contract
 * gap at the top of this file. They are sent under several plausible names
 * because the provider's published schema documents none of them and an
 * unknown property is normally ignored, whereas a missing one fails the
 * conversion. Collapse this to the single real field once the provider
 * confirms it.
 */
export function buildConversionBody(input: CreateConversionInput): Record<string, unknown> {
  return {
    externalOrderId: input.externalOrderId,
    // TODO(confirm) — source tracking, exact property name unknown.
    trackingNumber: input.sourceTrackingNumber,
    sourceTrackingNumber: input.sourceTrackingNumber,
    originalTrackingNumber: input.sourceTrackingNumber,
    carrier: input.sourceCarrier ?? undefined,
    recipient: input.recipient,
    ...(input.sender ? { sender: input.sender } : {}),
  };
}

/**
 * Idempotency key for a conversion.
 *
 * Derived ONLY from the order id and the source tracking number, so a retry
 * produces a byte-identical key and the provider returns the original
 * shipment. It deliberately contains no timestamp or random component — that
 * would defeat the entire mechanism and bill us twice.
 */
export function conversionIdempotencyKey(input: CreateConversionInput): string {
  return `sellerhill-${input.externalOrderId}-${input.sourceTrackingNumber}`;
}

/**
 * Map an HTTP failure onto a typed kind.
 *
 * 429 is TRANSPORT (retry) unless the body names a quota — a plan wall is not
 * something a retry fixes, and treating it as transport would burn the retry
 * budget on every order once the month's allowance runs out.
 */
export function classifyHttpFailure(status: number, detail: string): AquilineError {
  const body = detail.toLowerCase();
  const quotaWorded = /quota|limit reached|exceeded|upgrade your plan|insufficient/.test(body);

  if (status === 401 || status === 403) {
    return new AquilineError(AquilineErrorKind.UNAUTHORIZED, `Aquiline auth failed (${status}): ${detail}`, status);
  }
  if (status === 402 || (status === 429 && quotaWorded) || ((status === 400 || status === 409) && quotaWorded)) {
    return new AquilineError(AquilineErrorKind.QUOTA_EXCEEDED, `Aquiline quota exhausted (${status}): ${detail}`, status);
  }
  if (status === 429 || status >= 500) {
    return new AquilineError(AquilineErrorKind.TRANSPORT, `Aquiline transient failure (${status}): ${detail}`, status);
  }
  return new AquilineError(AquilineErrorKind.BAD_REQUEST, `Aquiline rejected the request (${status}): ${detail}`, status);
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '';
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
