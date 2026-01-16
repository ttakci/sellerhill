import React from 'react';
import { IconName } from '../Icon';

export interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: IconName;
  variant?: 'default' | 'danger';
}

export interface DropdownProps {
  trigger: React.ReactNode | ((isOpen: boolean) => React.ReactNode);
  items: DropdownItem[];
  header?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}
