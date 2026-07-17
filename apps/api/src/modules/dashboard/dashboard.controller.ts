import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { DashboardDataDto } from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { DashboardService } from './dashboard.service';

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
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days for daily revenue trend (default: 14)',
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
    @Query('days') days?: number,
    @Query('ebayAccountId') ebayAccountId?: string,
  ): Promise<DashboardDataDto> {
    const userId = req.user.sub;
    return this.dashboardService.getDashboard(userId, days, ebayAccountId);
  }
}
