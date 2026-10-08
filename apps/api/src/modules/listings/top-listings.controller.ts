import { BadRequestException, Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DEFAULT_TOP_LISTING_SORT,
  TOP_LISTINGS_DEFAULT_LIMIT,
  TOP_LISTINGS_MAX_LIMIT,
  TopListingSortKey,
  type TopListingsAggregatePage,
  type TopListingsPageDto,
} from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { isRangeError, parseRangeInput, parseStoreId } from '../dashboard/dashboard.controller';
import { DashboardService } from '../dashboard/dashboard.service';

import { ListingsService } from './listings.service';

function parseSort(value: unknown): TopListingSortKey {
  if (value === undefined || value === '') {
    return DEFAULT_TOP_LISTING_SORT;
  }
  if (typeof value !== 'string' || !(Object.values(TopListingSortKey) as string[]).includes(value)) {
    throw new BadRequestException('dashboard.errors.invalidSort');
  }
  return value as TopListingSortKey;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'string') {
    return fallback;
  }
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

/**
 * The dashboard's "Top sellers" tab: listings that sold in the range, ranked.
 * Lives in the listings module because it hydrates full ListingDtos; the
 * aggregation itself belongs to DashboardService (ListingsModule imports
 * DashboardModule, never the reverse).
 */
@ApiTags('dashboard')
@Controller({ path: 'dashboard', version: '1' })
export class TopListingsController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly listingsService: ListingsService
  ) {}

  @Get('top-listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listings that sold in the date range, ranked' })
  async getTopListings(
    @Request() req: { user: { sub: string } },
    @Query('range') range?: unknown,
    @Query('from') from?: unknown,
    @Query('to') to?: unknown,
    @Query('ebayAccountId') ebayAccountId?: string,
    @Query('sortBy') sortBy?: unknown,
    @Query('page') page?: unknown,
    @Query('limit') limit?: unknown
  ): Promise<TopListingsPageDto> {
    const input = parseRangeInput(range, from, to);
    const sort = parseSort(sortBy);
    const pageNo = clampInt(page, 1, 1, Number.MAX_SAFE_INTEGER);
    const size = clampInt(limit, TOP_LISTINGS_DEFAULT_LIMIT, 1, TOP_LISTINGS_MAX_LIMIT);
    let aggregates: TopListingsAggregatePage;
    try {
      aggregates = await this.dashboardService.getTopListings(
        req.user.sub,
        input,
        sort,
        pageNo,
        size,
        parseStoreId(ebayAccountId)
      );
    } catch (error) {
      if (isRangeError(error)) {
        throw new BadRequestException('dashboard.errors.invalidRange');
      }
      throw error;
    }
    const listings = await this.listingsService.getListingsByIds(
      req.user.sub,
      aggregates.rows.map((r) => r.listingId)
    );
    const byId = new Map(listings.map((l) => [l.id, l]));
    const { rows, ...rest } = aggregates;
    return {
      ...rest,
      // A listing deleted after it sold cannot be shown; total stays the SQL count.
      items: rows.flatMap(({ listingId, ...row }) => {
        const listing = byId.get(listingId);
        return listing ? [{ ...row, listing }] : [];
      }),
    };
  }
}
