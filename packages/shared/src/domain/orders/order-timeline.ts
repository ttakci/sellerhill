// packages/shared/src/domain/orders/order-timeline.ts
//
// The order detail page's step-by-step timeline: received -> bought on Amazon
// -> shipped by Amazon -> tracking on eBay -> delivered, each with the time it
// happened and — for the one step the order is standing on — what is going on.
//
// It adds no new status. The step the order is ON is decided by `OrderStage`
// (the one seller-facing status); everything else is evidence columns the
// order already carries. Pure, so the API (real rows) and the demo (fixtures)
// build the same timeline, and so the rules below are unit-tested.
//
// Codes only, never sentences: the web resolves `orders.timeline.*`.

import { BuyerMessageEventType, BuyerMessageStatus } from '../buyer-messaging/buyer-messaging.types';

import { isSimulatedAmazonOrderId } from './fulfillment-state';
import { isTrackingHeldOverdue } from './order-stage';
import {
  AutoFulfillStatus,
  OrderStage,
  OrderTimelineNote,
  OrderTimelineStepKey,
  OrderTimelineStepState,
  type OrderTimelineStepDto,
} from './orders.types';

type Timestamp = string | Date | null | undefined;

/** One buyer message the log holds for the order (`buyer_message_log`). */
export interface OrderTimelineMessage {
  event: BuyerMessageEventType;
  status: BuyerMessageStatus;
  at: Timestamp;
}

export interface OrderTimelineInput {
  /** `deriveOrderStage` for the same row — decides which step is in focus. */
  stage: OrderStage;
  autoFulfillStatus?: AutoFulfillStatus | null;
  amazonOrderId?: string | null;
  /** `orders.order_date` — when the buyer placed the eBay order. */
  orderDate?: Timestamp;
  /** `orders.auto_fulfill_attempted_at` — the last automatic attempt. */
  autoFulfillAttemptedAt?: Timestamp;
  /** `orders.auto_fulfill_submitted_at` — the Place Order click. */
  autoFulfillSubmittedAt?: Timestamp;
  /** `orders.amazon_linked_at` — the Amazon order's costs were captured. */
  amazonLinkedAt?: Timestamp;
  amazonCancelledAt?: Timestamp;
  shippedDetectedAt?: Timestamp;
  ebayTrackingPushedAt?: Timestamp;
  /** What eBay received — the number the buyer sees. */
  ebayTrackingPushedNumber?: string | null;
  /** `orders.delivered_at` (migration 133). */
  deliveredAt?: Timestamp;
  ebayCancelledAt?: Timestamp;
  messages?: readonly OrderTimelineMessage[];
  now: Date;
}

const toIso = (value: Timestamp): string | null => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const step = (
  key: OrderTimelineStepKey,
  state: OrderTimelineStepState,
  note: OrderTimelineNote,
  at: Timestamp = null,
  reference: string | null = null
): OrderTimelineStepDto => ({ key, state, note, at: toIso(at), reference });

/** Which main step a buyer message is listed under. */
const MESSAGE_STEPS: ReadonlyArray<{
  event: BuyerMessageEventType;
  key: OrderTimelineStepKey;
  after: OrderTimelineStepKey;
}> = [
  {
    event: BuyerMessageEventType.ORDER_RECEIVED,
    key: OrderTimelineStepKey.MESSAGE_ORDER_RECEIVED,
    after: OrderTimelineStepKey.RECEIVED,
  },
  {
    event: BuyerMessageEventType.SHIPPED,
    key: OrderTimelineStepKey.MESSAGE_SHIPPED,
    after: OrderTimelineStepKey.EBAY_TRACKING,
  },
  {
    event: BuyerMessageEventType.DELIVERED,
    key: OrderTimelineStepKey.MESSAGE_DELIVERED,
    after: OrderTimelineStepKey.DELIVERED,
  },
  {
    event: BuyerMessageEventType.FEEDBACK_REQUEST,
    key: OrderTimelineStepKey.MESSAGE_FEEDBACK_REQUEST,
    after: OrderTimelineStepKey.DELIVERED,
  },
];

/**
 * A message row exists only for what the log proves: sent, or tried and
 * failed. A `skipped` entry (the event is switched off, the store lacks the
 * messaging permission) is not a step of this order — listing four "switched
 * off" rows on every order would bury the steps that did happen.
 */
function messageSteps(messages: readonly OrderTimelineMessage[]): Map<OrderTimelineStepKey, OrderTimelineStepDto[]> {
  const byAnchor = new Map<OrderTimelineStepKey, OrderTimelineStepDto[]>();
  for (const def of MESSAGE_STEPS) {
    const entries = messages.filter((m) => m.event === def.event);
    const sent = entries.find((m) => m.status === BuyerMessageStatus.SENT);
    const failed = entries.filter((m) => m.status === BuyerMessageStatus.FAILED).pop();
    const shown = sent ?? failed;
    if (!shown) {
      continue;
    }
    const row: OrderTimelineStepDto = {
      ...step(
        def.key,
        sent ? OrderTimelineStepState.DONE : OrderTimelineStepState.ATTENTION,
        sent ? OrderTimelineNote.MESSAGE_SENT : OrderTimelineNote.MESSAGE_FAILED,
        shown.at
      ),
      isMessage: true,
    };
    byAnchor.set(def.after, [...(byAnchor.get(def.after) ?? []), row]);
  }
  return byAnchor;
}

export function buildOrderTimeline(input: OrderTimelineInput): OrderTimelineStepDto[] {
  const { stage } = input;
  const { DONE, CURRENT, ATTENTION, UPCOMING, SKIPPED } = OrderTimelineStepState;

  const realAmazonOrderId =
    input.amazonOrderId && !isSimulatedAmazonOrderId(input.amazonOrderId) ? input.amazonOrderId : null;
  const placed = input.autoFulfillStatus === AutoFulfillStatus.PLACED;
  const purchaseProven = !!realAmazonOrderId || placed;
  const saleCancelled = stage === OrderStage.CANCELLED;
  // The buyer has been served (or is being served) — whatever this platform
  // did not do for the order will not happen any more, so a step without
  // evidence is "not by SellerHill", never "still to come".
  const fulfilled = stage === OrderStage.SHIPPED || stage === OrderStage.DELIVERED;

  const main: OrderTimelineStepDto[] = [
    step(OrderTimelineStepKey.RECEIVED, DONE, OrderTimelineNote.RECEIVED, input.orderDate),
  ];

  // ── Bought on Amazon ─────────────────────────────────────────────────
  if (stage === OrderStage.AMAZON_CANCELLED) {
    main.push(
      step(OrderTimelineStepKey.PURCHASE, ATTENTION, OrderTimelineNote.STAGE, input.amazonCancelledAt, realAmazonOrderId)
    );
  } else if (purchaseProven) {
    main.push(
      step(
        OrderTimelineStepKey.PURCHASE,
        DONE,
        placed ? OrderTimelineNote.BOUGHT_AUTO : OrderTimelineNote.BOUGHT_LINKED,
        // PLACED before the order number was read: the click is the purchase.
        input.amazonLinkedAt ?? (placed ? input.autoFulfillSubmittedAt : null),
        realAmazonOrderId
      )
    );
  } else if (fulfilled || stage === OrderStage.TRACKING_HELD || stage === OrderStage.PURCHASED) {
    // Stages past the purchase with no proof of one on the row. (The two
    // in-flight stages cannot be derived without proof; listed so an
    // inconsistent input still yields one step in focus, never two.)
    main.push(step(OrderTimelineStepKey.PURCHASE, SKIPPED, OrderTimelineNote.PURCHASE_NOT_RECORDED));
  } else if (!saleCancelled) {
    const stopped = stage === OrderStage.PURCHASE_BLOCKED || stage === OrderStage.PURCHASE_UNKNOWN;
    const attempted = stage === OrderStage.BUYING || stage === OrderStage.TEST_RUN || stopped;
    main.push(
      step(
        OrderTimelineStepKey.PURCHASE,
        stopped ? ATTENTION : CURRENT,
        OrderTimelineNote.STAGE,
        stage === OrderStage.PURCHASE_UNKNOWN
          ? input.autoFulfillSubmittedAt
          : attempted
            ? input.autoFulfillAttemptedAt
            : null
      )
    );
  }

  // ── Shipped by Amazon ────────────────────────────────────────────────
  if (input.shippedDetectedAt) {
    main.push(step(OrderTimelineStepKey.AMAZON_SHIPPED, DONE, OrderTimelineNote.AMAZON_SHIPPED, input.shippedDetectedAt));
  } else if (fulfilled) {
    main.push(step(OrderTimelineStepKey.AMAZON_SHIPPED, SKIPPED, OrderTimelineNote.SHIPMENT_NOT_OBSERVED));
  } else if (!saleCancelled) {
    main.push(
      stage === OrderStage.PURCHASED
        ? step(OrderTimelineStepKey.AMAZON_SHIPPED, CURRENT, OrderTimelineNote.WAITING_SHIPMENT)
        : step(OrderTimelineStepKey.AMAZON_SHIPPED, UPCOMING, OrderTimelineNote.UPCOMING_SHIPMENT)
    );
  }

  // ── Tracking on eBay ─────────────────────────────────────────────────
  if (input.ebayTrackingPushedAt) {
    main.push(
      step(
        OrderTimelineStepKey.EBAY_TRACKING,
        DONE,
        OrderTimelineNote.TRACKING_PUSHED,
        input.ebayTrackingPushedAt,
        input.ebayTrackingPushedNumber ?? null
      )
    );
  } else if (fulfilled) {
    main.push(step(OrderTimelineStepKey.EBAY_TRACKING, SKIPPED, OrderTimelineNote.TRACKING_NOT_BY_US));
  } else if (!saleCancelled) {
    main.push(
      stage === OrderStage.TRACKING_HELD
        ? step(
            OrderTimelineStepKey.EBAY_TRACKING,
            // "Waiting" for the first hours, "a problem" after — the badge's rule.
            isTrackingHeldOverdue(input.shippedDetectedAt, input.now) ? ATTENTION : CURRENT,
            OrderTimelineNote.STAGE
          )
        : step(OrderTimelineStepKey.EBAY_TRACKING, UPCOMING, OrderTimelineNote.UPCOMING_TRACKING)
    );
  }

  // ── Delivered ────────────────────────────────────────────────────────
  if (stage === OrderStage.DELIVERED) {
    main.push(step(OrderTimelineStepKey.DELIVERED, DONE, OrderTimelineNote.DELIVERED, input.deliveredAt));
  } else if (stage === OrderStage.SHIPPED) {
    // Delivery is read from the Amazon order; without one nothing polls it.
    main.push(
      purchaseProven
        ? step(OrderTimelineStepKey.DELIVERED, CURRENT, OrderTimelineNote.WAITING_DELIVERY)
        : step(OrderTimelineStepKey.DELIVERED, SKIPPED, OrderTimelineNote.DELIVERY_NOT_TRACKED)
    );
  } else if (!saleCancelled) {
    main.push(step(OrderTimelineStepKey.DELIVERED, UPCOMING, OrderTimelineNote.UPCOMING_DELIVERY));
  }

  // ── The sale was cancelled on eBay ───────────────────────────────────
  // Only what did happen stays above it; this step ends the timeline. It asks
  // for the seller only while a real Amazon order is still open for the sale
  // (the platform never cancels an Amazon order).
  if (saleCancelled) {
    main.push(
      step(
        OrderTimelineStepKey.SALE_CANCELLED,
        realAmazonOrderId && !input.amazonCancelledAt ? ATTENTION : SKIPPED,
        OrderTimelineNote.STAGE,
        input.ebayCancelledAt
      )
    );
  }

  const messages = messageSteps(input.messages ?? []);
  const timeline: OrderTimelineStepDto[] = [];
  const placedAnchors = new Set<OrderTimelineStepKey>();
  for (const row of main) {
    // A message whose own step is gone (a cancelled sale drops the steps that
    // never happened) is still a fact: list it before the closing step.
    if (row.key === OrderTimelineStepKey.SALE_CANCELLED) {
      for (const [anchor, rows] of messages) {
        if (!placedAnchors.has(anchor)) {
          timeline.push(...rows);
        }
      }
    }
    timeline.push(row);
    placedAnchors.add(row.key);
    timeline.push(...(messages.get(row.key) ?? []));
  }
  return timeline;
}
