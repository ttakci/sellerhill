import type React from 'react';

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
  direction?: 'up' | 'down';
  width?: string;
  className?: string;
}

export interface DropdownComponentProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  header?: React.ReactNode;
  align: 'left' | 'right';
  direction?: 'up' | 'down';
  width?: string;
  className?: string;
  isOpen: boolean;
  isMobile: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  onTriggerClick: () => void;
  onItemClick: (item: DropdownItem) => void;
  onClose: () => void;
}
