/**
 * Account-scope separation: a SellerHill account is either a seller account or a
 * staff account, never both.
 *
 * Two things are locked here:
 *   1. `JwtAuthGuard` refuses ADMIN/SUPPORT on any route that is not marked
 *      `@OperatorSurface()`. Fail-closed is the point — a controller that
 *      forgets the decorator rejects staff rather than silently re-merging the
 *      seller app and the operator console.
 *   2. The set of operator surfaces is exactly the five controllers below.
 *      Marking a seller controller as an operator surface would hand staff
 *      accounts a customer's data back, so it must be a deliberate edit here.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@repo/shared';

import { JwtAuthGuard } from './jwt-auth.guard';

/* The real base class performs a passport handshake; authentication itself is
   not what this spec is about. ts-jest hoists this above the import above. */
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () =>
    class {
      canActivate(): Promise<boolean> {
        return Promise.resolve(true);
      }
    },
}));

const MODULES_DIR = join(__dirname, '..');

/** Controllers staff accounts may reach. Everything else is seller-only. */
const OPERATOR_SURFACES = ['admin/admin.controller.ts', 'auth/auth.controller.ts', 'profile/profile.controller.ts'];

/** A sample of seller surfaces — none of them may open up to staff. */
const CUSTOMER_SURFACES = [
  'listings/listings.controller.ts',
  'orders/orders.controller.ts',
  'dashboard/dashboard.controller.ts',
  'billing/billing.controller.ts',
  'amazon/amazon.controller.ts',
  'ebay/ebay.controller.ts',
  'store-settings/store-settings.controller.ts',
  'buyer-messaging/buyer-message.controller.ts',
  'listing-settings-groups/listing-settings-group.controller.ts',
];

function contextFor(role: UserRole): Parameters<InstanceType<typeof JwtAuthGuard>['canActivate']>[0] {
  const request = { headers: {}, user: { role } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (): void => undefined,
    getClass: () => class {},
  } as unknown as Parameters<InstanceType<typeof JwtAuthGuard>['canActivate']>[0];
}

function guardFor(isOperatorSurface: boolean): InstanceType<typeof JwtAuthGuard> {
  const reflector = { getAllAndOverride: (): boolean => isOperatorSurface };
  return new JwtAuthGuard(reflector as never);
}

describe('JwtAuthGuard account scope', () => {
  it('lets a customer through a customer surface', async () => {
    await expect(guardFor(false).canActivate(contextFor(UserRole.CUSTOMER))).resolves.toBe(true);
  });

  it('refuses staff accounts on a customer surface', async () => {
    for (const role of [UserRole.ADMIN, UserRole.SUPPORT]) {
      await expect(guardFor(false).canActivate(contextFor(role))).rejects.toThrow(ForbiddenException);
    }
  });

  it('lets staff accounts through an operator surface', async () => {
    for (const role of [UserRole.ADMIN, UserRole.SUPPORT]) {
      await expect(guardFor(true).canActivate(contextFor(role))).resolves.toBe(true);
    }
  });

  it('leaves customers unaffected by the operator marker (RolesGuard owns that gate)', async () => {
    await expect(guardFor(true).canActivate(contextFor(UserRole.CUSTOMER))).resolves.toBe(true);
  });
});

describe('operator surface inventory', () => {
  it.each(OPERATOR_SURFACES)('%s is marked @OperatorSurface()', (file) => {
    expect(readFileSync(join(MODULES_DIR, file), 'utf8')).toContain('@OperatorSurface()');
  });

  it.each(CUSTOMER_SURFACES)('%s stays seller-only', (file) => {
    expect(readFileSync(join(MODULES_DIR, file), 'utf8')).not.toContain('@OperatorSurface()');
  });
});
