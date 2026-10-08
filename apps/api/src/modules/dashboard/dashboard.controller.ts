import { BadRequestException, Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  DashboardRangeError,
  DashboardRangePreset,
  DEFAULT_DASHBOARD_RANGE_PRESET,
  type DashboardDataDto,
  type DashboardRangeInput,
} from '@repo/shared';
import { isUUID } from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { DashboardService } from './dashboard.service';

const INVALID_RANGE = 'dashboard.errors.invalidRange';

/**
 * `?ebayAccountId=` is compared against a UUID column; a malformed value
 * would surface as a Postgres cast error (500). Absent/blank = no filter.
 */
export function parseStoreId(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  if (!isUUID(value.trim())) {
    throw new BadRequestException('ebayAccountId must be a UUID');
  }
  return value.trim();
}

/** `?from=&to=` (both, a custom range) wins over `?range=` (a preset); neither → today. */
export function parseRangeInput(range?: unknown, from?: unknown, to?: unknown): DashboardRangeInput {
  // A repeated query param arrives as an array - never call a string method on it.
  for (const value of [range, from, to]) {
    if (value !== undefined && typeof value !== 'string') {
      throw new BadRequestException(INVALID_RANGE);
    }
  }
  return parseValidatedRange(range as string | undefined, from as string | undefined, to as string | undefined);
}

function parseValidatedRange(range?: string, from?: string, to?: string): DashboardRangeInput {
  const f = from?.trim();
  const t = to?.trim();
  if (f || t) {
    if (!f || !t) {
      throw new BadRequestException(INVALID_RANGE);
    }
    return { from: f, to: t };
  }
  const preset = range?.trim();
  if (!preset) {
    return { preset: DEFAULT_DASHBOARD_RANGE_PRESET };
  }
  if (!(Object.values(DashboardRangePreset) as string[]).includes(preset)) {
    throw new BadRequestException(INVALID_RANGE);
  }
  return { preset: preset as DashboardRangePreset };
}

/** The class can cross the CJS boundary as a different copy; fall back to the name. */
export function isRangeError(error: unknown): boolean {
  return error instanceof DashboardRangeError || (error as Error | undefined)?.name === 'DashboardRangeError';
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
    description: 'Period cards, chart and P&L columns for a preset or custom date range',
  })
  @ApiQuery({
    name: 'range',
    required: false,
    enum: DashboardRangePreset,
    description: 'Preset range (default: today). Ignored when from/to are given.',
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Custom range start, YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Custom range end, YYYY-MM-DD' })
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
    @Query('range') range?: unknown,
    @Query('from') from?: unknown,
    @Query('to') to?: unknown,
    @Query('ebayAccountId') ebayAccountId?: string,
  ): Promise<DashboardDataDto> {
    const input = parseRangeInput(range, from, to);
    try {
      return await this.dashboardService.getDashboard(req.user.sub, input, parseStoreId(ebayAccountId));
    } catch (error) {
      if (isRangeError(error)) {
        throw new BadRequestException(INVALID_RANGE);
      }
      throw error;
    }
  }
}
