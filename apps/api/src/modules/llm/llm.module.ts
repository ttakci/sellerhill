import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';
import { AdminModule } from '../admin/admin.module';

import { LlmUsageService } from './llm-usage.service';
import { LlmService } from './llm.service';

@Module({
  imports: [ConfigModule, DatabaseModule, AdminModule],
  providers: [LlmService, LlmUsageService],
  exports: [LlmService, LlmUsageService],
})
export class LlmModule {}
