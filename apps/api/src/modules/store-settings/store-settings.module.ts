import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module';
import { StoreSettingsController } from './store-settings.controller';
import { StoreSettingsService } from './store-settings.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StoreSettingsController],
  providers: [StoreSettingsService],
  exports: [StoreSettingsService],
})
export class StoreSettingsModule {}
