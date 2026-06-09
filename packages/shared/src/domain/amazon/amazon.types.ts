import type { AmazonAccountStatus } from './amazon.enums';

export interface AmazonAccountDto {
  id: string;
  userId: string;
  label?: string;
  email: string;
  status: AmazonAccountStatus;
  lastVerifiedAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAmazonAccountRequest {
  label?: string;
  email: string;
  password: string;
  twoFactorSecret?: string;
}

export interface UpdateAmazonAccountRequest {
  label?: string;
  password?: string;
  twoFactorSecret?: string;
}

export interface AmazonOrderLinkRequest {
  amazonAccountId: string;
  amazonOrderId: string;
}

export interface AmazonScrapedOrderData {
  amazonOrderId: string;
  orderDate?: string;
  status?: string;
  items: {
    title: string;
    price: number;
    quantity: number;
    asin?: string;
  }[];
  subtotal: number;
  shipping: number;
  tax: number;
  grandTotal: number;
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
}

export interface AmazonOrderStatusResult {
  amazonOrderId: string;
  status: AmazonOrderStatus;
  trackingNumber?: string;
  trackingCarrier?: string;
}

export type AmazonOrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';
