import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { StoreSettingsResponse } from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { SaveStoreSettingsDto } from './dto/save-store-settings.dto';
import { StoreSettingsService } from './store-settings.service';

@Controller({ path: 'store-settings', version: '1' })
@UseGuards(JwtAuthGuard)
export class StoreSettingsController {
  constructor(private readonly storeSettingsService: StoreSettingsService) {}

  @Get('all')
  async listSettings(
    @Request() req: { user: { sub: string } },
  ): Promise<StoreSettingsResponse[]> {
    return this.storeSettingsService.listSettings(req.user.sub);
  }

  @Get()
  async getSettings(
    @Request() req: { user: { sub: string } },
    @Query('storeId') storeId?: string
  ): Promise<StoreSettingsResponse> {
    return this.storeSettingsService.getSettings(req.user.sub, storeId);
  }

  @Post()
  async saveSettings(
    @Request() req: { user: { sub: string } },
    @Body() dto: SaveStoreSettingsDto
  ): Promise<StoreSettingsResponse> {
    return this.storeSettingsService.saveSettings(req.user.sub, dto);
  }
}
