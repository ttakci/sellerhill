import type { useUI } from '@repo/ui';

/**
 * The canonical "this drawer's job is done" outcome, shared by every settings
 * drawer's save AND delete success path: close the drawer, then show the
 * standard success MessageModal. Routing all of them through one function is
 * what keeps the behaviour from drifting per-drawer — some used to show the
 * popup without closing, some closed without a popup, some did neither.
 *
 * The drawer is closed BEFORE the popup so the seller sees the confirmation on
 * the settings page, not stacked on top of a drawer they're finished with.
 */
export function notifyDrawerDone({
  onClose,
  showMessage,
  closeMessage,
  t,
  headerKey = 'translation:message.success.header',
  descriptionKey = 'translation:common.saveSuccess',
  descriptionParams,
}: {
  /** Closes the drawer. Called first — the drawer is gone before the popup shows. */
  onClose: () => void;
  showMessage: ReturnType<typeof useUI>['showMessage'];
  closeMessage: ReturnType<typeof useUI>['closeMessage'];
  t: Parameters<ReturnType<typeof useUI>['showMessage']>[1];
  /** Override the default success header key. */
  headerKey?: string;
  /** Override the default success body key. */
  descriptionKey?: string;
  /** Interpolation params for `descriptionKey`. */
  descriptionParams?: Record<string, string | number>;
}): void {
  onClose();
  showMessage(
    {
      type: 'success',
      headerKey,
      descriptionKey,
      descriptionParams,
      primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
    },
    t,
  );
}
