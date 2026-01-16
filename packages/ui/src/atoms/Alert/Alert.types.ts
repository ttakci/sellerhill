import React from 'react';
import { IconName } from '../Icon';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  icon?: IconName;
  onClose?: () => void;
  className?: string;
}
