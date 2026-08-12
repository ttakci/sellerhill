import type { ActionCenterGroupDto, ActionCenterItemDto, ActionCenterSeverity } from '@repo/shared';

import type { ACTION_CENTER_FILTER_ALL } from '../actionCenterPresentation';

/**
 * Either a severity, or the sentinel meaning "show everything".
 *
 * Derived from the constant with `typeof` rather than repeating the literal, so
 * the sentinel is defined exactly once even though the value and the type live
 * in different files (the frontend rules keep runtime values out of `.types.ts`).
 */
export type ActionCenterFilter = ActionCenterSeverity | typeof ACTION_CENTER_FILTER_ALL;

/** One reason chip, already localized by the container. */
export interface ActionCenterBreakdownChip {
  code: string;
  count: number;
  label: string;
}

/**
 * An item with everything resolved for rendering.
 *
 * The container does the i18n lookups (they need `count`/`context`
 * interpolation and a per-item namespace), so the component receives strings
 * and never calls `t` with a computed key.
 */
export interface ActionCenterItemView extends ActionCenterItemDto {
  title: string;
  description: string;
  actionLabel: string;
  chips: ActionCenterBreakdownChip[];
}

export interface ActionCenterGroupView extends Omit<ActionCenterGroupDto, 'items'> {
  title: string;
  subtitle: string;
  items: ActionCenterItemView[];
}

export interface ActionCenterPageComponentProps {
  groups: ActionCenterGroupView[];
  filter: ActionCenterFilter;
  /**
   * Takes a raw string because it is wired straight to `SegmentedControl`,
   * whose value is untyped. The container narrows it back to
   * {@link ActionCenterFilter} — the component makes no decisions about it.
   */
  onFilterChange: (value: string) => void;
  filterOptions: Array<{ label: string; value: string }>;
  /** True on the very first fetch, before any data has arrived. */
  isInitialLoading: boolean;
  /** True when the seller genuinely has nothing pending (not merely filtered out). */
  isEmpty: boolean;
  onItemAction: (item: ActionCenterItemView) => void;
}
