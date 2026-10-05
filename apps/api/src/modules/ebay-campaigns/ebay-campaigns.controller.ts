import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  CampaignAction,
  type CampaignListingsRequest,
  type CampaignRateRequest,
  type CreateCampaignRequest,
} from '@repo/shared';
import { isUUID } from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CampaignActionError, EbayCampaignActionsService } from './ebay-campaign-actions.service';
import { EbayCampaignsService } from './ebay-campaigns.service';

type AuthedRequest = { user: { sub: string } };

function accountId(value: unknown): string {
  if (typeof value !== 'string' || !isUUID(value.trim()))
    {throw new BadRequestException('campaigns.errors.storeUnavailable');}
  return value.trim();
}

function campaignId(value: unknown): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {throw new BadRequestException('campaigns.errors.notFound');}
  return value;
}

function positiveInt(value: unknown, fallback: number, max: number): number {
  if (value === undefined) {return fallback;}
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw new BadRequestException('campaigns.errors.notFound');
  }
  return Number(value);
}

function bodyAccount(body: unknown): string {
  if (!body || typeof body !== 'object') {throw new BadRequestException('campaigns.errors.storeUnavailable');}
  return accountId((body as { ebayAccountId?: unknown }).ebayAccountId);
}

function rethrow(error: unknown): never {
  if (error instanceof CampaignActionError) {
    const body = error.reason ? { message: error.key, reason: error.reason } : error.key;
    if (error.status === 400) {throw new BadRequestException(body);}
    if (error.status === 403) {throw new ForbiddenException(body);}
    if (error.status === 404) {throw new NotFoundException(body);}
    throw new ConflictException(body);
  }
  throw error;
}

@UseGuards(JwtAuthGuard)
@Controller({ path: 'campaigns', version: '1' })
export class EbayCampaignsController {
  constructor(
    private readonly reads: EbayCampaignsService,
    private readonly actions: EbayCampaignActionsService
  ) {}

  @Get()
  async list(@Request() req: AuthedRequest, @Query('ebayAccountId') id: string) {
    try {
      return await this.reads.list(req.user.sub, accountId(id));
    } catch (error: unknown) {
      rethrow(error);
    }
  }

  @Get('candidates')
  async candidates(@Request() req: AuthedRequest, @Query() query: Record<string, unknown>) {
    const id = accountId(query.ebayAccountId);
    const group = query.listingSettingsGroupId;
    if (group !== undefined && (typeof group !== 'string' || !isUUID(group)))
      {throw new BadRequestException('campaigns.errors.notFound');}
    if (query.search !== undefined && typeof query.search !== 'string')
      {throw new BadRequestException('campaigns.errors.notFound');}
    try {
      return await this.reads.candidates(req.user.sub, {
        ebayAccountId: id,
        listingSettingsGroupId: group ,
        search: query.search ,
        page: positiveInt(query.page, 1, 100000),
        limit: positiveInt(query.limit, 25, 100),
      });
    } catch (error: unknown) {
      rethrow(error);
    }
  }

  @Get(':campaignId')
  async detail(
    @Request() req: AuthedRequest,
    @Param('campaignId') campaign: string,
    @Query('ebayAccountId') id: string
  ) {
    try {
      return await this.reads.detail(req.user.sub, accountId(id), campaignId(campaign));
    } catch (error: unknown) {
      rethrow(error);
    }
  }

  @Post()
  async create(@Request() req: AuthedRequest, @Body() body: CreateCampaignRequest) {
    try {
      return await this.actions.create(req.user.sub, { ...body, ebayAccountId: bodyAccount(body) });
    } catch (error: unknown) {
      rethrow(error);
    }
  }

  @Post(':campaignId/listings/add')
  async add(
    @Request() req: AuthedRequest,
    @Param('campaignId') campaign: string,
    @Body() body: CampaignListingsRequest
  ) {
    try {
      return await this.actions.add(req.user.sub, campaignId(campaign), { ...body, ebayAccountId: bodyAccount(body) });
    } catch (error: unknown) {
      rethrow(error);
    }
  }

  @Post(':campaignId/listings/remove')
  async remove(
    @Request() req: AuthedRequest,
    @Param('campaignId') campaign: string,
    @Body() body: CampaignListingsRequest
  ) {
    try {
      return await this.actions.remove(req.user.sub, campaignId(campaign), {
        ...body,
        ebayAccountId: bodyAccount(body),
      });
    } catch (error: unknown) {
      rethrow(error);
    }
  }

  @Post(':campaignId/rate')
  async rate(@Request() req: AuthedRequest, @Param('campaignId') campaign: string, @Body() body: CampaignRateRequest) {
    try {
      return await this.actions.rate(req.user.sub, campaignId(campaign), { ...body, ebayAccountId: bodyAccount(body) });
    } catch (error: unknown) {
      rethrow(error);
    }
  }

  @Post(':campaignId/actions/:action')
  async action(
    @Request() req: AuthedRequest,
    @Param('campaignId') campaign: string,
    @Param('action') action: string,
    @Body() body: { ebayAccountId?: string } | undefined,
    @Query('ebayAccountId') queryAccountId?: string
  ) {
    if (!Object.values(CampaignAction).includes(action as CampaignAction))
      {throw new BadRequestException('campaigns.errors.ebayRejected');}
    try {
      return await this.actions.action(
        req.user.sub,
        campaignId(campaign),
        accountId(body?.ebayAccountId ?? queryAccountId),
        action as CampaignAction
      );
    } catch (error: unknown) {
      rethrow(error);
    }
  }
}
