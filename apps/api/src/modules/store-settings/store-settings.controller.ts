import { Body, Controller, Delete, Get, ParseUUIDPipe, Post, Query, Request, UseGuards } from '@nestjs/common';
import { StoreSettingsResponse } from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { SaveStoreSettingsDto } from './dto/save-store-settings.dto';
import { StoreSettingsService } from './store-settings.service';

@Controller({ path: 'store-settings', version: '1' })
@UseGuards(JwtAuthGuard)
export class StoreSettingsController {
  constructor(private readonly storeSettingsService: StoreSettingsService) {}

  @Get('all')
  async listSettings(@Request() req: { user: { sub: string } }): Promise<StoreSettingsResponse[]> {
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

  /** Drops one store's own settings so it runs on the global ("all stores") row again. */
  @Delete()
  async resetStoreSettings(
    @Request() req: { user: { sub: string } },
    @Query('storeId', ParseUUIDPipe) storeId: string
  ): Promise<{ reset: boolean }> {
    return this.storeSettingsService.resetStoreSettings(req.user.sub, storeId);
  }
}
