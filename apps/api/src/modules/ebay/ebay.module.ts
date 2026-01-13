import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EbayOAuthService } from './ebay-oauth.service';
import { EbayController } from './ebay.controller';
import { EbayService } from './ebay.service';

@Module({
  imports: [AuthModule],
  controllers: [EbayController],
  providers: [EbayService, EbayOAuthService],
  exports: [EbayService],
})
export class EbayModule {}
