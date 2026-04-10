import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderDto, OrderStatsDto, OrderStatus, UpdateOrderAmazonDetailsDto } from '@repo/shared';

@Injectable()
export class OrdersService {
  // Mock data for demonstration - in a real app this would come from a database/eBay API
  // TODO: When DB integration happens, filter by userId in queries
  private orders: OrderDto[] = [
    {
      id: '1',
      orderNumber: '111-3584806-4276241',
      createdAt: new Date().toISOString(),
      buyerName: 'William Clark',
      buyerEmail: 'w.clark@example.com',
      buyerPhone: '+1 (555) 123-4567',
      status: OrderStatus.SHIPPED,
      salePrice: 37.75,
      purchasePrice: 11.82,
      netProfit: 16.97,
      product: {
        title: 'Premium Wireless Noise-Cancelling Headphones',
        asin: 'B08H93ZRLL',
        ebayItemId: '3548064276241',
        sku: 'WH-1000XM4-B',
        quantity: 1,
        imageUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAcpA-5jvWm9JeXVUiKxWyNsKpiqwLAVWsZNw9KHlg86-cQEq4cvEy0Xf4-nqGLc0IZN6C6QSfYm_xiLyNaKxfy-Djo8eVF0Pb3cA2miiyjNitLpL9OBcMLMDa1B94bob_SqegkQCni-4cNRmlyDf84VpE7LHGlSlxS41Se033SDPpcpO0UfnjYkZ8v1P5oGPx9vP20h5LA7s_JPFY1z-K__gEeYf6WvMi3ztlrmpkuRFwKN1SuvAuMFr-lh1dSzL20c4WJKOZrfaP2',
      },
      shippingAddress: {
        street: 'HILLSIDE CLUB 565 VALLEY RIDGE DR',
        city: 'PETOSKEY',
        state: 'MI',
        zipCode: '49770-8681',
        country: 'United States',
      },
      details: {
        purchaseSummary: {
          subtotal: 11.82,
          shipping: 0,
          tax: 0,
          total: 11.82,
          paymentMethod: 'Ending in 0764',
        },
        ebaySummary: {
          subtotal: 35.61,
          shipping: 0,
          tax: 2.14,
          total: 37.75,
          earnings: 28.79,
        },
      },
      fees: {
        transactionFee: 4.74,
        advertisingFee: 2.08,
        salesTax: 2.14,
      },
    },
  ];

  async findAll(_userId: string): Promise<OrderDto[]> {
    // TODO: Filter by userId when DB integration is implemented
    return this.orders;
  }

  async getStats(_userId: string): Promise<OrderStatsDto> {
    // TODO: Calculate stats scoped to userId when DB integration is implemented
    return {
      totalSales: 15420.5,
      netProfit: 4230.8,
      activeOrders: 12,
      returnRate: 2.4,
      salesGrowth: 15.2,
      profitGrowth: 12.8,
    };
  }

  async findOne(_userId: string, id: string): Promise<OrderDto> {
    // TODO: Verify order belongs to userId when DB integration is implemented
    const order = this.orders.find((o) => o.id === id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  async updateAmazonDetails(
    _userId: string,
    id: string,
    updateDto: UpdateOrderAmazonDetailsDto,
  ): Promise<OrderDto> {
    // TODO: Verify order belongs to userId when DB integration is implemented
    const orderIndex = this.orders.findIndex((o) => o.id === id);
    if (orderIndex === -1) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const order = this.orders[orderIndex];

    const updatedOrder = {
      ...order,
      ...updateDto,
      status: updateDto.amazonOrderUrl ? OrderStatus.WAITING_SHIPMENT : order.status,
    };

    if (updateDto.amazonTax !== undefined || updateDto.amazonShipping !== undefined) {
      const amazonTotal = order.purchasePrice + (updateDto.amazonTax || 0) + (updateDto.amazonShipping || 0);
      const ebayEarnings = order.details?.ebaySummary.earnings || 0;
      updatedOrder.netProfit = parseFloat((ebayEarnings - amazonTotal).toFixed(2));

      if (updatedOrder.details) {
        updatedOrder.details.purchaseSummary = {
          ...updatedOrder.details.purchaseSummary,
          tax: updateDto.amazonTax || updatedOrder.details.purchaseSummary.tax,
          shipping: updateDto.amazonShipping || updatedOrder.details.purchaseSummary.shipping,
          total: amazonTotal,
        };
      }
    }

    this.orders[orderIndex] = updatedOrder;
    return updatedOrder;
  }
}
