// apps/api/src/modules/buyer-messaging/buyer-message-helpers.spec.ts
import { createHash } from 'crypto';

import {
  BuyerMessageEventType,
  BuyerMessageTemplateKind,
  type BuyerMessageContext,
  type BuyerMessagingConfig,
} from '@repo/shared';

import {
  renderTemplate,
  resolveEventConfig,
  buyerMessageJobId,
  templateVersionHash,
} from './buyer-message-helpers';

const ctx: BuyerMessageContext = {
  buyerUsername: 'jdoe',
  itemTitle: 'Red Widget',
  orderId: '12-0-12345',
  trackingNumber: 'TN123',
  carrier: 'UPS',
  storeName: 'AcmeShop',
};

describe('renderTemplate', () => {
  it('replaces known placeholders', () => {
    const out = renderTemplate('Hi {{buyer_username}}, your {{item_title}} ({{order_id}})', ctx);
    expect(out).toBe('Hi jdoe, your Red Widget (12-0-12345)');
  });
  it('collapses unknown placeholders to empty string', () => {
    expect(renderTemplate('X {{unknown_token}} Y', ctx)).toBe('X  Y');
  });
  it('is case-sensitive on placeholder names', () => {
    expect(renderTemplate('{{buyer_username}} vs {{Buyer_Username}}', ctx)).toBe('jdoe vs ');
  });
});

describe('resolveEventConfig', () => {
  const config: BuyerMessagingConfig = {
    enabled: true,
    events: {
      [BuyerMessageEventType.ORDER_RECEIVED]: {
        enabled: true,
        template: { kind: BuyerMessageTemplateKind.SYSTEM, id: 'order_received.en.default' },
      },
      [BuyerMessageEventType.SHIPPED]: { enabled: false, template: { kind: BuyerMessageTemplateKind.SYSTEM, id: 'x' } },
    },
  };
  it('returns the event config when feature + event enabled', () => {
    expect(resolveEventConfig(config, BuyerMessageEventType.ORDER_RECEIVED)?.enabled).toBe(true);
  });
  it('returns null when feature master toggle is off', () => {
    expect(resolveEventConfig({ ...config, enabled: false }, BuyerMessageEventType.ORDER_RECEIVED)).toBeNull();
  });
  it('returns null when the event is disabled', () => {
    expect(resolveEventConfig(config, BuyerMessageEventType.SHIPPED)).toBeNull();
  });
  it('returns null when the event is absent', () => {
    expect(resolveEventConfig(config, BuyerMessageEventType.DELIVERED)).toBeNull();
  });
  it('returns null when config is null', () => {
    expect(resolveEventConfig(null, BuyerMessageEventType.ORDER_RECEIVED)).toBeNull();
  });
});

describe('buyerMessageJobId', () => {
  it('is stable per order+event', () => {
    expect(buyerMessageJobId('12-0-1', BuyerMessageEventType.SHIPPED)).toBe('buyer-msg-12-0-1-shipped');
  });
});

describe('templateVersionHash', () => {
  it('returns a short stable hex hash of the body', () => {
    const h = templateVersionHash('hello');
    expect(h).toBe(createHash('sha256').update('hello').digest('hex').slice(0, 12));
    expect(templateVersionHash('hello')).toBe(h);
    expect(templateVersionHash('hellox')).not.toBe(h);
  });
});
