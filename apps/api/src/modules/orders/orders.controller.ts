import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  OrderFulfillmentState,
  OrderShipByState,
  OrderStage,
  type OrderDto,
  type OrderFiltersDto,
  type OrderStageCountsDto,
  type OrderStatsDto,
  UpdateOrderAmazonDetailsDto,
  type OrderSyncResponseDto,
} from '@repo/shared';
import { isUUID } from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { OrdersService } from './orders.service';

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

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'orders', version: '1' })
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all orders for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Return orders with pagination.' })
  findAll(
    @Request() req: { user: { sub: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('ebayAccountId') ebayAccountId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('autoFulfillNeedsAttention') autoFulfillNeedsAttention?: string,
    @Query('fulfillmentState') fulfillmentState?: string,
    @Query('stage') stage?: string,
    @Query('tracked') tracked?: string,
    @Query('shipBy') shipBy?: string,
    @Query('refunded') refunded?: string,
    @Query('needsAction') needsAction?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc'
  ): Promise<{ orders: OrderDto[]; total: number }> {
    // Validate against the enum rather than passing the raw string through: the
    // service maps this value to a fixed SQL clause, so an unknown value must be
    // dropped, not forwarded.
    const isKnownState = Object.values(OrderFulfillmentState).includes(fulfillmentState as OrderFulfillmentState);
    // Tri-state: 'true'/'false' → boolean, anything else (incl. absent) → no filter.
    const isTracked = tracked === 'true' ? true : tracked === 'false' ? false : undefined;
    // `?stage=a,b` — unknown values are dropped, not forwarded (the service
    // interpolates nothing from here, but an unknown stage would silently
    // return an empty list, which reads as "no orders").
    const stages = (stage ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is OrderStage => (Object.values(OrderStage) as string[]).includes(s));
    // Enum-checked for the same reason as the stage: the value selects a fixed
    // SQL fragment and must never be forwarded raw.
    const isKnownShipBy = (Object.values(OrderShipByState) as string[]).includes(shipBy ?? '');
    const filters: OrderFiltersDto = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status: status as OrderFiltersDto['status'],
      search,
      ebayAccountId: parseStoreId(ebayAccountId),
      dateFrom,
      dateTo,
      autoFulfillNeedsAttention: autoFulfillNeedsAttention === 'true' ? true : undefined,
      fulfillmentState: isKnownState ? (fulfillmentState as OrderFulfillmentState) : undefined,
      isTracked,
      stages: stages.length > 0 ? stages : undefined,
      shipBy: isKnownShipBy ? (shipBy as OrderShipByState) : undefined,
      hasRefund: refunded === 'true' ? true : undefined,
      needsAction: needsAction === 'true' ? true : undefined,
      sortBy,
      sortOrder,
    };
    return this.ordersService.findAll(req.user.sub, filters);
  }

  @Get('stage-counts')
  @ApiOperation({ summary: 'Count orders per stage for the list page tabs' })
  @ApiResponse({ status: 200, description: 'One count per OrderStage (0 when none).' })
  getStageCounts(
    @Request() req: { user: { sub: string } },
    @Query('ebayAccountId') ebayAccountId?: string,
    @Query('tracked') tracked?: string
  ): Promise<OrderStageCountsDto> {
    const isTracked = tracked === 'true' ? true : tracked === 'false' ? false : undefined;
    return this.ordersService.getStageCounts(req.user.sub, { ebayAccountId: parseStoreId(ebayAccountId), isTracked });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get order statistics for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Return order statistics.' })
  getStats(@Request() req: { user: { sub: string } }): Promise<OrderStatsDto> {
    return this.ordersService.getStats(req.user.sub);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Trigger manual order sync from eBay' })
  @ApiResponse({ status: 200, description: 'Order sync completed with fresh data.' })
  triggerSync(@Request() req: { user: { sub: string } }): Promise<OrderSyncResponseDto> {
    return this.ordersService.triggerSync(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Return order details.' })
  findOne(@Request() req: { user: { sub: string } }, @Param('id') id: string): Promise<OrderDto> {
    return this.ordersService.findOne(req.user.sub, id);
  }

  @Put(':id/note')
  @ApiOperation({ summary: "Save the seller's own note on an order (blank clears it)" })
  @ApiResponse({ status: 200, description: 'Note saved.' })
  updateNote(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: { note?: unknown }
  ): Promise<{ sellerNote: string | null }> {
    return this.ordersService.updateNote(req.user.sub, id, body?.note ?? null);
  }

  @Post(':id/amazon-details')
  @ApiOperation({ summary: 'Update Amazon order details' })
  @ApiResponse({ status: 200, description: 'Order updated successfully.' })
  updateAmazonDetails(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() updateDto: UpdateOrderAmazonDetailsDto
  ): Promise<OrderDto> {
    return this.ordersService.updateAmazonDetails(req.user.sub, id, updateDto);
  }
}
