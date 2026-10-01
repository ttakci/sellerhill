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

  // One hue per status (2026-10-01): the states that sit side by side on a
  // page never share a colour — a job list reads pending amber · processing
  // blue · completed green · failed red · cancelled grey; a listing reads
  // active green · draft navy · inactive grey; an account reads active green
  // · verifying sky · error red.
  const semantic = (tone: 'success' | 'info' | 'warning' | 'error'): StatusColorConfig => ({
    background: t.colors.semanticTint[tone],
    color: t.colors.semantic[tone],
    border: t.colors.semanticTintBorder[tone],
  });
  const hue = (name: 'teal' | 'sky' | 'orange' | 'navy'): StatusColorConfig => ({
    background: t.colors.badge[`${name}Tint`],
    color: t.colors.badge[name],
    border: t.colors.badge[`${name}Border`],
  });
  const neutral: StatusColorConfig = {
    background: t.colors.semanticTint.neutral,
    color: t.colors.text.tertiary,
    border: t.colors.semanticTintBorder.neutral,
  };

  const map: StatusColorMap = {
    active: semantic('success'),
    verifying: hue('sky'),
    completed: semantic('success'),
    success: semantic('success'),
    processing: semantic('info'),
    pending: semantic('warning'),
    failed: semantic('error'),
    error: semantic('error'),
    warning: hue('orange'),
    draft: hue('navy'),
    inactive: neutral,
    shipped: hue('teal'),
    cancelled: neutral,
    both: semantic('info'),
    title: semantic('warning'),
    description: hue('teal'),
  };

  return (
    map[normalized] || {
      background: t.colors.semanticTint.neutral,
      color: t.colors.text.secondary,
      border: t.colors.semanticTintBorder.neutral,
    }
  );
};
