import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Request,
    UseGuards
} from '@nestjs/common';
import {
    ListingSettingsGroupResponse,
    PredefinedTemplateResponse,
} from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CreateListingSettingsGroupDto } from './dto/create-listing-settings-group.dto';
import { UpdateListingSettingsGroupDto } from './dto/update-listing-settings-group.dto';
import { ListingSettingsGroupService } from './listing-settings-group.service';

@Controller({ path: 'listing-settings-group', version: '1' })
@UseGuards(JwtAuthGuard)
export class ListingSettingsGroupController {
  constructor(private readonly listingSettingsService: ListingSettingsGroupService) {}

  @Get('groups')
  async getListingSettingsGroups(
    @Request() req: any
  ): Promise<ListingSettingsGroupResponse[]> {
    return this.listingSettingsService.getListingSettingsGroups(req.user.sub);
  }

  @Get('groups/:id')
  async getListingSettingsGroupById(
    @Request() req: any,
    @Param('id') id: string
  ): Promise<ListingSettingsGroupResponse> {
    return this.listingSettingsService.getListingSettingsGroupById(req.user.sub, id);
  }

  @Post('groups')
  async createListingSettingsGroup(
    @Request() req: any,
    @Body() dto: CreateListingSettingsGroupDto
  ): Promise<ListingSettingsGroupResponse> {
    return this.listingSettingsService.createListingSettingsGroup(req.user.sub, dto);
  }

  @Put('groups/:id')
  async updateListingSettingsGroup(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateListingSettingsGroupDto
  ): Promise<ListingSettingsGroupResponse> {
    return this.listingSettingsService.updateListingSettingsGroup(req.user.sub, id, dto);
  }

  @Delete('groups/:id')
  async deleteListingSettingsGroup(
    @Request() req: any,
    @Param('id') id: string
  ): Promise<{ success: boolean }> {
    return this.listingSettingsService.deleteListingSettingsGroup(req.user.sub, id);
  }

  @Get('predefined-templates')
  async getPredefinedTemplates(): Promise<PredefinedTemplateResponse[]> {
    return this.listingSettingsService.getPredefinedTemplates();
  }
}
