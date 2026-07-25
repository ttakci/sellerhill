import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';

import { LlmUsageService } from './llm-usage.service';
import { LlmService } from './llm.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [LlmService, LlmUsageService],
  exports: [LlmService],
})
export class LlmModule {}
