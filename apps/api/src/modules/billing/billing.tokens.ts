// apps/api/src/modules/billing/billing.tokens.ts
//
// DI tokens, kept out of `billing.module.ts` so a provider inside this module
// can inject one without importing the module that declares it (which is a
// circular import, and `module-cycle.guard.spec.ts` exists because this
// codebase has paid for those before). The module re-exports them, so external
// import sites are unaffected.

/** Resolves to StripeBillingProvider, injected behind `BillingProviderPort`. */
export const BILLING_PROVIDER_TOKEN = 'BILLING_PROVIDER';

/** Resolves to the BillingConfig snapshot read at boot. */
export const BILLING_CONFIG_TOKEN = 'BILLING_CONFIG';
