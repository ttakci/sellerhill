// apps/api/src/modules/buyer-messaging/buyer-message.provider.ts
import { Injectable } from '@nestjs/common';
import { EBAY_MESSAGE_MAX_LENGTH, EbayCallPriority } from '@repo/shared';

import { EbayService } from '../ebay/ebay.service';
import { EbayMessageClient } from '../ebay-messages/ebay-message.client';

export interface BuyerMessageSendInput {
  ebayAccountId: string;
  orderId: string;
  /** eBay item id (listing reference), when the order carries one. */
  ebayItemId?: string;
  buyerUsername: string;
  body: string;
}

export interface BuyerMessageSendResult {
  providerMessageId?: string;
}

export interface BuyerMessagingProvider {
  sendMessage(input: BuyerMessageSendInput): Promise<BuyerMessageSendResult>;
}

/**
 * Sends a buyer auto-message through the real, budget-governed
 * `EbayMessageClient` (`commerce/message/v1/send_message`). Resolves the
 * per-account seller token internally via `EbayService.getAccountAccessToken`.
 * Runs at `EbayCallPriority.BACKGROUND` — this is automation-triggered, never
 * an interactive seller action. Errors propagate to the caller; the processor
 * logs them redacted and lets BullMQ retry.
 */
@Injectable()
export class EbayMessageApiProvider implements BuyerMessagingProvider {
  constructor(
    private readonly client: EbayMessageClient,
    private readonly ebayService: EbayService,
  ) {}

  async sendMessage(input: BuyerMessageSendInput): Promise<BuyerMessageSendResult> {
    const token = await this.ebayService.getAccountAccessToken(input.ebayAccountId);
    const { messageId } = await this.client.sendMessage(
      token,
      {
        otherPartyUsername: input.buyerUsername,
        // By code point, so a cut never splits a surrogate pair (emoji).
        text: Array.from(input.body).slice(0, EBAY_MESSAGE_MAX_LENGTH).join(''),
        referenceItemId: input.ebayItemId,
      },
      EbayCallPriority.BACKGROUND,
    );
    return { providerMessageId: messageId };
  }
}
