import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrderDto, OrderStatsDto, UpdateOrderAmazonDetailsDto } from '@repo/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all orders' })
  @ApiResponse({ status: 200, description: 'Return all orders.' })
  findAll(): Promise<OrderDto[]> {
    return this.ordersService.findAll();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get order statistics' })
  @ApiResponse({ status: 200, description: 'Return order statistics.' })
  getStats(): Promise<OrderStatsDto> {
    return this.ordersService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Return order details.' })
  findOne(@Param('id') id: string): Promise<OrderDto> {
    return this.ordersService.findOne(id);
  }

  @Put(':id/amazon-details')
  @ApiOperation({ summary: 'Update Amazon order details' })
  @ApiResponse({ status: 200, description: 'Order updated successfully.' })
  updateAmazonDetails(@Param('id') id: string, @Body() updateDto: UpdateOrderAmazonDetailsDto): Promise<OrderDto> {
    return this.ordersService.updateAmazonDetails(id, updateDto);
  }
}
