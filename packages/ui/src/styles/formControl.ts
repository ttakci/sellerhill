/**
 * Shared form-control geometry & focus treatment.
 * TextInput, Select, SearchField (and Button medium) must stay aligned.
 */

import { controlTokens } from '../theme/designTokens';

import type { ControlSize } from './formControl.types';

export type { ControlSize } from './formControl.types';

/**
 * Heights are derived from `controlTokens.height` — the single source of truth.
 * They used to be duplicated here as literals and had silently drifted 4px away
 * from the tokens (and from the documented table), so a labeled TextInput never
 * matched the Button beside it.
 */

/** Height for controls without a floating label (search, compact toolbars). */
export const compactControlHeight = (size: ControlSize = 'medium'): string =>
  controlTokens.height[size];

/**
 * Height for controls with a floating label.
 * Sized so floated label and value never collide (body is 16px).
 */
export const labeledControlHeight = (size: ControlSize = 'medium'): string =>
  controlTokens.height[`${size}Labeled` as const];

export const controlHeight = (size: ControlSize = 'medium', hasLabel = false): string =>
  hasLabel ? labeledControlHeight(size) : compactControlHeight(size);

/** Shared horizontal padding inside control fields. */
export const CONTROL_PADDING_X = '1rem';

/** Icon / decoration column width. */
export const CONTROL_ICON_WIDTH = '2.75rem';

/**
 * Brand focus ring formula (border + soft ring).
 * Always use brand.primary — never black / neutral on focus or open.
 */
export const controlFocusShadow = (brandPrimary: string): string =>
  `0 0 0 0.1875rem ${brandPrimary}20`;
