export interface PlanChangeConfirmProps {
  isOpen: boolean;
  /**
   * Fully assembled, localized confirmation message — including the plan
   * name and Stripe's own prorated amount/date — or `null` before a plan has
   * ever been previewed. Assembled in `BillingPage.container.tsx`, not here:
   * `formatMicroCurrency`/`formatDate` are forbidden in a `.component.tsx`
   * file, and the upgrade/downgrade wording depends on `PlanChangeDirection`
   * plus interpolation the container already does for `scheduledChangeLine`.
   */
  body: string | null;
  isConfirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
