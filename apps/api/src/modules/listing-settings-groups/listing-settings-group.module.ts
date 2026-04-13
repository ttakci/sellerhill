import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';

import { ListingSettingsGroupController } from './listing-settings-group.controller';
import { ListingSettingsGroupService } from './listing-settings-group.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ListingSettingsGroupController],
  providers: [ListingSettingsGroupService],
  exports: [ListingSettingsGroupService],
})
export class ListingSettingsGroupModule {}
