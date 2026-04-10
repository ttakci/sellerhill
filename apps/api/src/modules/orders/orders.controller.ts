import { Body, Controller, Get, Param, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrderDto, OrderStatsDto, UpdateOrderAmazonDetailsDto } from '@repo/shared';
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
  @ApiResponse({ status: 200, description: 'Return all orders.' })
  findAll(@Request() req: any): Promise<OrderDto[]> {
    return this.ordersService.findAll(req.user.sub);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get order statistics for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Return order statistics.' })
  getStats(@Request() req: any): Promise<OrderStatsDto> {
    return this.ordersService.getStats(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Return order details.' })
  findOne(@Request() req: any, @Param('id') id: string): Promise<OrderDto> {
    return this.ordersService.findOne(req.user.sub, id);
  }

  @Put(':id/amazon-details')
  @ApiOperation({ summary: 'Update Amazon order details' })
  @ApiResponse({ status: 200, description: 'Order updated successfully.' })
  updateAmazonDetails(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateOrderAmazonDetailsDto,
  ): Promise<OrderDto> {
    return this.ordersService.updateAmazonDetails(req.user.sub, id, updateDto);
  }
}
