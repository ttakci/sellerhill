import { SetMetadata } from '@nestjs/common';

export const OPERATOR_SURFACE_KEY = 'auth.operatorSurface';

/**
 * Marks a controller (or a single handler) as an OPERATOR surface: staff
 * accounts — ADMIN and SUPPORT — are allowed to call it.
 *
 * Every authenticated route is a CUSTOMER surface unless it carries this
 * decorator, and `JwtAuthGuard` refuses operator accounts on customer
 * surfaces. That default is deliberate: a new seller-facing controller is
 * separated correctly by doing nothing, and forgetting the decorator fails
 * closed (operators get a 403) instead of silently re-merging the two
 * products.
 *
 * This decorator only widens access for staff. It does not grant customers
 * anything — an operator-only surface still needs `@Roles(...)` to keep
 * customers out (see `admin.controller.ts` / `support.controller.ts`).
 */
export const OperatorSurface = (): ReturnType<typeof SetMetadata> => SetMetadata(OPERATOR_SURFACE_KEY, true);
