import { Global, Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';

import { TimezoneService } from './timezone.service';

/** Global, like PlatformSettingsService — any module can read a seller's day. */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [TimezoneService],
  exports: [TimezoneService],
})
export class TimezoneModule {}
