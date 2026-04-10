import { Theme } from '@emotion/react';

/**
 * Mevcut tüm tema yollarını (path) destekleyen tip tanımı.
 * Bu sayede tkn('colors.background.primary') yazarken hata yapman engellenir.
 */
type ThemePath =
  | 'colors.background.primary'
  | 'colors.background.secondary'
  | 'colors.background.tertiary'
  | 'colors.surface.primary'
  | 'colors.surface.secondary'
  | 'colors.surface.overlay'
  | 'colors.text.primary'
  | 'colors.text.secondary'
  | 'colors.text.tertiary'
  | 'colors.text.disabled'
  | 'colors.text.inverse'
  | 'colors.border.primary'
  | 'colors.border.secondary'
  | 'colors.border.focus'
  | 'colors.semantic.success'
  | 'colors.semantic.error'
  | 'colors.semantic.warning'
  | 'colors.semantic.info'
  | 'colors.brand.primary'
  | 'colors.brand.primaryHover'
  | 'colors.brand.secondary'
  | 'colors.semanticTint.success'
  | 'colors.semanticTint.error'
  | 'colors.semanticTint.warning'
  | 'colors.semanticTint.info'
  | 'colors.semanticTint.neutral'
  | 'colors.semanticTintBorder.success'
  | 'colors.semanticTintBorder.error'
  | 'colors.semanticTintBorder.warning'
  | 'colors.semanticTintBorder.info'
  | 'colors.semanticTintBorder.neutral'
  | 'spacing.2xs'
  | 'spacing.xs'
  | 'spacing.sm'
  | 'spacing.md'
  | 'spacing.lg'
  | 'spacing.xl'
  | 'spacing.xxl'
  | 'spacing.xxxl'
  | 'radius.sm'
  | 'radius.md'
  | 'radius.lg'
  | 'radius.xl'
  | 'radius.2xl'
  | 'radius.full'
  | 'typography.fontFamily.sans'
  | 'typography.fontFamily.mono'
  | 'typography.fontSize.2xs'
  | 'typography.fontSize.xs'
  | 'typography.fontSize.sm'
  | 'typography.fontSize.md'
  | 'typography.fontSize.lg'
  | 'typography.fontSize.xl'
  | 'typography.fontSize.xxl'
  | 'typography.fontSize.xxxl'
  | 'typography.fontSize.3xl'
  | 'typography.fontWeight.normal'
  | 'typography.fontWeight.medium'
  | 'typography.fontWeight.semibold'
  | 'typography.fontWeight.bold'
  | 'typography.lineHeight.tight'
  | 'typography.lineHeight.normal'
  | 'typography.lineHeight.relaxed'
  | 'shadows.sm'
  | 'shadows.md'
  | 'shadows.lg'
  | 'shadows.xl'
  | 'transitions.fast'
  | 'transitions.normal'
  | 'transitions.slow';

/**
 * tkn Fonksiyonu:
 * switch-case yerine dinamik bir yaklaşımla temadaki değeri döner.
 */
export const tkn = (path: ThemePath) => (p: { theme: Theme }) => {
  const t = p.theme;

  if (!t || !t.colors) {
    console.warn(`[tkn] Theme or colors missing while accessing "${path}".`);
    return '';
  }

  // Path'i parçalara ayır (örn: 'colors.text.primary' -> ['colors', 'text', 'primary'])
  // ve objenin içinde derinlere inerek değeri bul.
  const value = path.split('.').reduce((obj: any, key) => obj && obj[key], t);

  if (value === undefined) {
    console.warn(`[tkn] Path "${path}" not found in theme.`);
    return '';
  }

  return value;
};
