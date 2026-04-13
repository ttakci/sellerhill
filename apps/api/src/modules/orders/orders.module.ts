import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { EbayModule } from '../ebay/ebay.module';

import { EbayFulfillmentService } from './ebay-fulfillment.service';
import { OrderSyncService } from './order-sync.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [DatabaseModule, EbayModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderSyncService, EbayFulfillmentService],
  exports: [OrdersService, OrderSyncService],
})
export class OrdersModule {}
