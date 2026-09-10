import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { LlmModule } from '../llm/llm.module';
import { EbayFulfillmentService } from '../orders/ebay-fulfillment.service';

import { AspectLlmService } from './aspect-llm.service';
import { AspectResolverService } from './aspect-resolver.service';
import { EbayAccountDeletionController } from './ebay-account-deletion.controller';
import { EbayAccountDeletionService } from './ebay-account-deletion.service';
import { EbayBulkService } from './ebay-bulk.service';
import { EbayOAuthService } from './ebay-oauth.service';
import { EbayTaxonomyService } from './ebay-taxonomy.service';
import { EbayController } from './ebay.controller';
import { EbayService } from './ebay.service';


@Module({
  // LlmModule: item-specific selection runs on the CONTENT provider group
  // (local by default), never the assistant's paid one.
  // BillingModule: the eBay OAuth callback checks the one-trial-per-store
  // ledger before writing the account row. Billing does not import Ebay, so
  // this does not create a cycle (module-cycle.guard.spec.ts covers that).
  imports: [ConfigModule, AuthModule, DatabaseModule, LlmModule, BillingModule],
  controllers: [EbayController, EbayAccountDeletionController],
  providers: [
    EbayService,
    EbayBulkService,
    EbayOAuthService,
    EbayTaxonomyService,
    AspectResolverService,
    AspectLlmService,
    EmailVerifiedGuard,
    EbayFulfillmentService,
    EbayAccountDeletionService,
  ],
  exports: [
    EbayService,
    EbayBulkService,
    EbayFulfillmentService,
    EbayTaxonomyService,
    AspectResolverService,
  ],
})
export class EbayModule {}
