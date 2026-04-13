import { Body, Controller, Get, Post, Query, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type OrderDto, type OrderFiltersDto, type OrderStatsDto, type UpdateOrderAmazonDetailsDto } from '@repo/shared';

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
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc'
  ): Promise<{ orders: OrderDto[]; total: number }> {
    const filters: OrderFiltersDto = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status: status as any,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
    };
    return this.ordersService.findAll(req.user.sub, filters);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get order statistics for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Return order statistics.' })
  getStats(@Request() req: any): Promise<OrderStatsDto> {
    return this.ordersService.getStats(req.user.sub);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Trigger manual order sync from eBay' })
  @ApiResponse({ status: 200, description: 'Order sync triggered.' })
  triggerSync(@Request() req: any): Promise<{ message: string }> {
    return this.ordersService.triggerSync(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Return order details.' })
  findOne(@Request() req: any, @Param('id') id: string): Promise<OrderDto> {
    return this.ordersService.findOne(req.user.sub, id);
  }

  @Post(':id/amazon-details')
  @ApiOperation({ summary: 'Update Amazon order details' })
  @ApiResponse({ status: 200, description: 'Order updated successfully.' })
  updateAmazonDetails(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateOrderAmazonDetailsDto
  ): Promise<OrderDto> {
    return this.ordersService.updateAmazonDetails(req.user.sub, id, updateDto);
  }
}
