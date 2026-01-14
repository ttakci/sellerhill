import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseService } from './database.service';

/**
 * Database Module
 * Global module that provides PostgreSQL connection pool
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
