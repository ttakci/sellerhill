// packages/shared/src/domain/returns/return-actions.ts
//
// The three return actions a seller can take INSIDE SellerHill, and the rule
// that decides when each is offered. Everything else a return may need
// (decline, a shipping label, a message, an escalation) is done on eBay —
// those calls are either undocumented in the local eBay reference
// (docs/ebay-reference/post-order/) or need enum values that reference does
// not carry, and a guessed enum value is not something to send with real
// money behind it.

import { EbayReturnAction, EbayReturnSellerActivity } from './returns.types';

/**
 * The eBay `ActivityOptionEnum` value (`sellerAvailableOptions[].actionType`)
 * that must be listed on the return for the in-app action to be offered.
 * Read from a LIVE `GET /post-order/v2/return/{returnId}` right before the
 * action runs — never from the stored row, which may be hours old.
 */
export const RETURN_ACTION_EBAY_OPTION: Readonly<Record<EbayReturnAction, string>> = {
  [EbayReturnAction.APPROVE]: EbayReturnSellerActivity.SELLER_APPROVE_REQUEST,
  [EbayReturnAction.MARK_RECEIVED]: EbayReturnSellerActivity.SELLER_MARK_AS_RECEIVED,
  [EbayReturnAction.ISSUE_REFUND]: EbayReturnSellerActivity.SELLER_ISSUE_REFUND,
};

const ACTION_VALUES: readonly string[] = Object.values(EbayReturnAction);

export function isEbayReturnAction(value: unknown): value is EbayReturnAction {
  return typeof value === 'string' && ACTION_VALUES.includes(value);
}

/**
 * Which in-app actions a return offers right now: the ones whose eBay option
 * is listed, in a fixed order (approve → mark received → refund), and none at
 * all while the operator's switch (`ebay.returns.actionsEnabled`) is off.
 */
export function resolveReturnActions(
  ebayOptions: readonly string[],
  actionsEnabled: boolean
): EbayReturnAction[] {
  if (!actionsEnabled) {
    return [];
  }
  const listed = new Set(ebayOptions);
  return (Object.keys(RETURN_ACTION_EBAY_OPTION) as EbayReturnAction[]).filter((action) =>
    listed.has(RETURN_ACTION_EBAY_OPTION[action])
  );
}

/** The eBay option values none of the in-app actions covers — shown as "on eBay". */
export function resolveReturnOptionsOnEbay(ebayOptions: readonly string[]): string[] {
  const covered = new Set<string>(Object.values(RETURN_ACTION_EBAY_OPTION));
  return [...new Set(ebayOptions)].filter((option) => !covered.has(option));
}

/** i18n keys the API answers a refused or failed action with (`message`). */
export const RETURN_ACTION_ERROR_KEY = {
  /** The operator has not switched in-app actions on. */
  ACTIONS_DISABLED: 'returns.errors.actionsDisabled',
  /** eBay does not list that option on the return right now. */
  NOT_OFFERED: 'returns.errors.actionNotAvailable',
  SUSPENDED: 'returns.errors.suspended',
  /** eBay refused the call (a 4xx) — the return is in another state, or the amount is wrong. */
  EBAY_REJECTED: 'returns.errors.ebayRejected',
  /** eBay could not be reached, or answered with an error of its own. */
  UNAVAILABLE: 'returns.errors.unavailable',
  /** The Post-Order API has no Sandbox; nothing can be tried here. */
  SANDBOX: 'returns.errors.sandbox',
  /** A refund needs the amount eBay computed; the return carries none. */
  REFUND_AMOUNT_UNKNOWN: 'returns.errors.refundAmountUnknown',
  NOT_FOUND: 'returns.errors.notFound',
} as const;

export type ReturnActionErrorKey = (typeof RETURN_ACTION_ERROR_KEY)[keyof typeof RETURN_ACTION_ERROR_KEY];
