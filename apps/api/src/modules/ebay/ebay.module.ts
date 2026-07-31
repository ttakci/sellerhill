import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { EbayFulfillmentService } from '../orders/ebay-fulfillment.service';

import { AspectLlmService } from './aspect-llm.service';
import { AspectResolverService } from './aspect-resolver.service';
import { EbayOAuthService } from './ebay-oauth.service';
import { EbayTaxonomyService } from './ebay-taxonomy.service';
import { EbayController } from './ebay.controller';
import { EbayService } from './ebay.service';


@Module({
  // LlmModule: item-specific selection runs on the CONTENT provider group
  // (local by default), never the assistant's paid one.
  imports: [ConfigModule, AuthModule, DatabaseModule, LlmModule],
  controllers: [EbayController],
  providers: [
    EbayService,
    EbayOAuthService,
    EbayTaxonomyService,
    AspectResolverService,
    AspectLlmService,
    EmailVerifiedGuard,
    EbayFulfillmentService,
  ],
  exports: [EbayService, EbayFulfillmentService, EbayTaxonomyService, AspectResolverService],
})
export class EbayModule {}
