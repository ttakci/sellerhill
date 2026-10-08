import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { ActionCenterModule } from '../action-center/action-center.module';
import { BillingModule } from '../billing/billing.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { EmailModule } from '../email/email.module';

import { SELLER_DIGEST_QUEUE, SellerDigestProcessor } from './seller-digest.processor';
import { SellerDigestService } from './seller-digest.service';

/**
 * The seller's daily summary e-mail. Reads through the dashboard and Action
 * Center services (never their tables) and nothing imports this module back.
 */
@Module({
  imports: [
    DatabaseModule,
    DashboardModule,
    ActionCenterModule,
    BillingModule,
    EmailModule,
    BullModule.registerQueue({ name: SELLER_DIGEST_QUEUE }),
  ],
  providers: [SellerDigestService, SellerDigestProcessor],
})
export class SellerDigestModule {}
