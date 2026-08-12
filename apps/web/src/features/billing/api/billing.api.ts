// apps/web/src/features/billing/api/billing.api.ts
//
// Billing RTK Query API. Aligns to the real backend contracts in
// `@repo/shared` domain/billing (billing.wire.ts) — no local wire DTOs.
//
// Endpoints (mirror apps/api/src/modules/billing/billing.controller.ts):
//   GET  /billing/catalog   — public, no auth. Used by the landing pricing grid
//                              + the authenticated /billing page.
//   GET  /billing/summary   — authenticated. Current subscription + plan +
//                              open usage periods + transition state.
//   POST /billing/checkout  — authenticated; body SubscribeDto { planId, interval }.
//                              Returns 409 billing.errors.providerNotConfigured
//                              when Paddle env is absent — the FE surfaces that
//                              via MessageModal instead of a silent no-op.
//   GET  /billing/portal    — authenticated. Returns 409
//                              billing.errors.providerNotConfigured when Paddle
//                              env is absent; 409 billing.errors.noCustomer when
//                              the user has no provider customer yet.
//
// The catalog + summary reads ALWAYS render (the backend serves them even when
// no provider is configured — they are informational in that case). The
// checkout + portal mutations are the ones that can 409; the FE gates the
// buttons on `provider === 'paddle'` AND surfaces the 409 via MessageModal so
// the user is never left guessing why a click did nothing.

import {
  BillingInterval,
  type BillingCatalogDto,
  type BillingCheckoutDto,
  type BillingPortalDto,
  type BillingSummaryDto,
} from '@repo/shared';

import { baseApi } from '@/api/baseApi';

/** Body for POST /billing/checkout — mirrors SubscribeDto in @repo/shared. */
export interface CheckoutRequestBody {
  planId: string;
  interval: BillingInterval;
}

export const billingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Public billing catalog — active plans with effective prices + limits.
     * Used by the landing pricing grid (public, no auth) and the authenticated
     * plan-compare drawer. Always succeeds; when no provider is configured the
     * catalog is informational only (`provider: 'local'`, `enforcementEnabled: false`).
     */
    getBillingCatalog: builder.query<BillingCatalogDto, void>({
      query: () => ({ url: '/billing/catalog' }),
      providesTags: [{ type: 'Billing', id: 'CATALOG' }],
    }),

    /**
     * Authenticated billing summary — current subscription, expanded plan, open
     * usage periods, and the high-level `transition` state the FE renders
     * against (`full_access` | `active` | `no_subscription` | `past_due`).
     */
    getBillingSummary: builder.query<BillingSummaryDto, void>({
      query: () => ({ url: '/billing/summary' }),
      providesTags: [{ type: 'Billing', id: 'SUMMARY' }],
    }),

    /**
     * Initiate a Paddle checkout for a plan + interval. On success, redirects
     * the browser to the provider checkout URL. Can 409 with
     * `billing.errors.providerNotConfigured` / `planNotFound` / `priceNotFound`
     * / `planNotMirrored` — the container surfaces those via MessageModal.
     */
    initiateCheckout: builder.mutation<BillingCheckoutDto, CheckoutRequestBody>({
      query: (body) => ({
        url: '/billing/checkout',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Billing', id: 'SUMMARY' }],
    }),

    /**
     * Open the Paddle customer portal to manage the subscription (change plan,
     * update card, cancel). Can 409 with `billing.errors.providerNotConfigured`
     * / `noCustomer` — the container surfaces those via MessageModal.
     */
    openBillingPortal: builder.query<BillingPortalDto, void>({
      query: () => ({ url: '/billing/portal' }),
      // Query (not mutation) because the backend is GET — the FE uses a
      // lazy trigger so the portal URL is only fetched on explicit click.
    }),
  }),
});

export const {
  useGetBillingCatalogQuery,
  useGetBillingSummaryQuery,
  useInitiateCheckoutMutation,
  useLazyOpenBillingPortalQuery,
} = billingApi;
