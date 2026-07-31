/**
 * Account scope — an account is EITHER a customer account or an operator
 * (staff) account, never both.
 *
 * Zonds has two products behind one login:
 *   - the seller app (dashboard / listings / orders / settings), used by
 *     CUSTOMER accounts to run their eBay business;
 *   - the operator console (/admin, /support), used by staff to run Zonds
 *     itself.
 *
 * They used to share one shell and one guard set, so an ADMIN account was a
 * seller account with extra menu items. That is the thing this module removes:
 * the role now decides which product the account can reach at all, on both
 * sides of the wire. The API enforces it in `JwtAuthGuard` (operators are
 * refused on customer surfaces), the web app enforces it in the layout guards
 * (operators never enter the seller shell).
 *
 * Role → surface:
 *   CUSTOMER — seller app only.
 *   SUPPORT  — support console only (answers customer questions; not staff of
 *              the platform's configuration).
 *   ADMIN    — admin panel + support console.
 */

import { UserRole } from './auth.types';

/** Staff roles. Neither may use the seller app. */
export const OPERATOR_ROLES: readonly UserRole[] = [UserRole.ADMIN, UserRole.SUPPORT];

/** True when the account is staff, i.e. must be kept out of the seller app. */
export function isOperatorRole(role: UserRole | null | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPPORT;
}

/** True when the account is a seller account. */
export function isCustomerRole(role: UserRole | null | undefined): boolean {
  return role === UserRole.CUSTOMER;
}
