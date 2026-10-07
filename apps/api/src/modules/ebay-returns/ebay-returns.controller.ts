// apps/api/src/modules/ebay-returns/ebay-returns.controller.ts

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
  EbayReturnActionResultDto,
  EbayReturnDetailDto,
  isEbayReturnAction,
  PaginatedReturnsDto,
  ReturnBucketCountsDto,
  ReturnTab,
} from '@repo/shared';
import { isUUID } from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { EbayReturnsActionsService, ReturnActionError } from './ebay-returns-actions.service';
import { EbayReturnsService } from './ebay-returns.service';

type AuthedRequest = { user: { sub: string } };

const RETURN_TAB_VALUES: readonly string[] = Object.values(ReturnTab);

/** An unknown tab is ignored (no filter), never forwarded. */
function parseTab(value: string | undefined): ReturnTab | undefined {
  return value !== undefined && RETURN_TAB_VALUES.includes(value) ? (value as ReturnTab) : undefined;
}

/**
 * The store filter is cast to uuid in SQL, so anything else is refused here
 * rather than reaching the database. An empty value means no filter.
 */
function parseAccountId(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  if (!isUUID(value.trim())) {
    throw new BadRequestException('ebayAccountId must be a UUID');
  }
  return value.trim();
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseReturnId(value: string): string {
  if (!isUUID(value)) {
    throw new BadRequestException('id must be a UUID');
  }
  return value;
}

/** A refused or failed action keeps its i18n key as the message and takes the status the service chose. */
function rethrowReturnAction(error: unknown): never {
  if (error instanceof ReturnActionError) {
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
 * eBay returns — the seller's own. The list and the counts read
 * `ebay_returns`; the detail adds one live eBay read; the ONE write route
 * (`POST :id/actions/:action`) performs a documented Post-Order action
 * through `EbayReturnsActionsService`, which holds every gate. A customer
 * surface (staff roles are refused by `JwtAuthGuard`).
 */
@ApiTags('returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'returns', version: '1' })
export class EbayReturnsController {
  constructor(
    private readonly returns: EbayReturnsService,
    private readonly actions: EbayReturnsActionsService
  ) {}

  // Declared before any parameterised route, so `counts` can never be read as an id.
  @Get('counts')
  @ApiOperation({ summary: 'How many of the seller’s eBay returns sit in each bucket' })
  @ApiQuery({ name: 'ebayAccountId', required: false, description: 'eBay account id (UUID)' })
  counts(
    @Request() req: AuthedRequest,
    @Query('ebayAccountId') ebayAccountId?: string
  ): Promise<ReturnBucketCountsDto> {
    return this.returns.counts(req.user.sub, { ebayAccountId: parseAccountId(ebayAccountId) });
  }

  @Get()
  @ApiOperation({ summary: 'One page of the seller’s eBay returns' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'tab', required: false, enum: ReturnTab })
  @ApiQuery({ name: 'ebayAccountId', required: false, description: 'eBay account id (UUID)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['openedAt', 'dueBy', 'refund'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  list(
    @Request() req: AuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tab') tab?: string,
    @Query('ebayAccountId') ebayAccountId?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string
  ): Promise<PaginatedReturnsDto> {
    return this.returns.list(req.user.sub, {
      page: parsePositiveInt(page),
      limit: parsePositiveInt(limit),
      tab: parseTab(tab),
      ebayAccountId: parseAccountId(ebayAccountId),
      search: typeof search === 'string' && search.trim() !== '' ? search.trim() : undefined,
      sortBy: sortBy === 'openedAt' || sortBy === 'dueBy' || sortBy === 'refund' ? sortBy : undefined,
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    });
  }

  @Get(':id/detail')
  @ApiOperation({ summary: 'One return in full: the stored row plus a live read from eBay' })
  async detail(@Request() req: AuthedRequest, @Param('id') id: string): Promise<EbayReturnDetailDto> {
    try {
      return await this.actions.detail(req.user.sub, parseReturnId(id));
    } catch (error) {
      rethrowReturnAction(error);
    }
  }

  @Post(':id/actions/:action')
  @ApiOperation({ summary: 'Approve the return, mark the item received or issue the refund on eBay' })
  async act(
    @Request() req: AuthedRequest,
    @Param('id') id: string,
    @Param('action') action: string
  ): Promise<EbayReturnActionResultDto> {
    if (!isEbayReturnAction(action)) {
      throw new BadRequestException('unknown return action');
    }
    try {
      return await this.actions.act(req.user.sub, parseReturnId(id), action);
    } catch (error) {
      rethrowReturnAction(error);
    }
  }
}
