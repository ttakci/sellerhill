import { AquilineProblemCode, isAquilineProblemCode } from '@repo/shared';

/**
 * `orders.tracking_problem_code` → the i18n key for its localized sentence.
 *
 * A seller must never see the raw provider enum value (`wrong_page_type`
 * reads as a bug report, not guidance). Nothing writes this column yet — the
 * webhook receiver that does is a separate, later plan — so this also has to
 * hold up against `null`/`undefined` and against a code the provider adds
 * later that we do not know about; both degrade to the generic fallback
 * rather than being printed verbatim or throwing.
 */
const PROBLEM_KEY_MAP: Record<AquilineProblemCode, string> = {
  [AquilineProblemCode.WRONG_PAGE_TYPE]: 'orders.tracking.problem.wrongPageType',
  [AquilineProblemCode.AMAZON_SESSION_EXPIRED]: 'orders.tracking.problem.amazonSessionExpired',
  [AquilineProblemCode.TRACKING_URL_MISMATCH]: 'orders.tracking.problem.trackingUrlMismatch',
  [AquilineProblemCode.NEEDS_TRACKING_UPLOAD]: 'orders.tracking.problem.needsTrackingUpload',
  [AquilineProblemCode.UPDATE_NOT_APPLIED]: 'orders.tracking.problem.updateNotApplied',
  [AquilineProblemCode.ASSIGN_VALIDATION]: 'orders.tracking.problem.assignValidation',
  [AquilineProblemCode.SHIPMENT_EXCEPTION]: 'orders.tracking.problem.shipmentException',
  [AquilineProblemCode.TRACKING_UPDATE_UNAVAILABLE]: 'orders.tracking.problem.trackingUpdateUnavailable',
};

/** Fallback for `null`, `undefined`, or a code outside the known vocabulary. */
export const GENERIC_TRACKING_PROBLEM_KEY = 'orders.tracking.problem.generic';

export const trackingProblemToI18nKey = (code: string | null | undefined): string =>
  code && isAquilineProblemCode(code) ? PROBLEM_KEY_MAP[code] : GENERIC_TRACKING_PROBLEM_KEY;
