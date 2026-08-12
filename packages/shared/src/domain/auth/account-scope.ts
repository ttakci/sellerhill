/**
 * Account scope — an account is EITHER a customer account or an operator
 * (staff) account, never both.
 *
 * SellerHill has two products behind one login:
 *   - the seller app (dashboard / listings / orders / settings), used by
 *     CUSTOMER accounts to run their eBay business;
 *   - the operator console (/admin), used by staff to run SellerHill itself.
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
 *   ADMIN    — admin panel.
 *   SUPPORT  — kept as a role for backward compatibility, but has NO console
 *              today. The in-app support queue/handoff console was removed
 *              (2026-08) when customer support moved to tawk.to, which has
 *              its own agent dashboard outside SellerHill. A SUPPORT-role account
 *              is still blocked from the seller app (still "staff"), but has
 *              no operator surface to land on either — see CLAUDE.md
 *              "Customer support widget — tawk.to". Existing SUPPORT
 *              accounts should be demoted via `pnpm user:set-role`.
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
