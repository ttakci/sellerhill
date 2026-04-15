import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
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
    description: 'Retrieve dashboard metrics, revenue trend, and recent orders',
  })
  @ApiOkResponse({ description: 'Dashboard data retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  async getDashboard(@Request() req: { user: { sub: string } }): Promise<DashboardDataDto> {
    const userId = req.user.sub;
    return this.dashboardService.getDashboard(userId);
  }
}
