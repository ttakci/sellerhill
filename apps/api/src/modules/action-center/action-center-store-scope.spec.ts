import { BadRequestException } from '@nestjs/common';
import {
  ActionCenterGroup,
  ActionCenterItemKey,
  ActionCenterSeverity,
  type ActionCenterItemDto,
} from '@repo/shared';

import { parseActionCenterStoreId } from './action-center.controller';
import { isAccountWideItem, scopeItemsToStore, withStoreParam } from './action-center.helpers';

const STORE = '3f1c2a8e-9b7d-4c1e-8a2b-5d6e7f809a1b';

function item(overrides: Partial<ActionCenterItemDto> = {}): ActionCenterItemDto {
  return {
    key: ActionCenterItemKey.ORDER_UNTRACKED,
    group: ActionCenterGroup.ORDERS,
    severity: ActionCenterSeverity.INFO,
    count: 1,
    actionPath: null,
    ...overrides,
  };
}

describe('Action Center store filter', () => {
  describe('withStoreParam', () => {
    it('leaves every link alone without a store', () => {
      expect(withStoreParam('/orders?stage=to_purchase', null)).toBe('/orders?stage=to_purchase');
      expect(withStoreParam('/orders', undefined)).toBe('/orders');
      expect(withStoreParam(null, STORE)).toBeNull();
    });

    it('appends the store to the pages that read ?store=', () => {
      expect(withStoreParam('/orders?stage=to_purchase&tracking=all', STORE)).toBe(
        `/orders?stage=to_purchase&tracking=all&store=${STORE}`,
      );
      expect(withStoreParam('/orders', STORE)).toBe(`/orders?store=${STORE}`);
      expect(withStoreParam('/listings?drawer=import', STORE)).toBe(`/listings?drawer=import&store=${STORE}`);
      expect(withStoreParam('/listings/all?status=draft', STORE)).toBe(`/listings/all?status=draft&store=${STORE}`);
      expect(withStoreParam('/listings/jobs?hasFailures=true', STORE)).toBe(
        `/listings/jobs?hasFailures=true&store=${STORE}`,
      );
      expect(withStoreParam('/returns?tab=action', STORE)).toBe(`/returns?tab=action&store=${STORE}`);
    });

    it('never adds a param a page does not read', () => {
      expect(withStoreParam('/stores', STORE)).toBe('/stores');
      expect(withStoreParam('/settings?drawer=amazonAccounts', STORE)).toBe('/settings?drawer=amazonAccounts');
      expect(withStoreParam('/billing', STORE)).toBe('/billing');
    });
  });

  describe('scopeItemsToStore', () => {
    it('marks plan, setup and Amazon buyer-account items account-wide and keeps their links', () => {
      const scoped = scopeItemsToStore(
        [
          item({ key: ActionCenterItemKey.PLAN_PAST_DUE, group: ActionCenterGroup.PLAN, actionPath: '/billing' }),
          item({
            key: ActionCenterItemKey.SETUP_NO_STORE_SETTINGS,
            group: ActionCenterGroup.SETUP,
            actionPath: '/settings?drawer=storeSettings',
          }),
          item({
            key: ActionCenterItemKey.AMAZON_ACCOUNT_NEEDS_ATTENTION,
            group: ActionCenterGroup.CONNECTIONS,
            actionPath: '/settings?drawer=amazonAccounts',
          }),
        ],
        STORE,
      );
      expect(scoped.map((i) => i.accountWide)).toEqual([true, true, true]);
      expect(scoped.map((i) => i.actionPath)).toEqual([
        '/billing',
        '/settings?drawer=storeSettings',
        '/settings?drawer=amazonAccounts',
      ]);
    });

    it('carries the store on per-store links only when a store is asked for', () => {
      const orders = item({ actionPath: '/orders?stage=to_purchase' });
      expect(scopeItemsToStore([orders], STORE)[0]).toEqual({
        ...orders,
        actionPath: `/orders?stage=to_purchase&store=${STORE}`,
      });
      expect(scopeItemsToStore([orders], null)[0]).toEqual(orders);
      expect(isAccountWideItem(orders)).toBe(false);
    });
  });

  describe('parseActionCenterStoreId', () => {
    it('reads blank as every store', () => {
      expect(parseActionCenterStoreId(undefined)).toBeUndefined();
      expect(parseActionCenterStoreId('  ')).toBeUndefined();
    });

    it('accepts a UUID and refuses anything else with a 400', () => {
      expect(parseActionCenterStoreId(` ${STORE} `)).toBe(STORE);
      expect(() => parseActionCenterStoreId('demo-ebay-1')).toThrow(BadRequestException);
    });
  });
});
