import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_LOCALE,
  EBAY_CANCEL_REQUESTOR_BUYER,
  EBAY_MARKETPLACE_CONFIG,
  EbayMarketplaceId,
  isValidLocale,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { buildLocalRangeSql } from '../../common/timezone/local-day-sql';
import { ActionCenterService } from '../action-center/action-center.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { buildTrackedOrderSql } from '../ebay-returns/return-store-scope';
import { EmailService } from '../email/email.service';

import { buildDigestClaimSql, toDigestClaim, type DigestClaim, type DigestClaimRow } from './digest-claim';
import {
  DIGEST_PENDING_SEVERITIES,
  renderDigest,
  resolveDigestLocale,
  type DigestPendingItem,
} from './digest-render';

export type DigestOutcome = 'sent' | 'empty' | 'suspended';

interface StoreRow {
  id: string;
  label: string;
  marketplace_id: string | null;
}

interface CountsRow {
  cancel_requests: string;
  new_returns: string;
}

/**
 * Builds and sends one seller's daily summary. Every figure comes from the
 * code the app itself shows: the dashboard's card fragment (per store and in
 * total) and the Action Center summary the sidebar badge counts — the e-mail
 * never has a query of its own for something the panel already shows.
 */
@Injectable()
export class SellerDigestService {
  private readonly logger = new Logger(SellerDigestService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly dashboardService: DashboardService,
    private readonly actionCenterService: ActionCenterService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /** Claims up to `limit` due sellers and stamps their day (see `buildDigestClaimSql`). */
  async claimDue(limit: number): Promise<DigestClaim[]> {
    const rows = await this.databaseService.query<DigestClaimRow>(buildDigestClaimSql(), [limit]);
    return rows.map(toDigestClaim);
  }

  async send(claim: DigestClaim): Promise<DigestOutcome> {
    if (await this.quotaEnforcement.isSuspended(claim.userId)) {
      return 'suspended';
    }

    const day = { from: claim.reportDay, to: claim.reportDay };
    const [metrics, stores, counts, summary] = await Promise.all([
      this.dashboardService.getRangeMetricsByStore(claim.userId, day, claim.timezone),
      this.loadStores(claim.userId),
      this.loadCounts(claim.userId, claim.reportDay, claim.timezone),
      this.actionCenterService.getSummary(claim.userId, null),
    ]);

    const labels = new Map(stores.map((store) => [store.id, store.label]));
    const pending: DigestPendingItem[] = summary.groups
      .flatMap((group) => group.items)
      .filter((item) => DIGEST_PENDING_SEVERITIES.has(item.severity))
      .map((item) => ({
        key: item.key,
        severity: item.severity,
        count: item.count,
        url: item.actionPath ? this.appUrl(claim.locale, item.actionPath) : null,
      }));

    const rendered = renderDigest({
      locale: resolveDigestLocale(claim.locale),
      firstName: claim.firstName,
      reportDay: claim.reportDay,
      currency: this.resolveCurrency(stores),
      total: metrics.total,
      stores: metrics.stores
        .filter((store) => labels.has(store.ebayAccountId))
        .map((store) => ({ label: labels.get(store.ebayAccountId) as string, metrics: store.metrics })),
      connectedStoreCount: stores.length,
      cancelRequests: Number(counts.cancel_requests),
      newReturns: Number(counts.new_returns),
      pending,
    });

    if (rendered.empty) {
      return 'empty';
    }
    await this.emailService.sendDailyDigest(claim.email, rendered.variables, claim.locale ?? DEFAULT_LOCALE);
    return 'sent';
  }

  /** Display name the way the store switcher shows it — never the opaque eBay id unless nothing else exists. */
  private async loadStores(userId: string): Promise<StoreRow[]> {
    return this.databaseService.query<StoreRow>(
      `SELECT id,
              COALESCE(NULLIF(store_name, ''), NULLIF(ebay_username, ''), seller_id) AS label,
              marketplace_id
         FROM ebay_accounts
        WHERE user_id = $1
        ORDER BY created_at ASC, id ASC`,
      [userId],
    );
  }

  /**
   * Buyer cancel requests and returns OPENED on that local day (not what is
   * still open — that is `pending`). Only those on OUR sales, the rows the
   * Returns / Cancellations pages show (`buildTrackedOrderSql`).
   */
  private async loadCounts(userId: string, reportDay: string, timezone: string): Promise<CountsRow> {
    const rows = await this.databaseService.query<CountsRow>(
      `SELECT
         (SELECT COUNT(*) FROM ebay_cancellations c
           WHERE c.user_id = $1 AND c.requestor_type = $4
             AND ${buildTrackedOrderSql('c')}
             AND ${buildLocalRangeSql('c.requested_at', '$2', '$2', '$3')}) AS cancel_requests,
         (SELECT COUNT(*) FROM ebay_returns r
           WHERE r.user_id = $1
             AND ${buildTrackedOrderSql('r')}
             AND ${buildLocalRangeSql('r.created_on_ebay_at', '$2', '$2', '$3')}) AS new_returns`,
      [userId, reportDay, timezone, EBAY_CANCEL_REQUESTOR_BUYER],
    );
    return rows[0] ?? { cancel_requests: '0', new_returns: '0' };
  }

  /**
   * The currency the totals are summed in. Only eBay US is live, so every store
   * shares one; a second marketplace would need per-currency totals here.
   */
  private resolveCurrency(stores: StoreRow[]): string {
    const marketplace = stores.find((store) => store.marketplace_id)?.marketplace_id as EbayMarketplaceId | undefined;
    return (marketplace && EBAY_MARKETPLACE_CONFIG[marketplace]?.currency) || EBAY_MARKETPLACE_CONFIG[EbayMarketplaceId.EBAY_US].currency;
  }

  /** `actionPath` is locale-less (`/orders?stage=…`); the router needs the locale segment. */
  private appUrl(locale: string | null, path: string): string {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const safeLocale = locale && isValidLocale(locale) ? locale : DEFAULT_LOCALE;
    return `${frontendUrl}/${safeLocale}${path}`;
  }
}
