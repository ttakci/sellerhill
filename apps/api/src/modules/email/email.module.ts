import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../common/database/database.module';

import { EmailService } from './email.service';

/**
 * Email Module
 * Provides email sending functionality using Nodemailer + Gmail SMTP
 * Email templates are stored in PostgreSQL database
 */
@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

