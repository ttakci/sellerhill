// apps/api/src/modules/ebay-returns/ebay-cancellations.controller.ts

import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Request,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  CancellationBucketCountsDto,
  CancellationTab,
  EbayCancellationActionResultDto,
  EbayCancellationDetailDto,
  isEbayCancellationAction,
  PaginatedCancellationsDto,
} from '@repo/shared';
import { isUUID } from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CancellationActionError, EbayCancellationsActionsService } from './ebay-cancellations-actions.service';

type AuthedRequest = { user: { sub: string } };

const CANCELLATION_TAB_VALUES: readonly string[] = Object.values(CancellationTab);

/** An unknown tab is ignored (no filter), never forwarded. */
function parseTab(value: string | undefined): CancellationTab | undefined {
  return value !== undefined && CANCELLATION_TAB_VALUES.includes(value) ? (value as CancellationTab) : undefined;
}

function parseUuid(value: string | undefined, name: string): string | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  if (!isUUID(value.trim())) {
    throw new BadRequestException(`${name} must be a UUID`);
  }
  return value.trim();
}

function requireUuid(value: string): string {
  const id = parseUuid(value, 'id');
  if (!id) {
    throw new BadRequestException('id must be a UUID');
  }
  return id;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Same mapping as the returns controller: the i18n key is the message, the service picked the status. */
function rethrowCancellationAction(error: unknown): never {
  if (error instanceof CancellationActionError) {
    if (error.status === 404) {
      throw new NotFoundException(error.key);
    }
    if (error.status === 503) {
      throw new ServiceUnavailableException(error.key);
    }
    throw new ConflictException(error.key);
  }
  throw error;
}

/**
 * eBay buyer cancellation requests — the seller's own (the Cancellations
 * page). The list and the counts read `ebay_cancellations`; the detail adds
 * one live eBay read; the ONE write route answers a request through
 * `EbayCancellationsActionsService`, which holds every gate. A customer
 * surface (`JwtAuthGuard`).
 */
@ApiTags('cancellations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'cancellations', version: '1' })
export class EbayCancellationsController {
  constructor(private readonly actions: EbayCancellationsActionsService) {}

  // Declared before any parameterised route, so `counts` can never be read as an id.
  @Get('counts')
  @ApiOperation({ summary: 'How many of the seller’s eBay buyer cancellation requests sit in each bucket' })
  @ApiQuery({ name: 'ebayAccountId', required: false, description: 'eBay account id (UUID)' })
  counts(
    @Request() req: AuthedRequest,
    @Query('ebayAccountId') ebayAccountId?: string
  ): Promise<CancellationBucketCountsDto> {
    return this.actions.counts(req.user.sub, { ebayAccountId: parseUuid(ebayAccountId, 'ebayAccountId') });
  }

  @Get()
  @ApiOperation({ summary: 'One page of the seller’s eBay buyer cancellation requests' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'tab', required: false, enum: CancellationTab })
  @ApiQuery({ name: 'ebayAccountId', required: false, description: 'eBay account id (UUID)' })
  @ApiQuery({ name: 'search', required: false, description: 'Cancel id, eBay order id or product title' })
  @ApiQuery({ name: 'orderId', required: false, description: 'SellerHill order id (UUID)' })
  list(
    @Request() req: AuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tab') tab?: string,
    @Query('ebayAccountId') ebayAccountId?: string,
    @Query('search') search?: string,
    @Query('orderId') orderId?: string
  ): Promise<PaginatedCancellationsDto> {
    return this.actions.list(req.user.sub, {
      page: parsePositiveInt(page),
      limit: parsePositiveInt(limit),
      tab: parseTab(tab),
      ebayAccountId: parseUuid(ebayAccountId, 'ebayAccountId'),
      search: typeof search === 'string' && search.trim() !== '' ? search.trim() : undefined,
      orderId: parseUuid(orderId, 'orderId'),
    });
  }

  @Get(':id/detail')
  @ApiOperation({ summary: 'One cancellation request in full: the stored row plus a live read from eBay' })
  async detail(@Request() req: AuthedRequest, @Param('id') id: string): Promise<EbayCancellationDetailDto> {
    try {
      return await this.actions.detail(req.user.sub, requireUuid(id));
    } catch (error) {
      rethrowCancellationAction(error);
    }
  }

  @Post(':id/actions/:action')
  @ApiOperation({ summary: 'Approve or reject a buyer’s cancellation request on eBay' })
  async act(
    @Request() req: AuthedRequest,
    @Param('id') id: string,
    @Param('action') action: string
  ): Promise<EbayCancellationActionResultDto> {
    if (!isEbayCancellationAction(action)) {
      throw new BadRequestException('unknown cancellation action');
    }
    try {
      return await this.actions.act(req.user.sub, requireUuid(id), action);
    } catch (error) {
      rethrowCancellationAction(error);
    }
  }
}
