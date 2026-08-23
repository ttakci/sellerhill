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
//                              when no billing provider is configured — the FE
//                              surfaces that via MessageModal instead of a
//                              silent no-op.
//   GET  /billing/portal    — authenticated. Returns 409
//                              billing.errors.providerNotConfigured when no
//                              provider is configured; 409 billing.errors.noCustomer
//                              when the user has no provider customer yet.
//
// The catalog + summary reads ALWAYS render (the backend serves them even when
// no provider is configured — they are informational in that case). The
// checkout + portal mutations are the ones that can 409; the FE gates on
// `enforcementEnabled`/the 409 response, never on the literal `provider`
// string (Stripe vs. Paddle vs. local is an ops decision, not a FE branch) —
// and surfaces the 409 via MessageModal so the user is never left guessing
// why a click did nothing.

import {
  BillingInterval,
  type BillingCatalogDto,
  type BillingCheckoutDto,
  type BillingDetailsDto,
  type BillingInvoiceListDto,
  type BillingPlanChangePreviewDto,
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
      invalidatesTags: [
        { type: 'Billing', id: 'SUMMARY' },
        { type: 'Billing', id: 'DETAILS' },
        { type: 'Billing', id: 'INVOICES' },
      ],
    }),

    /**
     * Buy a one-time quota top-up. Same redirect shape as `initiateCheckout`,
     * but the Stripe session is `mode: 'payment'` — there is no subscription
     * involved, and the allowance is granted by the
     * `checkout.session.completed` webhook.
     */
    initiateAddonCheckout: builder.mutation<BillingCheckoutDto, { addonSlug: string }>({
      query: (body) => ({
        url: '/billing/checkout/addon',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Billing', id: 'SUMMARY' }],
    }),

    /**
     * Move an EXISTING subscription to another plan, prorated by Stripe.
     *
     * Not a checkout: a customer who already has a subscription must never be
     * sent through checkout again, because Stripe would create a second one and
     * bill for both. Returns no URL — nothing to redirect to, the change is
     * immediate and the resulting `customer.subscription.updated` webhook
     * refreshes our copy.
     */
    changePlan: builder.mutation<{ ok: true }, CheckoutRequestBody>({
      query: (body) => ({
        url: '/billing/change-plan',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        { type: 'Billing', id: 'SUMMARY' },
        { type: 'Billing', id: 'DETAILS' },
        { type: 'Billing', id: 'INVOICES' },
      ],
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

    /** Live-from-Stripe detail. Separate from the summary because AppLayout
     *  calls the summary on every page load and must not pay provider latency. */
    getBillingDetails: builder.query<BillingDetailsDto, void>({
      query: () => ({ url: '/billing/details' }),
      providesTags: [{ type: 'Billing', id: 'DETAILS' }],
    }),

    /**
     * Paginated invoice history. `startingAfter` is the cursor from a
     * previous page's `nextCursor` — omit for the first page. `limit` is
     * optional and forwarded as-is when the caller supplies one; omitted
     * entirely otherwise so the server's own default page size governs
     * (existing call sites keep working unchanged).
     */
    getBillingInvoices: builder.query<BillingInvoiceListDto, { startingAfter?: string; limit?: number } | void>({
      query: (args) => ({
        url: '/billing/invoices',
        params: {
          ...(args?.startingAfter ? { startingAfter: args.startingAfter } : undefined),
          ...(typeof args?.limit === 'number' ? { limit: args.limit } : undefined),
        },
      }),
      providesTags: [{ type: 'Billing', id: 'INVOICES' }],
    }),

    /**
     * What a plan change will actually cost, from Stripe's own arithmetic
     * (`invoices.createPreview`) — not an estimate computed here. Read-only:
     * does not itself change the subscription.
     */
    previewPlanChange: builder.mutation<BillingPlanChangePreviewDto, CheckoutRequestBody>({
      query: (body) => ({ url: '/billing/plan-change/preview', method: 'POST', body }),
    }),

    /**
     * Cancel a downgrade that is scheduled for the end of the current
     * period, keeping the seller on their current plan.
     */
    cancelScheduledChange: builder.mutation<{ ok: true }, void>({
      query: () => ({ url: '/billing/scheduled-change', method: 'DELETE' }),
      invalidatesTags: [
        { type: 'Billing', id: 'SUMMARY' },
        { type: 'Billing', id: 'DETAILS' },
      ],
    }),
  }),
});

export const {
  useGetBillingCatalogQuery,
  useGetBillingSummaryQuery,
  useInitiateCheckoutMutation,
  useInitiateAddonCheckoutMutation,
  useChangePlanMutation,
  useLazyOpenBillingPortalQuery,
  useGetBillingDetailsQuery,
  useGetBillingInvoicesQuery,
  usePreviewPlanChangeMutation,
  useCancelScheduledChangeMutation,
} = billingApi;
