import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { BillingModule } from '../billing/billing.module';
import { BuyerMessagingModule } from '../buyer-messaging/buyer-messaging.module';
import { EbayModule } from '../ebay/ebay.module';
import { ProductsModule } from '../products/products.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';

import { AutoFulfillQueueService, AUTO_FULFILL_QUEUE } from './auto-fulfill-queue.service';
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
    BillingModule,
    BuyerMessagingModule,
    EbayModule,
    ProductsModule,
    StoreSettingsModule,
    BullModule.registerQueue(
      { name: 'order-sync' },
      { name: 'stock-sync' },
      { name: AUTO_FULFILL_QUEUE },
    ),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderSyncService,
    EbayFulfillmentService,
    OrderSyncQueueService,
    OrderSyncProcessorService,
    StockSyncQueueService,
    AutoFulfillQueueService,
  ],
  exports: [OrdersService, OrderSyncService, AutoFulfillQueueService],
})
export class OrdersModule {}
