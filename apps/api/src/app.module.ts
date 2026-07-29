import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { validateEnv } from './common/config/env.validation';
import { DatabaseModule } from './common/database/database.module';
import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';
import { getBullRedisOptions } from './common/redis/redis.config';
import { RedisModule } from './common/redis/redis.module';
import { SettingsModule } from './common/settings/settings.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { AmazonModule } from './modules/amazon/amazon.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { BuyerMessagingModule } from './modules/buyer-messaging/buyer-messaging.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EbayModule } from './modules/ebay/ebay.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { ListingSettingsGroupModule } from './modules/listing-settings-groups/listing-settings-group.module';
import { ListingsModule } from './modules/listings/listings.module';
import { LlmModule } from './modules/llm/llm.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProfileModule } from './modules/profile/profile.module';
import { StoreSettingsModule } from './modules/store-settings/store-settings.module';
import { SupportModule } from './modules/support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
      validate: validateEnv,
      cache: true,
    }),
    // Database connection pool (Global)
    DatabaseModule,
    RedisModule,
    // Runtime platform settings (Global) — DB override -> env -> code default
    SettingsModule,
    // Queue processing configuration
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: getBullRedisOptions(configService),
      }),
    }),
    // Rate limiting configuration
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
      },
    ]),
    HealthModule,
    AuthModule,
    EbayModule,
    DashboardModule,
    StoreSettingsModule,
    ListingSettingsGroupModule,
    ListingsModule,
    ProfileModule,
    AmazonModule,
    BuyerMessagingModule,
    OrdersModule,
    LlmModule,
    AssistantModule,
    SupportModule,
    KnowledgeModule,
    AdminModule,
    BillingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
