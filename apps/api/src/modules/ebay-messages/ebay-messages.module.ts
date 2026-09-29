import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { EbayModule } from '../ebay/ebay.module';

import { EbayMessageClient } from './ebay-message.client';

/**
 * eBay Messages — the seller inbox over eBay's Message API. The controller and
 * service arrive in a later task; for now the module carries the typed client.
 */
@Module({
  imports: [ConfigModule, DatabaseModule, EbayModule],
  controllers: [],
  providers: [EbayMessageClient],
  exports: [EbayMessageClient],
})
export class EbayMessagesModule {}
