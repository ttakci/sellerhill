import { BadRequestException, Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DashboardChartGranularity, type DashboardDataDto } from '@repo/shared';
import { isUUID } from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { DashboardService } from './dashboard.service';

/**
 * `?ebayAccountId=` is compared against a UUID column; a malformed value
 * would surface as a Postgres cast error (500). Absent/blank = no filter.
 */
function parseStoreId(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  if (!isUUID(value.trim())) {
    throw new BadRequestException('ebayAccountId must be a UUID');
  }
  return value.trim();
}

@ApiTags('dashboard')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get dashboard data',
    description: 'Period metrics, chart, history, and recent orders',
  })
  @ApiQuery({
    name: 'chartGranularity',
    required: false,
    enum: DashboardChartGranularity,
    description: 'Chart bucket size: day (30d), week (12w) or month (12m, default)',
  })
  @ApiQuery({
    name: 'ebayAccountId',
    required: false,
    type: String,
    description: 'Filter metrics by eBay store',
  })
  @ApiOkResponse({ description: 'Dashboard data retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  async getDashboard(
    @Request() req: { user: { sub: string } },
    @Query('chartGranularity') chartGranularity?: string,
    @Query('ebayAccountId') ebayAccountId?: string,
  ): Promise<DashboardDataDto> {
    const userId = req.user.sub;
    const granularity = Object.values(DashboardChartGranularity).includes(
      chartGranularity as DashboardChartGranularity,
    )
      ? (chartGranularity as DashboardChartGranularity)
      : DashboardChartGranularity.MONTH;
    return this.dashboardService.getDashboard(userId, granularity, parseStoreId(ebayAccountId));
  }
}
