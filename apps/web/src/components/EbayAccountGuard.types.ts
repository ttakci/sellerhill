import type { CreateEbayConnectUrlResponse, GetEbayAccountsResponse } from '@repo/shared';
import type React from 'react';

export interface EbayAccountGuardProps {
  children: React.ReactNode;
}

export interface EbayAccountsQueryResult {
  data?: GetEbayAccountsResponse;
  isLoading: boolean;
  error?: unknown;
}

export type EbayConnectUrlQueryTuple = [
  (arg: { marketplaceId: string }) => unknown,
  { isLoading: boolean; isSuccess: boolean; data?: CreateEbayConnectUrlResponse; error?: unknown },
];
