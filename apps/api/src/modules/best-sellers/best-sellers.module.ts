import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProductSourceModule } from '../listings/product-source.module';

import { BestSellersController } from './best-sellers.controller';
import { BestSellersService } from './best-sellers.service';

/**
 * Amazon Best Sellers browsing. Depends only on `ProductSourceModule` (the
 * scraper client + proxy list, cycle-safe by design — see its own note) and
 * the global `RedisService` / `PlatformSettingsService`. Nothing imports this
 * module back.
 */
@Module({
  imports: [AuthModule, ProductSourceModule],
  controllers: [BestSellersController],
  providers: [BestSellersService],
})
export class BestSellersModule {}
