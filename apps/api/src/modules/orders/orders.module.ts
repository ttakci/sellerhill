import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { EbayModule } from '../ebay/ebay.module';
import { ProductsModule } from '../products/products.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';

import { EbayFulfillmentService } from './ebay-fulfillment.service';
import { OrderSyncProcessorService } from './order-sync-processor.service';
import { OrderSyncQueueService } from './order-sync-queue.service';
import { OrderSyncService } from './order-sync.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { StockSyncQueueService } from './stock-sync-queue.service';

@Module({
  imports: [
    DatabaseModule,
    EbayModule,
    ProductsModule,
    StoreSettingsModule,
    BullModule.registerQueue({ name: 'order-sync' }, { name: 'stock-sync' }),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderSyncService,
    EbayFulfillmentService,
    OrderSyncQueueService,
    OrderSyncProcessorService,
    StockSyncQueueService,
  ],
  exports: [OrdersService, OrderSyncService],
})
export class OrdersModule {}
