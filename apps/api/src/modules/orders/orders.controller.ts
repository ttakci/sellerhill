import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  OrderFulfillmentState,
  type OrderDto,
  type OrderFiltersDto,
  type OrderStatsDto,
  type UpdateOrderAmazonDetailsDto,
  type OrderSyncResponseDto,
} from '@repo/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { OrdersService } from './orders.service';

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
    @Query('tracked') tracked?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc'
  ): Promise<{ orders: OrderDto[]; total: number }> {
    // Validate against the enum rather than passing the raw string through: the
    // service maps this value to a fixed SQL clause, so an unknown value must be
    // dropped, not forwarded.
    const isKnownState = Object.values(OrderFulfillmentState).includes(
      fulfillmentState as OrderFulfillmentState
    );
    // Tri-state: 'true'/'false' → boolean, anything else (incl. absent) → no filter.
    const isTracked = tracked === 'true' ? true : tracked === 'false' ? false : undefined;
    const filters: OrderFiltersDto = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status: status as OrderFiltersDto['status'],
      search,
      ebayAccountId,
      dateFrom,
      dateTo,
      autoFulfillNeedsAttention:
        autoFulfillNeedsAttention === 'true' ? true : undefined,
      fulfillmentState: isKnownState
        ? (fulfillmentState as OrderFulfillmentState)
        : undefined,
      isTracked,
      sortBy,
      sortOrder,
    };
    return this.ordersService.findAll(req.user.sub, filters);
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
