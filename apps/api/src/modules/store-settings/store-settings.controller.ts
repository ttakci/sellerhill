import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import {
    StoreSettingsResponse
} from '@repo/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoreSettingsService } from './store-settings.service';
import { SaveStoreSettingsDto } from './dto/save-store-settings.dto';

@Controller({ path: 'store-settings', version: '1' })
@UseGuards(JwtAuthGuard)
export class StoreSettingsController {
  constructor(private readonly storeSettingsService: StoreSettingsService) {}

  @Get()
  async getSettings(
    @Request() req: any,
    @Query('storeId') storeId?: string
  ): Promise<StoreSettingsResponse> {
    return this.storeSettingsService.getSettings(req.user.sub, storeId);
  }

  @Post()
  async saveSettings(
    @Request() req: any,
    @Body() dto: SaveStoreSettingsDto
  ): Promise<StoreSettingsResponse> {
    return this.storeSettingsService.saveSettings(req.user.sub, dto);
  }
}
