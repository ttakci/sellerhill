import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';
import { AuthModule } from '../auth/auth.module';
import { EbayFulfillmentService } from '../orders/ebay-fulfillment.service';

import { EbayOAuthService } from './ebay-oauth.service';
import { EbayController } from './ebay.controller';
import { EbayService } from './ebay.service';


@Module({
  imports: [ConfigModule, AuthModule, DatabaseModule],
  controllers: [EbayController],
  providers: [EbayService, EbayOAuthService, EmailVerifiedGuard, EbayFulfillmentService],
  exports: [EbayService, EbayFulfillmentService],
})
export class EbayModule {}
