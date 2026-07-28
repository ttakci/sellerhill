// apps/api/src/modules/buyer-messaging/buyer-messaging.module.ts
//
// Buyer auto-messaging — settings-driven automated messages to buyers on order
// lifecycle events (order_received / shipped / delivered / feedback_request).
// Producers live in OrdersModule (order_received) and AmazonModule
// (shipped/delivered/feedback_request); this module owns the queue, the worker,
// the provider port, and the REST config/template endpoints.

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { EbayModule } from '../ebay/ebay.module';
import { StoreSettingsModule } from '../store-settings/store-settings.module';

import { BuyerMessageQueueService } from './buyer-message-queue.service';
import { BuyerMessageTemplateRepository } from './buyer-message-template.repository';
import {
  BuyerMessageTemplateController,
  BuyerMessagingSettingsController,
} from './buyer-message.controller';
import { BuyerMessageProcessor } from './buyer-message.processor';
import { EbayMessageApiProvider } from './buyer-message.provider';
import { BuyerMessageService } from './buyer-message.service';
import { BUYER_MESSAGE_QUEUE, BUYER_MESSAGE_TOKEN } from './buyer-messaging.constants';

@Module({
  imports: [
    DatabaseModule,
    EbayModule,
    StoreSettingsModule,
    BullModule.registerQueue({ name: BUYER_MESSAGE_QUEUE }),
  ],
  controllers: [BuyerMessagingSettingsController, BuyerMessageTemplateController],
  providers: [
    BuyerMessageTemplateRepository,
    BuyerMessageService,
    BuyerMessageQueueService,
    BuyerMessageProcessor,
    EbayMessageApiProvider,
    // Token alias: a single EbayMessageApiProvider instance, injectable both by
    // class and by the BUYER_MESSAGE_TOKEN the processor uses.
    { provide: BUYER_MESSAGE_TOKEN, useExisting: EbayMessageApiProvider },
  ],
  exports: [BuyerMessageQueueService, BuyerMessageService],
})
export class BuyerMessagingModule {}
