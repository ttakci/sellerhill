/**
 * eBay Fulfillment API Service
 * Handles order retrieval from eBay via the Fulfillment API
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EBAY_MARKETPLACE_CONFIG, type EbayMarketplaceId, OrderCostCaptureStatus, OrderStatus } from '@repo/shared';
import axios from 'axios';

/**
 * Raw eBay order from Fulfillment API
 */
interface EbayOrderLineItem {
  lineItemId?: string;
  legacyItemId?: string;
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
      primaryPhone?: { phoneNumber?: string };
      contactAddress?: {
        addressLine1?: string;
        addressLine2?: string;
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
    const _config = EBAY_MARKETPLACE_CONFIG[marketplaceId] || EBAY_MARKETPLACE_CONFIG.EBAY_US;
    const baseUrl = this.configService.get<string>('EBAY_REST_API_URL') || 'https://apiz.ebay.com';

    const params: Record<string, string> = {
      limit: String(options.limit || 50),
    };

    if (options.fromDateString) {
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
      interface FetchOrdersResponse {
        orders?: EbayFulfillmentOrder[];
        next?: string;
        total?: number;
      }
      const response = await axios.get<FetchOrdersResponse>(url, {
        params,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
        },
        timeout: 30000,
      });

      const data = response.data;
      const orders = data?.orders || [];
      const nextCursor = data?.next ?? undefined;
      const total = data?.total ?? orders.length;

      return { orders, nextCursor, total };
    } catch (error: unknown) {
      const axiosErr = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { errors?: Array<{ message?: string }> } }; message?: string })
        : null;
      const errMsg = axiosErr?.response?.data?.errors?.[0]?.message || (error instanceof Error ? error.message : String(error));
      this.logger.error(
        `Failed to fetch eBay orders: ${errMsg}`
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
      const response = await axios.get<EbayFulfillmentOrder>(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      return response.data;
    } catch (error: unknown) {
      const axiosErr = error instanceof Error && 'response' in error
        ? (error as { response?: { status?: number }; message?: string })
        : null;
      if (axiosErr?.response?.status === 404) {
        return null;
      }
      this.logger.error(`Failed to fetch eBay order ${ebayOrderId}: ${error instanceof Error ? error.message : String(error)}`);
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
    purchasePrice?: number,
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
      buyerUsername: buyer?.username,
      buyerName: buyer?.buyerRegistrationAddress?.fullName || shipTo?.fullName,
      buyerEmail: buyer?.buyerRegistrationAddress?.email,
      buyerPhone: buyer?.buyerRegistrationAddress?.phone,
      status: this.mapOrderStatus(ebayOrder.orderFulfillmentStatus, ebayOrder.orderPaymentStatus),
      orderFulfillmentStatus: ebayOrder.orderFulfillmentStatus,
      paymentStatus: ebayOrder.orderPaymentStatus,
      listingId: listingId || null,
      quantity: lineItem?.quantity || 1,
      salePrice: parseFloat(pricing?.priceSubtotal?.value || '0'),
      saleShipping: parseFloat(ebayOrder.pricingSummary?.deliveryCost?.value || '0'),
      saleTax: parseFloat(pricing?.tax?.value || '0'),
      saleTotal: parseFloat(pricing?.total?.value || '0'),
      ebayEarnings: parseFloat(totalDueSeller?.value || '0'),
      // eBay stamps a currency on every money field; only US accounts can be
      // connected today (see migration 074), so this is always 'USD' in
      // practice, but capturing the real value now means a future
      // multi-marketplace account's orders are correct from day one instead
      // of needing a backfill.
      currency: pricing?.total?.currency || totalDueSeller?.currency || 'USD',
      transactionFee: 0,
      adFee: 0,
      netProfit: null,
      costCaptureStatus: OrderCostCaptureStatus.PENDING,
      purchasePrice: purchasePrice || 0,
      // Persist the recipient name and second address line too: auto-fulfill
      // matches saved Amazon addresses (and fills the add-address form) from
      // this object, so dropping them meant the buyer's unit/suite and name
      // never reached Amazon — risking a mis-shipped order.
      shippingAddress: address
        ? {
            fullName: shipTo?.fullName || buyer?.buyerRegistrationAddress?.fullName || '',
            street: address.addressLine1 || '',
            street2: address.addressLine2 || '',
            city: address.city || '',
            state: address.stateOrProvince || '',
            zipCode: address.postalCode || '',
            country: address.countryCode || '',
            phone: shipTo?.primaryPhone?.phoneNumber || buyer?.buyerRegistrationAddress?.phone || '',
          }
        : null,
      orderDate: ebayOrder.creationDate ? new Date(ebayOrder.creationDate) : null,
      lastEbayEventAt: ebayOrder.lastModifiedDate ? new Date(ebayOrder.lastModifiedDate) : null,
    };
  }

  /**
   * Create a shipping fulfillment on eBay (marks order as shipped)
   */
  async createShippingFulfillment(
    accessToken: string,
    ebayOrderId: string,
    lineItemId: string,
    quantity: number,
    options?: {
      trackingNumber?: string;
      shippingCarrierCode?: string;
      shippedDate?: string;
    }
  ): Promise<string | null> {
    const baseUrl = this.configService.get<string>('EBAY_REST_API_URL') || 'https://apiz.ebay.com';
    const url = `${baseUrl}/sell/fulfillment/v1/order/${ebayOrderId}/shipping_fulfillment`;

    const body: Record<string, unknown> = {
      lineItems: [{ lineItemId, quantity }],
    };

    if (options?.shippedDate) {
      body.shippedDate = options.shippedDate;
    }

    if (options?.trackingNumber && options?.shippingCarrierCode) {
      body.trackingNumber = options.trackingNumber;
      body.shippingCarrierCode = options.shippingCarrierCode;
    }

    try {
      const response = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
        validateStatus: (status) => status === 201,
      });
      const location = response.headers['location'] as string | undefined;
      return location || null;
    } catch (error: unknown) {
      const axiosErr = error instanceof Error && 'response' in error
        ? (error as { response?: { data?: { errors?: Array<{ message?: string }> } }; message?: string })
        : null;
      const errMsg = axiosErr?.response?.data?.errors?.[0]?.message || (error instanceof Error ? error.message : String(error));
      this.logger.error(`Failed to create shipping fulfillment for ${ebayOrderId}: ${errMsg}`);
      throw error;
    }
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
