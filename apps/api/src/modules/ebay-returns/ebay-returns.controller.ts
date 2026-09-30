// apps/api/src/modules/ebay-returns/ebay-returns.controller.ts

import { BadRequestException, Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PaginatedReturnsDto, ReturnBucketCountsDto, ReturnTab } from '@repo/shared';
import { isUUID } from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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

/**
 * eBay returns — the seller's own, read from `ebay_returns`. A customer
 * surface (staff roles are refused by `JwtAuthGuard`), read-only: there is no
 * route that writes to eBay.
 */
@ApiTags('returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'returns', version: '1' })
export class EbayReturnsController {
  constructor(private readonly returns: EbayReturnsService) {}

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
  list(
    @Request() req: AuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tab') tab?: string,
    @Query('ebayAccountId') ebayAccountId?: string,
    @Query('search') search?: string
  ): Promise<PaginatedReturnsDto> {
    return this.returns.list(req.user.sub, {
      page: parsePositiveInt(page),
      limit: parsePositiveInt(limit),
      tab: parseTab(tab),
      ebayAccountId: parseAccountId(ebayAccountId),
      search: typeof search === 'string' && search.trim() !== '' ? search.trim() : undefined,
    });
  }
}
