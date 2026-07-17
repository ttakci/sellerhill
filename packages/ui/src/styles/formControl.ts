/**
 * Shared form-control geometry & focus treatment.
 * TextInput, Select, SearchField (and Button medium) must stay aligned.
 */

export type ControlSize = 'small' | 'medium' | 'large';

/** Height for controls without a floating label (search, compact toolbars). */
export const compactControlHeight = (size: ControlSize = 'medium'): string => {
  switch (size) {
    case 'small':
      return '2.5rem';
    case 'large':
      return '3rem';
    case 'medium':
    default:
      return '2.75rem';
  }
};

/**
 * Height for controls with a floating label.
 * Sized so floated label and value never collide (body is 16px).
 */
export const labeledControlHeight = (size: ControlSize = 'medium'): string => {
  switch (size) {
    case 'small':
      return '3.25rem'; // 52px
    case 'large':
      return '4rem'; // 64px
    case 'medium':
    default:
      return '3.5rem'; // 56px — room for label + 16px value
  }
};

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
