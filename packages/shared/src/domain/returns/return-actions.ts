// packages/shared/src/domain/returns/return-actions.ts
//
// The return actions a seller can take INSIDE SellerHill, and the rule that
// decides when each is offered. Everything else a return may need (decline,
// buying an eBay label, a message, an escalation) is done on eBay — those
// calls are either undocumented in the local eBay reference
// (docs/ebay-reference/post-order/) or need enum values that reference does
// not carry, and a guessed enum value is not something to send with real
// money behind it.

import { EbayReturnAction, EbayReturnSellerActivity, ReturnLabelCarrier } from './returns.types';

/**
 * The eBay `ActivityOptionEnum` value (`sellerAvailableOptions[].actionType`)
 * that must be listed on the return for the in-app action to be offered.
 * Read from a LIVE `GET /post-order/v2/return/{returnId}` right before the
 * action runs — never from the stored row, which may be hours old. Both label
 * actions answer the same option: eBay asks the seller to provide a label, and
 * the seller either uploads one or says one was already sent.
 */
export const RETURN_ACTION_EBAY_OPTION: Readonly<Record<EbayReturnAction, string>> = {
  [EbayReturnAction.APPROVE]: EbayReturnSellerActivity.SELLER_APPROVE_REQUEST,
  [EbayReturnAction.PROVIDE_LABEL]: EbayReturnSellerActivity.SELLER_PROVIDE_LABEL,
  [EbayReturnAction.MARK_LABEL_SENT]: EbayReturnSellerActivity.SELLER_PROVIDE_LABEL,
  [EbayReturnAction.MARK_RECEIVED]: EbayReturnSellerActivity.SELLER_MARK_AS_RECEIVED,
  [EbayReturnAction.ISSUE_REFUND]: EbayReturnSellerActivity.SELLER_ISSUE_REFUND,
};

/** Display order of the offered actions (the enum's own order). */
const ACTION_ORDER: readonly EbayReturnAction[] = Object.values(EbayReturnAction);

export function isEbayReturnAction(value: unknown): value is EbayReturnAction {
  return typeof value === 'string' && (ACTION_ORDER as readonly string[]).includes(value);
}

/**
 * Which in-app actions a return offers right now: the ones whose eBay option
 * is listed, in a fixed order (approve → label → mark received → refund), and
 * none at all while the operator's switch (`ebay.returns.actionsEnabled`) is off.
 */
export function resolveReturnActions(ebayOptions: readonly string[], actionsEnabled: boolean): EbayReturnAction[] {
  if (!actionsEnabled) {
    return [];
  }
  const listed = new Set(ebayOptions);
  return ACTION_ORDER.filter((action) => listed.has(RETURN_ACTION_EBAY_OPTION[action]));
}

/** The largest label file accepted (bytes) — a label is one page. */
export const RETURN_LABEL_MAX_BYTES = 5 * 1024 * 1024;

/**
 * The label file types eBay accepts: "For shipping labels, the system accepts
 * either an image (BMP, GIF, JPEG, and PNG files) or a PDF file"
 * (post-order_v2_return-returnid_file_upload__post.txt).
 */
export const RETURN_LABEL_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/bmp',
];

/** The `accept` attribute of the label file picker. */
export const RETURN_LABEL_ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.bmp';

const CARRIERS: readonly string[] = Object.values(ReturnLabelCarrier);

export function isReturnLabelCarrier(value: unknown): value is ReturnLabelCarrier {
  return typeof value === 'string' && CARRIERS.includes(value);
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
  /** provide_label sent with no file. */
  LABEL_FILE_REQUIRED: 'returns.errors.labelFileRequired',
  /** The file is not a PDF / image, or is larger than RETURN_LABEL_MAX_BYTES. */
  LABEL_FILE_INVALID: 'returns.errors.labelFileInvalid',
  /** provide_label sent without a carrier, a carrier name for OTHER, or a tracking number. */
  LABEL_DETAILS_REQUIRED: 'returns.errors.labelDetailsRequired',
} as const;

export type ReturnActionErrorKey = (typeof RETURN_ACTION_ERROR_KEY)[keyof typeof RETURN_ACTION_ERROR_KEY];
