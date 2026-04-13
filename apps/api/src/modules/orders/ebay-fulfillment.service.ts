/**
 * eBay Fulfillment API Service
 * Handles order retrieval from eBay via the Fulfillment API
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EBAY_MARKETPLACE_CONFIG, type EbayMarketplaceId, OrderStatus } from '@repo/shared';
import axios from 'axios';

/**
 * Raw eBay order from Fulfillment API
 */
interface EbayOrderLineItem {
  lineItemId?: string;
  itemId?: string;
  title?: string;
  quantity?: number;
  lineItemCost?: { value: string; currency: string };
  deliveryCost?: { shippingCost?: { value: string; currency: string } };
  itemUrl?: string;
  sku?: string;
  lineItemFulfillmentInstructions?: { minEstimatedDeliveryDate?: string; maxEstimatedDeliveryDate?: string };
}

interface EbayFulfillmentOrder {
  orderId?: string;
  legacyOrderId?: string;
  creationDate?: string;
  lastModifiedDate?: string;
  orderFulfillmentStatus?: string;
  orderPaymentStatus?: string;
  buyer?: {
    username?: string;
    buyerRegistrationAddress?: {
      fullName?: string;
      email?: string;
      phone?: string;
    };
  };
  pricingSummary?: {
    priceSubtotal?: { value: string; currency: string };
    deliveryCost?: { value: string; currency: string };
    tax?: { value: string; currency: string };
    total?: { value: string; currency: string };
  };
  lineItems?: EbayOrderLineItem[];
  fulfillments?: Array<{
    shipmentTrackingNumber?: string;
    shippingCarrierCode?: string;
  }>;
  paymentSummary?: {
    totalDueSeller?: { value: string; currency: string };
    payments?: Array<{
      paymentMethod?: string;
      amount?: { value: string; currency: string };
    }>;
  };
  shippingDetail?: {
    shipToAddress?: {
      fullName?: string;
      contactAddress?: {
        addressLine1?: string;
        city?: string;
        stateOrProvince?: string;
        postalCode?: string;
        countryCode?: string;
      };
    };
  };
}

interface FetchOrdersResult {
  orders: EbayFulfillmentOrder[];
  nextCursor?: string;
  total?: number;
}

@Injectable()
export class EbayFulfillmentService {
  private readonly logger = new Logger(EbayFulfillmentService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Fetch orders from eBay Fulfillment API
   */
  async fetchOrders(
    accessToken: string,
    marketplaceId: EbayMarketplaceId,
    options: {
      fromDateString?: string;
      toDateString?: string;
      limit?: number;
      cursor?: string;
    } = {}
  ): Promise<FetchOrdersResult> {
    const config = EBAY_MARKETPLACE_CONFIG[marketplaceId] || EBAY_MARKETPLACE_CONFIG.EBAY_US;
    const baseUrl = this.configService.get<string>('EBAY_REST_API_URL') || 'https://apiz.ebay.com';

    const params: Record<string, string> = {
      limit: String(options.limit || 50),
    };

    if (options.fromDateString) {
      // eBay expects ISO 8601 format: 2024-01-01T00:00:00.000Z
      params.filter = `creationdate:[${options.fromDateString}..]`;
      if (options.toDateString) {
        params.filter = `creationdate:[${options.fromDateString}..${options.toDateString}]`;
      }
    }

    if (options.cursor) {
      params.continuation_token = options.cursor;
    }

    const url = `${baseUrl}/sell/fulfillment/v1/order`;

    this.logger.debug(`Fetching eBay orders from ${url}`);

    try {
      const response = await axios.get(url, {
        params,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        },
        timeout: 30000,
      });

      const orders = response.data?.orders || [];
      const nextCursor = response.data?.next ?? undefined;
      const total = response.data?.total ?? orders.length;

      return { orders, nextCursor, total };
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch eBay orders: ${error.response?.data?.errors?.[0]?.message || error.message}`
      );
      throw error;
    }
  }

  /**
   * Fetch a single order by eBay order ID
   */
  async fetchOrderById(
    accessToken: string,
    marketplaceId: EbayMarketplaceId,
    ebayOrderId: string
  ): Promise<EbayFulfillmentOrder | null> {
    const baseUrl = this.configService.get<string>('EBAY_REST_API_URL') || 'https://apiz.ebay.com';
    const url = `${baseUrl}/sell/fulfillment/v1/order/${ebayOrderId}`;

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      this.logger.error(`Failed to fetch eBay order ${ebayOrderId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Map eBay Fulfillment API order to our database entity format
   */
  mapEbayOrderToEntity(
    ebayOrder: EbayFulfillmentOrder,
    userId: string,
    ebayAccountId: string,
    listingId?: string,
    asin?: string
  ) {
    const lineItem = ebayOrder.lineItems?.[0];
    const pricing = ebayOrder.pricingSummary;
    const buyer = ebayOrder.buyer;
    const shipTo = ebayOrder.shippingDetail?.shipToAddress;
    const address = shipTo?.contactAddress;
    const totalDueSeller = ebayOrder.paymentSummary?.totalDueSeller;

    return {
      userId,
      ebayAccountId,
      ebayOrderId: ebayOrder.orderId || '',
      orderNumber: ebayOrder.legacyOrderId || ebayOrder.orderId,
      buyerUsername: buyer?.username,
      buyerName: buyer?.buyerRegistrationAddress?.fullName || shipTo?.fullName,
      buyerEmail: buyer?.buyerRegistrationAddress?.email,
      buyerPhone: buyer?.buyerRegistrationAddress?.phone,
      status: this.mapOrderStatus(ebayOrder.orderFulfillmentStatus, ebayOrder.orderPaymentStatus),
      orderFulfillmentStatus: ebayOrder.orderFulfillmentStatus,
      paymentStatus: ebayOrder.orderPaymentStatus,
      listingId: listingId || null,
      asin: asin || null,
      ebayItemId: lineItem?.itemId || null,
      sku: lineItem?.sku || null,
      productTitle: lineItem?.title || 'Unknown Product',
      productImageUrl: lineItem?.itemUrl || null,
      quantity: lineItem?.quantity || 1,
      isTracked: !!listingId,
      salePrice: parseFloat(pricing?.priceSubtotal?.value || '0'),
      saleShipping: parseFloat(ebayOrder.pricingSummary?.deliveryCost?.value || '0'),
      saleTax: parseFloat(pricing?.tax?.value || '0'),
      saleTotal: parseFloat(pricing?.total?.value || '0'),
      ebayEarnings: parseFloat(totalDueSeller?.value || '0'),
      transactionFee: 0,
      adFee: 0,
      netProfit: 0,
      purchasePrice: 0,
      shippingAddress: address
        ? {
            street: address.addressLine1 || '',
            city: address.city || '',
            state: address.stateOrProvince || '',
            zipCode: address.postalCode || '',
            country: address.countryCode || '',
          }
        : null,
      ebayCreatedAt: ebayOrder.creationDate ? new Date(ebayOrder.creationDate) : null,
      ebayUpdatedAt: ebayOrder.lastModifiedDate ? new Date(ebayOrder.lastModifiedDate) : null,
    };
  }

  /**
   * Map eBay fulfillment status to our OrderStatus enum
   */
  private mapOrderStatus(
    fulfillmentStatus?: string,
    paymentStatus?: string
  ): OrderStatus {
    if (!fulfillmentStatus) {return OrderStatus.PENDING;}

    const status = fulfillmentStatus.toUpperCase();

    if (status === 'FULFILLED') {return OrderStatus.SHIPPED;}
    if (status === 'NOT_STARTED') {return paymentStatus === 'PAID' ? OrderStatus.WAITING_SHIPMENT : OrderStatus.PENDING;}
    if (status === 'IN_PROGRESS') {return OrderStatus.PROCESSING;}

    return OrderStatus.PENDING;
  }
}
