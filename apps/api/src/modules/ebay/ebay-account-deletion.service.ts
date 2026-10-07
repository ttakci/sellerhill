/**
 * Erases the personal data SellerHill holds for an eBay user who has closed
 * their eBay account, in response to a Marketplace Account Deletion notification.
 *
 * In practice the user is almost always a BUYER whose name / email / phone /
 * shipping address SellerHill stored on an `orders` row when their eBay order
 * synced in. Those rows are financial and tax records that must NOT be deleted,
 * so the PII columns are nulled in place and the row is kept.
 *
 * A closing user could also be a connected SELLER; their `ebay_accounts` row is
 * business data (the OAuth link, listings, order history) rather than personal
 * data, so nothing is scrubbed there today — eBay's requirement is about
 * personal data, and a seller closing their eBay account already breaks the
 * integration by revoking the token. If that ever needs to change it belongs
 * here, behind the same match.
 *
 * The same buyer can also appear on `ebay_returns` (login name + the comment
 * they wrote when opening a return) and on `ebay_cancellations` (login name);
 * those are nulled there, and the cancellation upsert honours the same marker.
 *
 * **An erasure is remembered, not just performed** (`buyer_data_erased_at`,
 * migration 130). Order sync re-reads an order whenever eBay modifies it and
 * the return sweep rewrites every return it sees, so without a marker the next
 * read would put the erased data straight back. The order upsert and the
 * return upsert both refuse to restore buyer data on a marked row.
 *
 * Idempotent: eBay redelivers a notification up to a handful of times, and the
 * UPDATEs only touch rows that still carry PII or are not yet marked, so a
 * second delivery is a zero-row no-op.
 */

import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../../common/database/database.service';

import type { AccountDeletionTarget } from './ebay-account-deletion.helpers';

export interface AccountDeletionResult {
  ordersAnonymized: number;
  returnsAnonymized: number;
  cancellationsAnonymized: number;
}

@Injectable()
export class EbayAccountDeletionService {
  private readonly logger = new Logger(EbayAccountDeletionService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async eraseUserData(target: AccountDeletionTarget): Promise<AccountDeletionResult> {
    // Match on username — it is what `orders.buyer_username` stores. `userId`
    // and `eiasToken` are not persisted anywhere on our side today, so a
    // notification carrying only a userId matches nothing (correctly a no-op:
    // we hold no data keyed by it).
    let ordersAnonymized = 0;
    let returnsAnonymized = 0;
    let cancellationsAnonymized = 0;
    if (target.username) {
      const rows = await this.databaseService.query<{ id: string }>(
        `UPDATE orders
            SET buyer_name = NULL,
                buyer_email = NULL,
                buyer_phone = NULL,
                shipping_address = NULL,
                -- Free text the seller wrote about this buyer's order.
                seller_note = NULL,
                buyer_data_erased_at = COALESCE(buyer_data_erased_at, CURRENT_TIMESTAMP),
                updated_at = CURRENT_TIMESTAMP
          WHERE buyer_username = $1
            AND (buyer_name IS NOT NULL
                 OR buyer_email IS NOT NULL
                 OR buyer_phone IS NOT NULL
                 OR shipping_address IS NOT NULL
                 OR seller_note IS NOT NULL
                 OR buyer_data_erased_at IS NULL)
          RETURNING id`,
        [target.username],
      );
      ordersAnonymized = rows.length;

      // The return rows of the same buyer. Matching on the login name is what
      // makes a redelivery a no-op: once nulled, nothing matches again.
      const returnRows = await this.databaseService.query<{ id: string }>(
        `UPDATE ebay_returns
            SET buyer_login_name = NULL,
                buyer_comment = NULL,
                buyer_data_erased_at = COALESCE(buyer_data_erased_at, CURRENT_TIMESTAMP),
                updated_at = CURRENT_TIMESTAMP
          WHERE buyer_login_name = $1
          RETURNING id`,
        [target.username],
      );
      returnsAnonymized = returnRows.length;

      // The buyer cancellation requests of the same buyer (migration 145).
      const cancellationRows = await this.databaseService.query<{ id: string }>(
        `UPDATE ebay_cancellations
            SET buyer_login_name = NULL,
                buyer_data_erased_at = COALESCE(buyer_data_erased_at, CURRENT_TIMESTAMP),
                updated_at = CURRENT_TIMESTAMP
          WHERE buyer_login_name = $1
          RETURNING id`,
        [target.username],
      );
      cancellationsAnonymized = cancellationRows.length;
    }

    await this.writeAuditLog(target, ordersAnonymized, returnsAnonymized, cancellationsAnonymized);

    this.logger.log(
      `eBay account deletion processed: username=${target.username ?? '-'} ` +
        `userId=${target.userId ?? '-'} ordersAnonymized=${ordersAnonymized} ` +
        `returnsAnonymized=${returnsAnonymized} cancellationsAnonymized=${cancellationsAnonymized}`,
    );

    return { ordersAnonymized, returnsAnonymized, cancellationsAnonymized };
  }

  /**
   * Durable record that the erasure request was received and actioned — this is
   * the evidence eBay's compliance process expects a processor to keep. Raw
   * INSERT (like `platform-settings.service.ts`) rather than `AuditLogService`,
   * whose action union does not cover this event; `user_id` is NULL because the
   * subject is an eBay user, not a SellerHill account. Best-effort: a logging
   * failure must never turn a completed erasure into a non-2xx that eBay retries.
   */
  private async writeAuditLog(
    target: AccountDeletionTarget,
    ordersAnonymized: number,
    returnsAnonymized: number,
    cancellationsAnonymized: number,
  ): Promise<void> {
    try {
      await this.databaseService.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
         VALUES (NULL, 'EBAY_ACCOUNT_DELETION', 'ebay_user', $1, $2)`,
        [
          target.userId ?? target.username ?? 'unknown',
          JSON.stringify({
            username: target.username,
            userId: target.userId,
            eiasToken: target.eiasToken,
            ordersAnonymized,
            returnsAnonymized,
            cancellationsAnonymized,
            processedAt: new Date().toISOString(),
          }),
        ],
      );
    } catch (err) {
      this.logger.error(
        `Could not write EBAY_ACCOUNT_DELETION audit row (data was still erased): ${
          (err as Error).message
        }`,
      );
    }
  }
}
