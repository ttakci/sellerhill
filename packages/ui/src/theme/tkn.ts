import type { DefaultTheme } from 'styled-components';

type ThemePath =
  // Colors - Background
  | 'colors.background.primary'
  | 'colors.background.secondary'
  | 'colors.background.tertiary'
  // Colors - Surface
  | 'colors.surface.primary'
  | 'colors.surface.secondary'
  // Colors - Text
  | 'colors.text.primary'
  | 'colors.text.secondary'
  | 'colors.text.tertiary'
  | 'colors.text.disabled'
  | 'colors.text.inverse'
  // Colors - Border
  | 'colors.border.primary'
  | 'colors.border.secondary'
  | 'colors.border.focus'
  // Colors - Semantic
  | 'colors.semantic.success'
  | 'colors.semantic.error'
  | 'colors.semantic.warning'
  | 'colors.semantic.info'
  // Colors - Brand
  | 'colors.brand.primary'
  | 'colors.brand.primaryHover'
  | 'colors.brand.secondary'
  // Spacing
  | 'spacing.xs'
  | 'spacing.sm'
  | 'spacing.md'
  | 'spacing.lg'
  | 'spacing.xl'
  | 'spacing.xxl'
  | 'spacing.xxxl'
  // Radius
  | 'radius.sm'
  | 'radius.md'
  | 'radius.lg'
  | 'radius.xl'
  | 'radius.full'
  // Typography - Font Family
  | 'typography.fontFamily.sans'
  | 'typography.fontFamily.mono'
  // Typography - Font Size
  | 'typography.fontSize.xs'
  | 'typography.fontSize.sm'
  | 'typography.fontSize.md'
  | 'typography.fontSize.lg'
  | 'typography.fontSize.xl'
  | 'typography.fontSize.xxl'
  | 'typography.fontSize.xxxl'
  // Typography - Font Weight
  | 'typography.fontWeight.normal'
  | 'typography.fontWeight.medium'
  | 'typography.fontWeight.semibold'
  | 'typography.fontWeight.bold'
  // Typography - Line Height
  | 'typography.lineHeight.tight'
  | 'typography.lineHeight.normal'
  | 'typography.lineHeight.relaxed'
  // Shadows
  | 'shadows.sm'
  | 'shadows.md'
  | 'shadows.lg'
  | 'shadows.xl'
  // Transitions
  | 'transitions.fast'
  | 'transitions.normal'
  | 'transitions.slow';

export const tkn = (path: ThemePath) => (p: { theme: DefaultTheme }) => {
  const t = p.theme;

  switch (path) {
    // Colors - Background
    case 'colors.background.primary':
      return t.colors.background.primary;
    case 'colors.background.secondary':
      return t.colors.background.secondary;
    case 'colors.background.tertiary':
      return t.colors.background.tertiary;

    // Colors - Surface
    case 'colors.surface.primary':
      return t.colors.surface.primary;
    case 'colors.surface.secondary':
      return t.colors.surface.secondary;

    // Colors - Text
    case 'colors.text.primary':
      return t.colors.text.primary;
    case 'colors.text.secondary':
      return t.colors.text.secondary;
    case 'colors.text.tertiary':
      return t.colors.text.tertiary;
    case 'colors.text.disabled':
      return t.colors.text.disabled;
    case 'colors.text.inverse':
      return t.colors.text.inverse;

    // Colors - Border
    case 'colors.border.primary':
      return t.colors.border.primary;
    case 'colors.border.secondary':
      return t.colors.border.secondary;
    case 'colors.border.focus':
      return t.colors.border.focus;

    // Colors - Semantic
    case 'colors.semantic.success':
      return t.colors.semantic.success;
    case 'colors.semantic.error':
      return t.colors.semantic.error;
    case 'colors.semantic.warning':
      return t.colors.semantic.warning;
    case 'colors.semantic.info':
      return t.colors.semantic.info;

    // Colors - Brand
    case 'colors.brand.primary':
      return t.colors.brand.primary;
    case 'colors.brand.primaryHover':
      return t.colors.brand.primaryHover;
    case 'colors.brand.secondary':
      return t.colors.brand.secondary;

    // Spacing
    case 'spacing.xs':
      return t.spacing.xs;
    case 'spacing.sm':
      return t.spacing.sm;
    case 'spacing.md':
      return t.spacing.md;
    case 'spacing.lg':
      return t.spacing.lg;
    case 'spacing.xl':
      return t.spacing.xl;
    case 'spacing.xxl':
      return t.spacing.xxl;
    case 'spacing.xxxl':
      return t.spacing.xxxl;

    // Radius
    case 'radius.sm':
      return t.radius.sm;
    case 'radius.md':
      return t.radius.md;
    case 'radius.lg':
      return t.radius.lg;
    case 'radius.xl':
      return t.radius.xl;
    case 'radius.full':
      return t.radius.full;

    // Typography - Font Family
    case 'typography.fontFamily.sans':
      return t.typography.fontFamily.sans;
    case 'typography.fontFamily.mono':
      return t.typography.fontFamily.mono;

    // Typography - Font Size
    case 'typography.fontSize.xs':
      return t.typography.fontSize.xs;
    case 'typography.fontSize.sm':
      return t.typography.fontSize.sm;
    case 'typography.fontSize.md':
      return t.typography.fontSize.md;
    case 'typography.fontSize.lg':
      return t.typography.fontSize.lg;
    case 'typography.fontSize.xl':
      return t.typography.fontSize.xl;
    case 'typography.fontSize.xxl':
      return t.typography.fontSize.xxl;
    case 'typography.fontSize.xxxl':
      return t.typography.fontSize.xxxl;

    // Typography - Font Weight
    case 'typography.fontWeight.normal':
      return t.typography.fontWeight.normal;
    case 'typography.fontWeight.medium':
      return t.typography.fontWeight.medium;
    case 'typography.fontWeight.semibold':
      return t.typography.fontWeight.semibold;
    case 'typography.fontWeight.bold':
      return t.typography.fontWeight.bold;

    // Typography - Line Height
    case 'typography.lineHeight.tight':
      return t.typography.lineHeight.tight;
    case 'typography.lineHeight.normal':
      return t.typography.lineHeight.normal;
    case 'typography.lineHeight.relaxed':
      return t.typography.lineHeight.relaxed;

    // Shadows
    case 'shadows.sm':
      return t.shadows.sm;
    case 'shadows.md':
      return t.shadows.md;
    case 'shadows.lg':
      return t.shadows.lg;
    case 'shadows.xl':
      return t.shadows.xl;

    // Transitions
    case 'transitions.fast':
      return t.transitions.fast;
    case 'transitions.normal':
      return t.transitions.normal;
    case 'transitions.slow':
      return t.transitions.slow;

    default:
      return '';
  }
};
