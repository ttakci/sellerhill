import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PlatformSettingsService } from './platform-settings.service';

/**
 * Runtime platform settings.
 *
 * Global, like DatabaseModule: settings are consumed by workers, schedulers
 * and controllers across every feature module, and routing that through a
 * per-module import would create cycles (admin -> listings -> admin). The
 * service is read-mostly and cheap (one cached query per 30s).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class SettingsModule {}
