import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { ActionCenterController } from './action-center.controller';
import { ActionCenterService } from './action-center.service';

/**
 * Read-only aggregation over tables owned by other modules, exactly like
 * `DashboardModule`. It imports `BillingModule` only for quota resolution —
 * that arithmetic must not be reimplemented here — and nothing imports this
 * module back, so no cycle is introduced.
 */
@Module({
  imports: [AuthModule, DatabaseModule, BillingModule],
  controllers: [ActionCenterController],
  providers: [ActionCenterService],
  exports: [ActionCenterService],
})
export class ActionCenterModule {}
