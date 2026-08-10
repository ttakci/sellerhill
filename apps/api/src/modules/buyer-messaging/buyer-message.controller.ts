import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  buyerMessageTemplateSchema,
  buyerMessagingConfigSchema,
  type BuyerMessageTemplate,
  type BuyerMessagingConfig,
} from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoreSettingsService } from '../store-settings/store-settings.service';

import { BuyerMessageTemplateRepository } from './buyer-message-template.repository';
import {
  CreateBuyerMessageTemplateDto,
  ListBuyerMessageTemplatesQueryDto,
  SaveBuyerMessagingDto,
  UpdateBuyerMessageTemplateDto,
} from './buyer-message.dto';

interface UserRequest {
  user: { sub: string };
}

@Controller({ path: 'store-settings/buyer-messaging', version: '1' })
@UseGuards(JwtAuthGuard)
export class BuyerMessagingSettingsController {
  constructor(private readonly settings: StoreSettingsService) {}

  @Get()
  async getConfig(
    @Request() req: UserRequest,
    @Query('storeId') storeId?: string,
  ): Promise<BuyerMessagingConfig | null> {
    const settings = await this.settings.getResolvedSettings(req.user.sub, storeId ?? null);
    return settings.buyerMessaging ?? null;
  }

  @Put()
  async saveConfig(
    @Request() req: UserRequest,
    @Body() dto: SaveBuyerMessagingDto,
    @Query('storeId') storeId?: string,
  ): Promise<BuyerMessagingConfig> {
    const buyerMessaging = buyerMessagingConfigSchema.parse({
      enabled: dto.enabled,
      events: dto.events,
    });
    const existing = await this.settings.getSettings(req.user.sub, storeId);

    const saved = await this.settings.saveSettings(req.user.sub, {
      isGlobal: !storeId,
      storeId,
      country: existing.country,
      state: existing.state,
      zipCode: existing.zipCode,
      blacklist: existing.blacklist.map(({ keyword, types }) => ({ keyword, types })),
      amazonTaxRate: existing.amazonTaxRate,
      autoFulfillEnabled: existing.autoFulfillEnabled,
      trackingConversionProvider: existing.trackingConversionProvider,
      buyerMessaging,
    });

    return saved.buyerMessaging ?? buyerMessaging;
  }
}

@Controller({ path: 'buyer-messaging/templates', version: '1' })
@UseGuards(JwtAuthGuard)
export class BuyerMessageTemplateController {
  constructor(private readonly templates: BuyerMessageTemplateRepository) {}

  @Get()
  async listTemplates(
    @Request() req: UserRequest,
    @Query() query: ListBuyerMessageTemplatesQueryDto,
  ): Promise<BuyerMessageTemplate[]> {
    await this.templates.ensureSeeded(req.user.sub);
    return this.templates.list(req.user.sub, query.eventType);
  }

  @Post()
  createTemplate(
    @Request() req: UserRequest,
    @Body() dto: CreateBuyerMessageTemplateDto,
  ): Promise<BuyerMessageTemplate> {
    const parsed = buyerMessageTemplateSchema.parse(dto);
    return this.templates.create(req.user.sub, {
      ...parsed,
      locale: parsed.locale ?? 'en',
    });
  }

  @Put(':id')
  async updateTemplate(
    @Request() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBuyerMessageTemplateDto,
  ): Promise<BuyerMessageTemplate> {
    const updated = await this.templates.update(req.user.sub, id, dto);
    if (!updated) {
      throw new NotFoundException();
    }
    return updated;
  }

  @Delete(':id')
  async deleteTemplate(
    @Request() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const deleted = await this.templates.delete(req.user.sub, id);
    if (!deleted) {
      throw new NotFoundException();
    }
  }

  @Post(':id/reset')
  async resetTemplate(
    @Request() req: UserRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BuyerMessageTemplate> {
    const reset = await this.templates.resetToDefault(req.user.sub, id);
    if (!reset) {
      throw new NotFoundException();
    }
    return reset;
  }
}
