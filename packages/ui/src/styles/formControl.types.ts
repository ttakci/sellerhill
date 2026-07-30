/**
 * Shared form-control types.
 * Lives beside `formControl.ts` so the helper file stays declaration-free
 * (types-only-in-types-files rule).
 */

/** Nominal size tier shared by TextInput / Select / SearchField / MessageComposer. */
export type ControlSize = 'small' | 'medium' | 'large';
