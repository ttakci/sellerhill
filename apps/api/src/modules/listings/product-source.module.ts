import { Module } from '@nestjs/common';

import { ProductSourceService } from './product-source.service';
import { ScraperClient } from './scraper.client';

/**
 * `ScraperClient` + `ProductSourceService` in their own module, separate from
 * `ListingsModule`.
 *
 * `ListingsModule` already imports `AdminModule` (see `listings.module.ts`),
 * so `AdminModule` importing `ListingsModule` back (Task 12's admin scraper
 * observability tab) would close a direct cycle: `AdminModule -> ListingsModule
 * -> AdminModule`. This module depends on nothing feature-specific — only the
 * globally-registered `PlatformSettingsService` (`common/settings`) and
 * `ConfigService` (`@nestjs/config`), both `@Global()` and already available
 * app-wide with no import needed — so both `ListingsModule` and `AdminModule`
 * can import it directly with no risk of a cycle.
 */
@Module({
  providers: [ScraperClient, ProductSourceService],
  exports: [ScraperClient, ProductSourceService],
})
export class ProductSourceModule {}
