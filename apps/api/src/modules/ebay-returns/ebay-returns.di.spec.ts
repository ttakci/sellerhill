// apps/api/src/modules/ebay-returns/ebay-returns.di.spec.ts
//
// NestJS resolves constructor dependencies from the emitted `design:paramtypes`
// metadata. A dependency imported with `import type`, or one caught in a
// require cycle, is emitted as `Object`/`undefined` — every unit test built on
// hand-made fakes still passes, and the API fails at BOOT ("Nest can't resolve
// dependencies of …"). This spec reads the metadata the container will read.

import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../../common/database/database.service';
import { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayService } from '../ebay/ebay.service';

import { EbayReturnsSyncProcessor } from './ebay-returns-sync.processor';
import { EbayReturnsSyncService } from './ebay-returns-sync.service';
import { EbayReturnsController } from './ebay-returns.controller';
import { EbayReturnsService } from './ebay-returns.service';
import { PostOrderClient } from './post-order.client';

const paramTypes = (target: object): unknown[] =>
  (Reflect.getMetadata('design:paramtypes', target) as unknown[] | undefined) ?? [];

describe('ebay-returns dependency injection metadata', () => {
  it('PostOrderClient resolves its config and the shared call budget', () => {
    expect(paramTypes(PostOrderClient)).toEqual([ConfigService, EbayCallBudgetService]);
  });

  it('EbayReturnsSyncService resolves every collaborator by class', () => {
    expect(paramTypes(EbayReturnsSyncService)).toEqual([
      DatabaseService,
      PlatformSettingsService,
      QuotaEnforcementService,
      EbayService,
      PostOrderClient,
    ]);
  });

  it('EbayReturnsService resolves the database', () => {
    expect(paramTypes(EbayReturnsService)).toEqual([DatabaseService]);
  });

  it('EbayReturnsController resolves the read service', () => {
    expect(paramTypes(EbayReturnsController)).toEqual([EbayReturnsService]);
  });

  it('EbayReturnsSyncProcessor resolves the sweep and the settings after its queue', () => {
    const types = paramTypes(EbayReturnsSyncProcessor);
    expect(types).toHaveLength(3);
    // [0] is the BullMQ queue, injected by token.
    expect(types.slice(1)).toEqual([EbayReturnsSyncService, PlatformSettingsService]);
  });
});
