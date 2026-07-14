import type { AppTheme } from '../../theme/theme.types';

export type StatusType =
  | 'active'
  | 'verifying'
  | 'completed'
  | 'success'
  | 'processing'
  | 'pending'
  | 'failed'
  | 'error'
  | 'warning'
  | 'draft'
  | 'inactive'
  | 'shipped'
  | 'cancelled'
  | 'both'
  | 'title'
  | 'description'
  | 'default';

export type StatusSize = 'sm' | 'md' | 'lg';

export interface StatusBadgeProps {
  status: string;
  size?: StatusSize;
  children?: React.ReactNode;
  className?: string;
}

export type StatusColorConfig = {
  background: string;
  color: string;
  border: string;
};

export type StatusColorMap = Record<string, StatusColorConfig>;

export const getStatusColors = (status: string, theme: AppTheme): StatusColorConfig => {
  const normalized = status.toLowerCase();
  const t = theme;

  const map: StatusColorMap = {
    active: {
      background: t.colors.semanticTint.success,
      color: t.colors.semantic.success,
      border: t.colors.semanticTintBorder.success,
    },
    verifying: {
      background: t.colors.semanticTint.info,
      color: t.colors.semantic.info,
      border: t.colors.semanticTintBorder.info,
    },
    completed: {
      background: t.colors.semanticTint.success,
      color: t.colors.semantic.success,
      border: t.colors.semanticTintBorder.success,
    },
    success: {
      background: t.colors.semanticTint.success,
      color: t.colors.semantic.success,
      border: t.colors.semanticTintBorder.success,
    },
    processing: {
      background: t.colors.semanticTint.info,
      color: t.colors.semantic.info,
      border: t.colors.semanticTintBorder.info,
    },
    pending: {
      background: t.colors.semanticTint.warning,
      color: t.colors.semantic.warning,
      border: t.colors.semanticTintBorder.warning,
    },
    failed: {
      background: t.colors.semanticTint.error,
      color: t.colors.semantic.error,
      border: t.colors.semanticTintBorder.error,
    },
    error: {
      background: t.colors.semanticTint.error,
      color: t.colors.semantic.error,
      border: t.colors.semanticTintBorder.error,
    },
    warning: {
      background: t.colors.semanticTint.warning,
      color: t.colors.semantic.warning,
      border: t.colors.semanticTintBorder.warning,
    },
    draft: {
      background: t.colors.semanticTint.neutral,
      color: t.colors.text.tertiary,
      border: t.colors.semanticTintBorder.neutral,
    },
    inactive: {
      background: t.colors.semanticTint.neutral,
      color: t.colors.text.tertiary,
      border: t.colors.semanticTintBorder.neutral,
    },
    shipped: {
      background: t.colors.semanticTint.info,
      color: t.colors.semantic.info,
      border: t.colors.semanticTintBorder.info,
    },
    cancelled: {
      background: t.colors.semanticTint.error,
      color: t.colors.semantic.error,
      border: t.colors.semanticTintBorder.error,
    },
    both: {
      background: t.colors.semanticTint.info,
      color: t.colors.semantic.info,
      border: t.colors.semanticTintBorder.info,
    },
    title: {
      background: t.colors.semanticTint.warning,
      color: t.colors.semantic.warning,
      border: t.colors.semanticTintBorder.warning,
    },
    description: {
      background: t.colors.semanticTint.info,
      color: t.colors.semantic.info,
      border: t.colors.semanticTintBorder.info,
    },
  };

  return (
    map[normalized] || {
      background: t.colors.semanticTint.neutral,
      color: t.colors.text.secondary,
      border: t.colors.semanticTintBorder.neutral,
    }
  );
};
