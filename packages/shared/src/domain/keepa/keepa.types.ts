export interface KeepaProduct {
  asin: string;
  price: number; // Current price in USD
  stock: number; // 0=out of stock, >0=quantity
  sellerId?: string; // Cheapest seller ID
  lastSync: Date;
  raw?: any; // Raw API response
}
