import { BadRequestException, Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type ActionCenterSummaryDto } from '@repo/shared';
import { isUUID } from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { ActionCenterService } from './action-center.service';

/**
 * `?ebayAccountId=` is compared against a UUID column; a malformed value would
 * surface as a Postgres cast error (500). Absent/blank = every store.
 */
export function parseActionCenterStoreId(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  if (!isUUID(value.trim())) {
    throw new BadRequestException('ebayAccountId must be a UUID');
  }
  return value.trim();
}

/**
 * The seller's pending-actions surface.
 *
 * A customer surface, so it carries no `@OperatorSurface()` — staff accounts
 * are refused here by `JwtAuthGuard`, which is the correct default.
 */
@ApiTags('action-center')
@Controller({ path: 'action-center', version: '1' })
export class ActionCenterController {
  constructor(private readonly actionCenter: ActionCenterService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Pending actions for the authenticated seller',
    description:
      'Grouped, severity-ranked list of conditions the seller must act on. ' +
      'Counts are counts of conditions, not of underlying rows. Item keys and ' +
      'breakdown codes are enum values — all user-facing text is localized client-side.',
  })
  @ApiQuery({
    name: 'ebayAccountId',
    required: false,
    description:
      'Narrow the per-store items (orders, returns, eBay connections, listings) to one store. ' +
      'Plan, setup and Amazon buyer-account items are account-wide and unaffected. A store id ' +
      'that is not one of the caller stores matches no rows.',
  })
  @ApiOkResponse({ description: 'Pending action summary retrieved successfully' })
  @ApiBadRequestResponse({ description: 'ebayAccountId is not a UUID' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  async getSummary(
    @Request() req: { user: { sub: string } },
    @Query('ebayAccountId') ebayAccountId?: string
  ): Promise<ActionCenterSummaryDto> {
    return this.actionCenter.getSummary(req.user.sub, parseActionCenterStoreId(ebayAccountId));
  }
}
