import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type ActionCenterSummaryDto } from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { ActionCenterService } from './action-center.service';

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
  @ApiOkResponse({ description: 'Pending action summary retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'User not authenticated' })
  async getSummary(@Request() req: { user: { sub: string } }): Promise<ActionCenterSummaryDto> {
    return this.actionCenter.getSummary(req.user.sub);
  }
}
