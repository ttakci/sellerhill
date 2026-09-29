import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EbayAccountStatus } from '@repo/shared';

import { DatabaseService } from '../../../common/database/database.service';
import { EbayApplicationTokenService } from '../../../common/ebay-budget/ebay-application-token.service';

import { EbayNotificationApiError, EbayNotificationClient } from './ebay-notification.client';
import {
  NEW_MESSAGE_TOPIC,
  ParsedEbayNotification,
  isValidNotificationVerificationToken,
  parseNewMessageData,
} from './ebay-notification.helpers';

/** How a delivered notification was booked. `test` is reserved; eBay's test payload is an ordinary envelope. */
export type NotificationDeliveryOutcomeKind =
  | 'counted'
  | 'duplicate'
  | 'no_account'
  | 'inactive_account'
  | 'already_read'
  | 'ignored'
  | 'test';

export interface NotificationDeliveryOutcome {
  stored: boolean;
  outcome: NotificationDeliveryOutcomeKind;
}

export type SubscribeAccountResult = 'created' | 'existing' | 'scope_missing' | 'disabled' | 'failed';

/** eBay: a destination already exists for this endpoint. */
const ERROR_DESTINATION_EXISTS = 195021;
/** eBay: a subscription for this topic already exists for this user. */
const ERROR_SUBSCRIPTION_EXISTS = 195012;
/** eBay: the user token lacks the scope the topic requires. */
const ERROR_SCOPE_MISSING = 195011;

const DESTINATION_NAME = 'SellerHill';
const BOOTSTRAP_DELAY_MS = 20_000;
const PUBLIC_KEY_TTL_MS = 3_600_000;
const NOTIFICATION_PATH = '/api/v1/ebay/notifications';
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hasErrorId = (error: unknown, id: number): boolean =>
  error instanceof EbayNotificationApiError && error.errorIds.includes(id);

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * eBay Notification API bookkeeping for the NEW_MESSAGE webhook:
 *  - one APPLICATION-level destination (our webhook URL), created once and
 *    remembered in memory + `ebay_notification_destinations`;
 *  - one NEW_MESSAGE subscription per connected store (USER token);
 *  - the signature public-key cache the receiver verifies against;
 *  - `recordDelivery`, which books each delivery exactly once and bumps the
 *    store's unread counter only for a genuinely new, unread message.
 *
 * Disabled (every method a no-op / 'disabled') until both
 * `EBAY_NOTIFICATION_VERIFICATION_TOKEN` and `EBAY_NOTIFICATION_ALERT_EMAIL`
 * are set and valid — the API must boot without them.
 */
@Injectable()
export class EbayNotificationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EbayNotificationService.name);
  private destinationId: string | null = null;
  private destinationInFlight: Promise<string | null> | null = null;
  private readonly publicKeys = new Map<string, { pem: string; expiresAt: number }>();

  constructor(
    private readonly client: EbayNotificationClient,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly appToken: EbayApplicationTokenService
  ) {}

  isEnabled(): boolean {
    return this.verificationToken() !== null && this.alertEmail() !== null;
  }

  verificationToken(): string | null {
    const token = this.config.get<string>('EBAY_NOTIFICATION_VERIFICATION_TOKEN')?.trim();
    return isValidNotificationVerificationToken(token) ? token : null;
  }

  endpointUrl(): string {
    const explicit = this.config.get<string>('EBAY_NOTIFICATION_ENDPOINT_URL')?.trim();
    if (explicit) {
      return explicit;
    }
    const frontend = (this.config.get<string>('FRONTEND_URL')?.trim() ?? '').replace(/\/+$/, '');
    return `${frontend}${NOTIFICATION_PATH}`;
  }

  onApplicationBootstrap(): void {
    if (!this.isEnabled()) {
      return;
    }
    setTimeout(() => {
      void this.ensureDestination().catch((error: unknown) =>
        this.logger.warn(`eBay notification destination bootstrap failed: ${errorText(error)}`)
      );
    }, BOOTSTRAP_DELAY_MS).unref();
  }

  /** The destination id, creating/adopting it on first use. `null` when disabled or eBay refused — never throws. */
  async ensureDestination(): Promise<string | null> {
    if (!this.isEnabled()) {
      return null;
    }
    if (this.destinationId) {
      return this.destinationId;
    }
    if (!this.destinationInFlight) {
      this.destinationInFlight = this.resolveDestination().finally(() => {
        this.destinationInFlight = null;
      });
    }
    return this.destinationInFlight;
  }

  async subscribeAccount(ebayAccountId: string, userToken: string): Promise<SubscribeAccountResult> {
    if (!this.isEnabled()) {
      return 'disabled';
    }
    try {
      const destinationId = await this.ensureDestination();
      if (!destinationId) {
        return 'failed';
      }
      const payload = await this.client.getTopic(NEW_MESSAGE_TOPIC);
      try {
        const subscriptionId = await this.client.createSubscription(userToken, {
          topicId: NEW_MESSAGE_TOPIC,
          destinationId,
          payload,
        });
        await this.stampSubscription(subscriptionId, ebayAccountId);
        return 'created';
      } catch (error: unknown) {
        if (hasErrorId(error, ERROR_SCOPE_MISSING)) {
          this.logger.warn(`eBay store ${ebayAccountId} lacks the messaging scope — NEW_MESSAGE not subscribed`);
          return 'scope_missing';
        }
        if (!hasErrorId(error, ERROR_SUBSCRIPTION_EXISTS)) {
          throw error;
        }
        const subscriptions = await this.client.listSubscriptions(userToken);
        const existing =
          subscriptions.find((s) => s.topicId === NEW_MESSAGE_TOPIC && s.destinationId === destinationId) ??
          subscriptions.find((s) => s.topicId === NEW_MESSAGE_TOPIC);
        if (!existing?.subscriptionId) {
          this.logger.warn(`eBay reported a NEW_MESSAGE subscription for store ${ebayAccountId} but none was listed`);
          return 'failed';
        }
        await this.stampSubscription(existing.subscriptionId, ebayAccountId);
        return 'existing';
      }
    } catch (error: unknown) {
      this.logger.warn(`NEW_MESSAGE subscription failed for eBay store ${ebayAccountId}: ${errorText(error)}`);
      return 'failed';
    }
  }

  /** Best-effort: deletes the stored subscription on eBay and clears the column. Never throws. */
  async unsubscribeAccount(ebayAccountId: string, userToken: string): Promise<void> {
    try {
      const rows = await this.db.query<{ message_subscription_id: string | null }>(
        'SELECT message_subscription_id FROM ebay_accounts WHERE id = $1',
        [ebayAccountId]
      );
      const subscriptionId = rows[0]?.message_subscription_id;
      if (!subscriptionId) {
        return;
      }
      try {
        await this.client.deleteSubscription(userToken, subscriptionId);
      } catch (error: unknown) {
        this.logger.warn(`Deleting NEW_MESSAGE subscription for eBay store ${ebayAccountId} failed: ${errorText(error)}`);
      }
      await this.db.query(
        'UPDATE ebay_accounts SET message_subscription_id = NULL, message_subscription_at = NULL, updated_at = NOW() WHERE id = $1',
        [ebayAccountId]
      );
    } catch (error: unknown) {
      this.logger.warn(`Unsubscribing eBay store ${ebayAccountId} failed: ${errorText(error)}`);
    }
  }

  /** PEM for a signature key id, cached for an hour. `null` on 404/any failure (failures are not cached). */
  async publicKey(kid: string): Promise<string | null> {
    const cached = this.publicKeys.get(kid);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.pem;
    }
    try {
      const { key } = await this.client.getPublicKey(kid);
      if (!key) {
        return null;
      }
      this.publicKeys.set(kid, { pem: key, expiresAt: Date.now() + PUBLIC_KEY_TTL_MS });
      return key;
    } catch (error: unknown) {
      this.logger.warn(`eBay notification public key ${kid} unavailable: ${errorText(error)}`);
      return null;
    }
  }

  /**
   * Books one verified delivery. The event row is inserted `ON CONFLICT DO
   * NOTHING` on eBay's notification id, and the unread counter is bumped only
   * when that insert actually wrote a row — so a redelivery (same id, higher
   * publishAttemptCount) can never double-count.
   */
  async recordDelivery(parsed: ParsedEbayNotification): Promise<NotificationDeliveryOutcome> {
    const message = parsed.topic === NEW_MESSAGE_TOPIC ? parseNewMessageData(parsed.data) : null;
    if (!message) {
      const stored = await this.insertEvent(parsed, null, null, null, 'ignored');
      return stored ? { stored: true, outcome: 'ignored' } : { stored: false, outcome: 'duplicate' };
    }

    // No status filter on purpose: a disconnected store still resolves, so the
    // delivery is booked against it as `inactive_account` rather than lost.
    const accounts = await this.db.query<{ id: string; status: EbayAccountStatus }>(
      `SELECT id, status FROM ebay_accounts WHERE seller_id = $1 OR ebay_username = $1
       ORDER BY (status = '${EbayAccountStatus.ACTIVE}') DESC LIMIT 1`,
      [message.recipientUserName]
    );
    const account = accounts[0] ?? null;

    let outcome: NotificationDeliveryOutcomeKind;
    if (!account) {
      outcome = 'no_account';
    } else if (account.status !== EbayAccountStatus.ACTIVE) {
      outcome = 'inactive_account';
    } else if (message.readStatus) {
      outcome = 'already_read';
    } else {
      outcome = 'counted';
    }

    const stored = await this.insertEvent(
      parsed,
      account?.id ?? null,
      message.conversationId,
      message.conversationType,
      outcome
    );
    if (!stored) {
      return { stored: false, outcome: 'duplicate' };
    }
    if (outcome === 'counted' && account) {
      await this.db.query(
        'UPDATE ebay_accounts SET unread_message_count = unread_message_count + 1, updated_at = NOW() WHERE id = $1',
        [account.id]
      );
    }
    return { stored: true, outcome };
  }

  private alertEmail(): string | null {
    const email = this.config.get<string>('EBAY_NOTIFICATION_ALERT_EMAIL')?.trim();
    return email && SIMPLE_EMAIL.test(email) ? email : null;
  }

  private async resolveDestination(): Promise<string | null> {
    const environment = this.appToken.environment();
    const endpoint = this.endpointUrl();
    try {
      const rows = await this.db.query<{ destination_id: string }>(
        'SELECT destination_id FROM ebay_notification_destinations WHERE environment = $1 AND endpoint_url = $2',
        [environment, endpoint]
      );
      if (rows[0]?.destination_id) {
        this.destinationId = rows[0].destination_id;
        return this.destinationId;
      }

      const alertEmail = this.alertEmail();
      const verificationToken = this.verificationToken();
      if (!alertEmail || !verificationToken) {
        return null;
      }
      try {
        await this.client.putConfig(alertEmail);
      } catch (error: unknown) {
        // The alert e-mail is a nicety; the destination is what matters.
        this.logger.warn(`eBay notification config (alert e-mail) not saved: ${errorText(error)}`);
      }

      let destinationId: string;
      try {
        destinationId = await this.client.createDestination({ name: DESTINATION_NAME, endpoint, verificationToken });
      } catch (error: unknown) {
        if (!hasErrorId(error, ERROR_DESTINATION_EXISTS)) {
          throw error;
        }
        const existing = (await this.client.listDestinations()).find((d) => d.endpoint === endpoint);
        if (!existing?.destinationId) {
          throw error;
        }
        destinationId = existing.destinationId;
      }

      await this.db.query(
        `INSERT INTO ebay_notification_destinations (environment, endpoint_url, destination_id) VALUES ($1, $2, $3)
         ON CONFLICT (environment, endpoint_url) DO UPDATE SET destination_id = EXCLUDED.destination_id, updated_at = NOW()`,
        [environment, endpoint, destinationId]
      );
      this.destinationId = destinationId;
      return destinationId;
    } catch (error: unknown) {
      this.logger.warn(`eBay notification destination unavailable for ${endpoint}: ${errorText(error)}`);
      return null;
    }
  }

  private async stampSubscription(subscriptionId: string, ebayAccountId: string): Promise<void> {
    await this.db.query(
      'UPDATE ebay_accounts SET message_subscription_id = $1, message_subscription_at = NOW(), updated_at = NOW() WHERE id = $2',
      [subscriptionId, ebayAccountId]
    );
  }

  /** True when the row was written; false when the notification id was already booked. */
  private async insertEvent(
    parsed: ParsedEbayNotification,
    ebayAccountId: string | null,
    conversationId: string | null,
    conversationType: string | null,
    outcome: NotificationDeliveryOutcomeKind
  ): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `INSERT INTO ebay_notification_events (notification_id, topic, ebay_account_id, conversation_id, conversation_type, outcome, payload, event_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (notification_id) DO NOTHING RETURNING id`,
      [
        parsed.notificationId,
        parsed.topic,
        ebayAccountId,
        conversationId,
        conversationType,
        outcome,
        JSON.stringify(parsed),
        parsed.eventDate,
      ]
    );
    return rows.length > 0;
  }
}
