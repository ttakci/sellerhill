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
import { EbayCancellationActionResultDto, isEbayCancellationAction, PaginatedCancellationsDto } from '@repo/shared';
import { isUUID } from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { CancellationActionError, EbayCancellationsActionsService } from './ebay-cancellations-actions.service';

type AuthedRequest = { user: { sub: string } };

/** `?tab=action` — the only tab: requests awaiting the seller's answer. */
const ACTION_TAB = 'action';

function parseUuid(value: string | undefined, name: string): string | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  if (!isUUID(value.trim())) {
    throw new BadRequestException(`${name} must be a UUID`);
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
 * eBay buyer cancellation requests — the seller's own. The list reads
 * `ebay_cancellations` (the order page carries the linked request on
 * `OrderDto.cancellation`; this is the fallback for unlinked rows); the ONE
 * write route answers a request through `EbayCancellationsActionsService`,
 * which holds every gate. A customer surface (`JwtAuthGuard`).
 */
@ApiTags('cancellations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'cancellations', version: '1' })
export class EbayCancellationsController {
  constructor(private readonly actions: EbayCancellationsActionsService) {}

  @Get()
  @ApiOperation({ summary: 'One page of the seller’s eBay buyer cancellation requests' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'orderId', required: false, description: 'SellerHill order id (UUID)' })
  @ApiQuery({ name: 'tab', required: false, enum: [ACTION_TAB] })
  list(
    @Request() req: AuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('orderId') orderId?: string,
    @Query('tab') tab?: string
  ): Promise<PaginatedCancellationsDto> {
    return this.actions.list(req.user.sub, {
      page: parsePositiveInt(page),
      limit: parsePositiveInt(limit),
      orderId: parseUuid(orderId, 'orderId'),
      actionOnly: tab === ACTION_TAB,
    });
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
    const cancellationId = parseUuid(id, 'id');
    if (!cancellationId) {
      throw new BadRequestException('id must be a UUID');
    }
    try {
      return await this.actions.act(req.user.sub, cancellationId, action);
    } catch (error) {
      rethrowCancellationAction(error);
    }
  }
}
