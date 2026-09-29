import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { EbayModule } from '../ebay/ebay.module';

import { EbayMessageClient } from './ebay-message.client';
import { EbayMessagesController } from './ebay-messages.controller';
import { EbayMessagesService } from './ebay-messages.service';

/**
 * eBay Messages — the seller inbox over eBay's Message API: the typed client,
 * the ownership/unread-bookkeeping service and the `ebay/messages` routes.
 */
@Module({
  imports: [ConfigModule, DatabaseModule, EbayModule],
  controllers: [EbayMessagesController],
  providers: [EbayMessageClient, EbayMessagesService],
  exports: [EbayMessageClient, EbayMessagesService],
})
export class EbayMessagesModule {}
