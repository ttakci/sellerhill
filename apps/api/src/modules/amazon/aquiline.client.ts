// apps/api/src/modules/amazon/aquiline.client.ts
//
// HTTP client for the Aquiline tracking-conversion API.
//
// REWRITTEN 2026-08-24. Everything that lived here before targeted the WRONG
// API — the v3 "partner" surface, which books couriers (`sender`/`recipient`/
// `parcels[{weightKg,...}]`) and has no concept of converting an inbound
// Amazon tracking number at all. Aquiline support confirmed the real surface
// is their subscriber-only **Integration API**. Nothing about the old
// endpoints, auth scheme or request shapes survives; only the bounded-retry
// discipline and the typed-error idea were worth keeping.
//
// GROUND TRUTH (verified live against the provider on 2026-08-23 — trust this
// over anything the deleted v3 client implied):
//   Base URL   https://aquiline-tracking.com/app/api/integration
//   Auth       Authorization: Bearer {tokenId}.{tokenSecret} — ONE opaque
//              string; the token is never split into two config fields.
//   Errors     {"success": false, "code": "not-found", "message": "..."} —
//              there IS a machine-readable `code`. The deleted client grepped
//              the free-text message for /quota|limit reached|exceeded/, which
//              would call ANY message merely containing those words a plan
//              wall and silently stop every later conversion — never do that
//              again. See `classifyAquilineFailure`.
//   GET /v1/me {success, uid, subscriptionActive, billing: {
//                subscription: {planCode, cadence, status, currentPeriodStart,
//                  currentPeriodEnd, pendingPlanCode, pendingCadence},
//                usage: {windowKey, used, limit, remaining},
//                plan: {code, label, trackLimitPerMonth}}}
//   assign     {success, aquiline, chargedCents, planLimit, planUsed,
//                planRemaining}. Support says a repeat assign also returns
//                `reused: true`, but that field is in NO published schema —
//                read it defensively (`json.reused === true`), never require
//                it.
//
// Everything below the four confirmed shapes above (profile/webhook response
// envelopes, the upsert/tracking-html response bodies) is a best-effort
// reading of the published OpenAPI document and `aquiline-probe.ts`'s route
// map, not a live-observed shape — the provider has no sandbox, so this is
// the same port-isolated, TODO(confirm)-marked treatment
// `buyer-message.provider.ts` gives the eBay Message API. Every failure here
// is typed so `TrackingConversionService` (a later task) can fall back to the
// local pass-through instead of blocking a shipment on a wrong guess.
//
// Routes (from `docs/superpowers/specs/2026-08-23-aquiline-integration-api-
// design.md` §3.1 and `pnpm --filter api aquiline:probe`):
//   GET    /v1/me
//   GET    /v1/profiles
//   GET    /v1/profiles/{profileId}
//   POST   /v1/profiles
//   PATCH  /v1/profiles/{profileId}
//   POST   /v1/profiles/{profileId}/orders/upsert
//   POST   /v1/profiles/{profileId}/orders/{orderId}/tracking-html
//   POST   /v1/profiles/{profileId}/orders/{orderId}/assign
//   GET    /v1/profiles/{profileId}/orders/{orderId}
//   GET    /v1/webhooks
//   POST   /v1/webhooks
//
// Deliberately NOT ported:
//   - `getTracking` (`GET /v3/tracking/{n}`) — that route does not exist on
//     the Integration API. It was the only consumer of the deprecated
//     `TrackingProviderStatusDto` alias; no replacement is added here.
//   - `subscribeWebhook` in its v3 form — webhook management on the
//     Integration API is `listWebhooks`/`createWebhook` below, a different
//     body shape. The webhook RECEIVER (verifying `X-Webhook-Signature`,
//     applying `tracking.*` events) is a later task, not this one.
//   - `createConversion`/`buildConversionBody`/`conversionIdempotencyKey` —
//     there is no single "convert" call on this API. A conversion is the
//     orchestrated sequence `upsertOrders` → `uploadTrackingHtml` → `assign`,
//     which belongs to the service layer (a later task), not this port.

import { Injectable, Logger } from '@nestjs/common';
import {
  AQUILINE_TRACKING_NUMBER_PATTERN,
  AquilineAccountOrigin,
  AquilineHtmlOutcome,
  type AquilineAssignResult,
  type AquilineMarketplaceOrder,
  type AquilinePlanUsage,
  type AquilineStoreAddress,
  type AquilineWebhookEvent,
} from '@repo/shared';

// ============================================================================
// Config + errors
// ============================================================================

export interface AquilineConfig {
  baseUrl: string;
  /** The whole `{tokenId}.{tokenSecret}` string. Null when not configured. */
  token: string | null;
  /** Deterministic profile-id prefix (`sh` / `sh-dev` / `sh-test`) — carried
   *  here for the profile-service layer; this client never reads it itself. */
  profilePrefix: string;
  /** Plan's profile ceiling (10 on Starter) — same note as `profilePrefix`. */
  maxProfiles: number;
  timeoutMs: number;
}

/** Why a provider call failed, so callers can decide without parsing strings. */
export enum AquilineErrorKind {
  /** Not configured (no token) — feature is off, not broken. */
  NOT_CONFIGURED = 'not_configured',
  /** 401/403 — bad or revoked token. */
  UNAUTHORIZED = 'unauthorized',
  /** 404 — profile/order/webhook does not exist. */
  NOT_FOUND = 'not_found',
  /** 4xx we caused: malformed body, validation failure. */
  BAD_REQUEST = 'bad_request',
  /** 402 — plan quota exhausted. Distinct because the fix is commercial. */
  QUOTA_EXCEEDED = 'quota_exceeded',
  /** The plan's non-deletable profile ceiling. Never returned by the
   *  provider itself — reserved for the profile-service layer's own local
   *  ceiling guard (a later task), kept here because it is part of the same
   *  vocabulary every caller switches on. */
  PROFILE_CEILING = 'profile_ceiling',
  /** 413 — an uploaded tracking-HTML payload was too large. */
  PAYLOAD_TOO_LARGE = 'payload_too_large',
  /** 429/5xx/network/timeout — retryable. */
  TRANSPORT = 'transport',
  /** 2xx whose body we could not use (e.g. a non-AQUA tracking number). */
  MALFORMED_RESPONSE = 'malformed_response',
}

export class AquilineError extends Error {
  constructor(
    readonly kind: AquilineErrorKind,
    message: string,
    readonly status?: number,
    readonly code?: string | null,
  ) {
    super(message);
    this.name = 'AquilineError';
  }
}

interface AquilineErrorBody {
  success?: boolean;
  code?: string;
  message?: string;
}

/**
 * Classify a failure from the response's own `code`, falling back to status.
 *
 * The deleted v3 client grepped the message for /quota|limit reached|exceeded/,
 * which mistakes any message merely containing those words for a plan wall —
 * and a false quota verdict silently stops every later conversion. A probe on
 * 2026-08-23 confirmed the provider does send a machine-readable `code`, so
 * that guesswork is gone: status decides the KIND, `code` rides along for
 * logging/diagnostics.
 */
export function classifyAquilineFailure(status: number, body: unknown): AquilineError {
  const parsed = (typeof body === 'object' && body !== null ? body : {}) as AquilineErrorBody;
  const code = typeof parsed.code === 'string' ? parsed.code : null;
  const message = parsed.message ?? `HTTP ${status}`;

  if (status === 401 || status === 403) {
    return new AquilineError(AquilineErrorKind.UNAUTHORIZED, message, status, code);
  }
  if (status === 402) {
    return new AquilineError(AquilineErrorKind.QUOTA_EXCEEDED, message, status, code);
  }
  if (status === 404) {
    return new AquilineError(AquilineErrorKind.NOT_FOUND, message, status, code);
  }
  if (status === 413) {
    return new AquilineError(AquilineErrorKind.PAYLOAD_TOO_LARGE, message, status, code);
  }
  if (status === 429 || status >= 500) {
    return new AquilineError(AquilineErrorKind.TRANSPORT, message, status, code);
  }
  return new AquilineError(AquilineErrorKind.BAD_REQUEST, message, status, code);
}

// ============================================================================
// Wire shapes
//
// Everything in this block below `AquilineMeResult` is a best-effort reading
// (see the file header) and is marked TODO(confirm) where the field is not
// independently confirmed. `AquilineMeResult` and the `assign` response are
// the two shapes actually observed live.
// ============================================================================

/** `GET /v1/me`. Observed live 2026-08-23 — trust this over the design doc's
 *  earlier sketch of the same endpoint. */
export interface AquilineMeResult {
  success: boolean;
  uid: string | null;
  subscriptionActive: boolean;
  billing: {
    subscription: {
      planCode: string | null;
      cadence: string | null;
      status: string | null;
      currentPeriodStart: string | null;
      currentPeriodEnd: string | null;
      pendingPlanCode: string | null;
      pendingCadence: string | null;
    };
    usage: {
      windowKey: string | null;
      used: number | null;
      limit: number | null;
      remaining: number | null;
    };
    plan: {
      code: string | null;
      label: string | null;
      trackLimitPerMonth: number | null;
    };
  };
}

/** Project the `GET /v1/me` billing block onto the shared `AquilinePlanUsage`
 *  shape, so callers (the profile-service layer) get the normalized tuple
 *  that type exists for instead of re-deriving it from the raw response. */
export function extractPlanUsage(me: AquilineMeResult): AquilinePlanUsage {
  return {
    planCode: me.billing.subscription.planCode,
    windowKey: me.billing.usage.windowKey,
    used: me.billing.usage.used,
    limit: me.billing.usage.limit,
    remaining: me.billing.usage.remaining,
  };
}

/**
 * `POST /v1/profiles` body / `PATCH /v1/profiles/{id}` body / profile
 * response shape. TODO(confirm): the response envelope beyond these fields —
 * the published spec documents the request; the provider has no sandbox to
 * observe a live response against.
 */
export interface AquilineProfileInput {
  accountOrigin: AquilineAccountOrigin;
  /** Client-chosen (spec: "Optional client-chosen id; server generates one if
   *  omitted"). SellerHill always supplies one — see the profile-service
   *  layer's deterministic `{prefix}-{userId}-{marketplace}` id. */
  profileId: string;
  label: string;
  marketplaceHost: string;
  amazonAccountEmail?: string;
  storeAddress?: AquilineStoreAddress;
}

/** A profile as returned by list/get/create/patch. `profileId` is immutable
 *  once created, so `patchProfile` never sends it in the body. */
export interface AquilineProfile extends AquilineProfileInput {
  createdAt?: string | null;
}

export type AquilineProfilePatch = Partial<Omit<AquilineProfileInput, 'profileId'>>;

export interface AquilineProfileListResult {
  items: AquilineProfile[];
}

/** TODO(confirm): exact response shape. `suggestAmazonEmailFetch` is
 *  documented as appearing on this response but is explicitly ignored per
 *  `docs/aquiline-open-questions.md` Q6 — we have no seller Amazon mailbox
 *  access to act on it. */
export interface AquilineOrderUpsertResult {
  success: boolean;
  suggestAmazonEmailFetch?: boolean;
}

export interface AquilineTrackingHtmlInput {
  trackingUrl: string;
  html: string;
  /** Undocumented optional field accepted by both `tracking-html` and
   *  `assign` (`docs/aquiline-open-questions.md` Q5) — passed through when
   *  the caller has one, never required. */
  amazonCustomerId?: string;
}

/**
 * TODO(confirm): `outcome`/`trackingUpdateStatus` field names. The design
 * doc's own reading of the spec: "`uploadTrackingHtml` may answer
 * `outcome: accepted` with `trackingUpdateStatus: processing`" — and warns
 * "never treat success alone as applied". `outcome` is parsed defensively
 * against the known `AquilineHtmlOutcome` values; anything else is `null`
 * rather than cast, matching `isAquilineProblemCode`'s narrowing discipline.
 */
export interface AquilineTrackingHtmlResult {
  success: boolean;
  outcome: AquilineHtmlOutcome | null;
  trackingUpdateStatus: string | null;
  suggestAmazonEmailFetch?: boolean;
}

/**
 * Amazon assign body. Follows the schema's own Amazon example — `retailer` +
 * `marketplaceHost` + `sourceTracking`, no `carrier` (`carrier` is documented
 * as "required for non-Amazon assign", and Aquiline support's reply showing
 * `carrier: "Amazon"` is NOT followed here — the machine-readable schema
 * wins, since sending `carrier` on an Amazon assign risks `assign_validation`
 * against a field documented as non-Amazon-only).
 */
export interface AquilineAssignBody {
  trackingUrl: string;
  retailer?: string;
  marketplaceHost?: string;
  sourceTracking?: string;
  /** Non-Amazon assigns only (AliExpress/Walmart carrier code). Present in
   *  the type for completeness; the Amazon path never sets it. */
  carrier?: string;
  amazonCustomerId?: string;
}

export interface AquilineWebhook {
  id: string;
  url: string;
  events: string[];
}

export interface AquilineWebhookListResult {
  items: AquilineWebhook[];
}

export interface AquilineWebhookCreateInput {
  url: string;
  events: readonly AquilineWebhookEvent[];
}

/** The secret is returned ONCE at creation (per `aquiline-probe.ts`'s own
 *  operator note) — there is no way to read it back later. */
export interface AquilineWebhookCreateResult extends AquilineWebhook {
  secret: string | null;
}

// ============================================================================
// Client
// ============================================================================

/** Attempts for a retryable failure. Kept small — a seller is not waiting. */
const MAX_ATTEMPTS = 3;

type AquilineHttpMethod = 'GET' | 'POST' | 'PATCH';

@Injectable()
export class AquilineClient {
  private readonly logger = new Logger(AquilineClient.name);

  isConfigured(config: AquilineConfig): boolean {
    return Boolean(config.token && config.baseUrl);
  }

  async getMe(config: AquilineConfig): Promise<AquilineMeResult> {
    return this.request<AquilineMeResult>('GET', '/v1/me', config);
  }

  async listProfiles(config: AquilineConfig): Promise<AquilineProfileListResult> {
    return this.request<AquilineProfileListResult>('GET', '/v1/profiles', config);
  }

  async getProfile(profileId: string, config: AquilineConfig): Promise<AquilineProfile> {
    return this.request<AquilineProfile>(
      'GET',
      `/v1/profiles/${encodeURIComponent(profileId)}`,
      config,
    );
  }

  async createProfile(
    input: AquilineProfileInput,
    config: AquilineConfig,
  ): Promise<AquilineProfile> {
    return this.request<AquilineProfile>('POST', '/v1/profiles', config, { body: input });
  }

  async patchProfile(
    profileId: string,
    patch: AquilineProfilePatch,
    config: AquilineConfig,
  ): Promise<AquilineProfile> {
    return this.request<AquilineProfile>(
      'PATCH',
      `/v1/profiles/${encodeURIComponent(profileId)}`,
      config,
      { body: patch },
    );
  }

  async upsertOrders(
    profileId: string,
    orders: readonly AquilineMarketplaceOrder[],
    config: AquilineConfig,
  ): Promise<AquilineOrderUpsertResult> {
    return this.request<AquilineOrderUpsertResult>(
      'POST',
      `/v1/profiles/${encodeURIComponent(profileId)}/orders/upsert`,
      config,
      { body: { orders: [...orders] } },
    );
  }

  async uploadTrackingHtml(
    profileId: string,
    orderId: string,
    input: AquilineTrackingHtmlInput,
    config: AquilineConfig,
  ): Promise<AquilineTrackingHtmlResult> {
    const json = await this.request<Record<string, unknown>>(
      'POST',
      `/v1/profiles/${encodeURIComponent(profileId)}/orders/${encodeURIComponent(orderId)}/tracking-html`,
      config,
      { body: input },
    );
    return parseTrackingHtmlResult(json);
  }

  /**
   * Amazon assign. Rejects a tracking number that does not match
   * `AQUILINE_TRACKING_NUMBER_PATTERN` as `MALFORMED_RESPONSE` rather than
   * handing the caller a number that is not actually an AQUA number — see
   * the pattern's own doc comment in `@repo/shared` for why that failure mode
   * is preferred over a stricter/looser regex.
   */
  async assign(
    profileId: string,
    orderId: string,
    input: AquilineAssignBody,
    config: AquilineConfig,
  ): Promise<AquilineAssignResult> {
    const json = await this.request<Record<string, unknown>>(
      'POST',
      `/v1/profiles/${encodeURIComponent(profileId)}/orders/${encodeURIComponent(orderId)}/assign`,
      config,
      { body: input },
    );
    return parseAssignResult(json);
  }

  async getOrder(
    profileId: string,
    orderId: string,
    config: AquilineConfig,
  ): Promise<AquilineMarketplaceOrder> {
    return this.request<AquilineMarketplaceOrder>(
      'GET',
      `/v1/profiles/${encodeURIComponent(profileId)}/orders/${encodeURIComponent(orderId)}`,
      config,
    );
  }

  async listWebhooks(config: AquilineConfig): Promise<AquilineWebhookListResult> {
    return this.request<AquilineWebhookListResult>('GET', '/v1/webhooks', config);
  }

  async createWebhook(
    input: AquilineWebhookCreateInput,
    config: AquilineConfig,
  ): Promise<AquilineWebhookCreateResult> {
    return this.request<AquilineWebhookCreateResult>('POST', '/v1/webhooks', config, {
      body: { url: input.url, events: [...input.events] },
    });
  }

  /**
   * One HTTP call with bounded retry.
   *
   * Retries 429/5xx/network only. A 4xx is our fault or a quota wall — the
   * same request gets the same answer, and on the conversion path a blind
   * retry risks paying twice.
   */
  private async request<T>(
    method: AquilineHttpMethod,
    path: string,
    config: AquilineConfig,
    options?: { body?: unknown },
  ): Promise<T> {
    if (!this.isConfigured(config)) {
      throw new AquilineError(AquilineErrorKind.NOT_CONFIGURED, 'Aquiline token is not configured');
    }

    const url = `${config.baseUrl.replace(/\/+$/, '')}${path}`;
    let lastError: AquilineError | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${config.token as string}`,
            Accept: 'application/json',
            ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: AbortSignal.timeout(config.timeoutMs),
        });

        const raw = await safeText(response);
        const parsedBody = parseJsonBody(raw);

        if (response.ok) {
          return (parsedBody ?? {}) as T;
        }

        const error = classifyAquilineFailure(response.status, parsedBody);
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
 * Parse the `assign` response. Ground truth (verified live 2026-08-23):
 * `{success, aquiline, chargedCents, planLimit, planUsed, planRemaining}`.
 *
 * `reused` is read defensively — support reports it appears on a repeat
 * assign, but it is in NO published schema, so it must never be required.
 *
 * A tracking number that does not match `AQUILINE_TRACKING_NUMBER_PATTERN`
 * means we are looking at the wrong product (or a malformed response) and is
 * rejected as `MALFORMED_RESPONSE` rather than handed to a caller who would
 * push it to eBay under the AQUILINE carrier as a number that tracks nothing.
 */
export function parseAssignResult(json: Record<string, unknown>): AquilineAssignResult {
  const aquiline = typeof json.aquiline === 'string' ? json.aquiline.trim() : '';
  if (!aquiline || !AQUILINE_TRACKING_NUMBER_PATTERN.test(aquiline)) {
    throw new AquilineError(
      AquilineErrorKind.MALFORMED_RESPONSE,
      `Assign response carried a non-Aquiline tracking number: ${aquiline || '(empty)'}`,
    );
  }
  return {
    aquiline,
    chargedCents: typeof json.chargedCents === 'number' ? json.chargedCents : null,
    planLimit: typeof json.planLimit === 'number' ? json.planLimit : null,
    planUsed: typeof json.planUsed === 'number' ? json.planUsed : null,
    planRemaining: typeof json.planRemaining === 'number' ? json.planRemaining : null,
    reused: json.reused === true,
  };
}

function parseTrackingHtmlResult(json: Record<string, unknown>): AquilineTrackingHtmlResult {
  const rawOutcome = json.outcome;
  const outcome: AquilineHtmlOutcome | null =
    rawOutcome === AquilineHtmlOutcome.ACCEPTED || rawOutcome === AquilineHtmlOutcome.APPLIED
      ? rawOutcome
      : null;
  return {
    success: json.success === true,
    outcome,
    trackingUpdateStatus:
      typeof json.trackingUpdateStatus === 'string' ? json.trackingUpdateStatus : null,
    ...(typeof json.suggestAmazonEmailFetch === 'boolean'
      ? { suggestAmazonEmailFetch: json.suggestAmazonEmailFetch }
      : {}),
  };
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

/** Parse a response body as JSON; a non-JSON body (or empty body) degrades to
 *  a synthetic object carrying the raw text under `message`, so
 *  `classifyAquilineFailure` still has something to report on a failure. */
function parseJsonBody(raw: string): unknown {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { message: raw.slice(0, 500) };
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
