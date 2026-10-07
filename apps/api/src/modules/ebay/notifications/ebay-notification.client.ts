import { Injectable, Logger } from '@nestjs/common';
import { EbayApiResource, EbayCallPriority } from '@repo/shared';
import axios, { AxiosResponse } from 'axios';

import { EbayApplicationTokenService } from '../../../common/ebay-budget/ebay-application-token.service';
import { EbayCallBudgetService } from '../../../common/ebay-budget/ebay-call-budget.service';
import { withEbayRateLimitRetry } from '../ebay-http-retry';

import { extractIdFromLocation } from './ebay-notification.helpers';

const REQUEST_TIMEOUT_MS = 15_000;
const ENABLED = 'ENABLED';

/** eBay answered a Notification API call with an error — carries its numeric error ids. */
export class EbayNotificationApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorIds: number[],
    message: string
  ) {
    super(message);
    this.name = 'EbayNotificationApiError';
  }
}

export interface EbayNotificationPayloadSpec {
  format: string;
  schemaVersion: string;
  deliveryProtocol: string;
}

export interface EbayNotificationDestination {
  destinationId: string;
  endpoint: string;
  status: string;
}

export interface EbayNotificationSubscription {
  subscriptionId: string;
  topicId: string;
  destinationId: string;
  status: string;
}

export interface EbayNotificationPublicKey {
  key: string;
  algorithm: string;
  digest: string;
}

interface EbayErrorBody {
  errors?: Array<{ errorId?: unknown; message?: unknown }>;
}

interface HttpErrorLike {
  response?: { status?: number; data?: unknown };
  message?: unknown;
}

const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * eBay Commerce Notification API (`/commerce/notification/v1`).
 *
 * Destination, config, topic and public-key calls are application-scoped and
 * use the APPLICATION token; subscriptions belong to a seller and use that
 * seller's USER token. Every request charges `EbayApiResource.NOTIFICATION`
 * at BACKGROUND priority before each attempt (retries are real calls).
 */
@Injectable()
export class EbayNotificationClient {
  private readonly logger = new Logger(EbayNotificationClient.name);

  constructor(
    private readonly appToken: EbayApplicationTokenService,
    private readonly budget: EbayCallBudgetService
  ) {}

  async putConfig(alertEmail: string): Promise<void> {
    const token = await this.appToken.get();
    await this.request(() => axios.put(`${this.base()}/config`, { alertEmail }, this.options(token)));
  }

  async createDestination(input: { name: string; endpoint: string; verificationToken: string }): Promise<string> {
    const token = await this.appToken.get();
    const res = await this.request(() =>
      axios.post(
        `${this.base()}/destination`,
        {
          name: input.name,
          status: ENABLED,
          deliveryConfig: { endpoint: input.endpoint, verificationToken: input.verificationToken },
        },
        this.options(token)
      )
    );
    return this.idFromLocation(res);
  }

  async listDestinations(): Promise<EbayNotificationDestination[]> {
    const token = await this.appToken.get();
    const res = await this.request(() =>
      axios.get<{ destinations?: Array<{ destinationId?: unknown; status?: unknown; deliveryConfig?: { endpoint?: unknown } }> }>(
        `${this.base()}/destination?limit=100`,
        this.options(token)
      )
    );
    return (res.data?.destinations ?? []).map((d) => ({
      destinationId: asString(d.destinationId),
      endpoint: asString(d.deliveryConfig?.endpoint),
      status: asString(d.status),
    }));
  }

  async getTopic(topicId: string): Promise<EbayNotificationPayloadSpec> {
    const token = await this.appToken.get();
    const res = await this.request(() =>
      axios.get<{ supportedPayloads?: Array<Partial<Record<keyof EbayNotificationPayloadSpec, unknown>>> }>(
        `${this.base()}/topic/${encodeURIComponent(topicId)}`,
        this.options(token)
      )
    );
    const first = res.data?.supportedPayloads?.[0];
    if (!first) {
      throw new EbayNotificationApiError(res.status, [], `topic ${topicId} lists no supported payload`);
    }
    return {
      // getTopic answers `format: ["JSON"]` (an array), but createSubscription takes one string;
      // sending '' made every NEW_MESSAGE subscription fail with "Invalid request" (production, 2026-10-04..07).
      format: asString(Array.isArray(first.format) ? first.format[0] : first.format),
      schemaVersion: asString(first.schemaVersion),
      deliveryProtocol: asString(first.deliveryProtocol),
    };
  }

  async createSubscription(
    userToken: string,
    input: { topicId: string; destinationId: string; payload: EbayNotificationPayloadSpec }
  ): Promise<string> {
    const res = await this.request(() =>
      axios.post(
        `${this.base()}/subscription`,
        { topicId: input.topicId, status: ENABLED, destinationId: input.destinationId, payload: input.payload },
        this.options(userToken)
      )
    );
    return this.idFromLocation(res);
  }

  async listSubscriptions(userToken: string): Promise<EbayNotificationSubscription[]> {
    const res = await this.request(() =>
      axios.get<{ subscriptions?: Array<Record<string, unknown>> }>(
        `${this.base()}/subscription?limit=100`,
        this.options(userToken)
      )
    );
    return (res.data?.subscriptions ?? []).map((s) => ({
      subscriptionId: asString(s.subscriptionId),
      topicId: asString(s.topicId),
      destinationId: asString(s.destinationId),
      status: asString(s.status),
    }));
  }

  async deleteSubscription(userToken: string, subscriptionId: string): Promise<void> {
    await this.request(() =>
      axios.delete(`${this.base()}/subscription/${encodeURIComponent(subscriptionId)}`, this.options(userToken))
    );
  }

  async getPublicKey(kid: string): Promise<EbayNotificationPublicKey> {
    const token = await this.appToken.get();
    const res = await this.request(() =>
      axios.get<Partial<Record<keyof EbayNotificationPublicKey, unknown>>>(
        `${this.base()}/public_key/${encodeURIComponent(kid)}`,
        this.options(token)
      )
    );
    return {
      key: asString(res.data?.key),
      algorithm: asString(res.data?.algorithm),
      digest: asString(res.data?.digest),
    };
  }

  private base(): string {
    return `${this.appToken.restBase()}/commerce/notification/v1`;
  }

  private charge(): () => Promise<void> {
    return () => this.budget.acquire(EbayApiResource.NOTIFICATION, EbayCallPriority.BACKGROUND);
  }

  private options(token: string): { headers: Record<string, string>; timeout: number } {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: REQUEST_TIMEOUT_MS,
    };
  }

  private idFromLocation(res: AxiosResponse): string {
    const headers = (res.headers ?? {}) as Record<string, unknown>;
    const id = extractIdFromLocation(headers.location);
    if (!id) {
      throw new EbayNotificationApiError(res.status, [], 'no Location header');
    }
    return id;
  }

  /** Budget + 429/5xx backoff; an HTTP error becomes an `EbayNotificationApiError` carrying eBay's ids. */
  private async request<T>(run: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    try {
      return await withEbayRateLimitRetry(run, { logger: this.logger, acquireBudget: this.charge() });
    } catch (error: unknown) {
      const httpError = error as HttpErrorLike;
      const status = httpError?.response?.status;
      if (typeof status !== 'number') {
        throw error;
      }
      const body = (httpError.response?.data ?? {}) as EbayErrorBody;
      const errors = Array.isArray(body.errors) ? body.errors : [];
      const ids = errors.map((e) => Number(e.errorId)).filter(Number.isFinite);
      const message = errors.map((e) => asString(e.message)).filter(Boolean).join('; ') || `eBay Notification API ${status}`;
      throw new EbayNotificationApiError(status, ids, message);
    }
  }
}
