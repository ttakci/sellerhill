// apps/api/src/modules/buyer-messaging/buyer-message.provider.ts
import { Injectable, Logger } from '@nestjs/common';

import { EbayService } from '../ebay/ebay.service';

export interface BuyerMessageSendInput {
  ebayAccountId: string;
  orderId: string;
  lineItemId?: string;
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
 * eBay Commerce Message API (REST) provider. Resolves the per-account user
 * token internally via EbayService.getAccountAccessToken. Honours Retry-After
 * on 429/5xx. Errors are thrown to the caller (the processor logs them redacted).
 */
@Injectable()
export class EbayMessageApiProvider implements BuyerMessagingProvider {
  private readonly logger = new Logger(EbayMessageApiProvider.name);
  // TODO(confirm): exact path/scopes per live Message API docs - see task note.
  private readonly endpoint = 'https://apix.ebay.com/ws/commerce/message/v1/message';

  constructor(private readonly ebayService: EbayService) {}

  async sendMessage(input: BuyerMessageSendInput): Promise<BuyerMessageSendResult> {
    const token = await this.ebayService.getAccountAccessToken(input.ebayAccountId);
    const payload = {
      // Field names per live docs; order context + recipient + body.
      recipient: { username: input.buyerUsername },
      body: input.body,
      context: {
        orderId: input.orderId,
        ...(input.lineItemId ? { lineItemId: input.lineItemId } : {}),
      },
    };
    const res = await this.doWithRetry(() =>
      fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          // some eBay Commerce APIs require a marketplace header; add if docs say so.
        },
        body: JSON.stringify(payload),
      }),
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`eBay Message API ${res.status}: ${this.redact(text)}`);
    }
    const json = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { providerMessageId: json.messageId };
  }

  private async doWithRetry(run: () => Promise<Response>, maxAttempts = 3): Promise<Response> {
    let last: Response | undefined;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await run();
      if (res.status !== 429 && res.status < 500) {
        return res;
      }
      last = res;
      const retryAfter = Number(res.headers.get('retry-after')) || 2 * (attempt + 1);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
    }
    return last as Response;
  }

  /** Strip anything token-like before logging. */
  private redact(text: string): string {
    return text
      .replace(/(Bearer\s+[\w.-]+|token["']?\s*[:=]\s*["']?[\w.-]+)/gi, '[redacted]')
      .slice(0, 400);
  }
}
