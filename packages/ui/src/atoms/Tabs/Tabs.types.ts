import type React from 'react';

import { IconName } from '../Icon';

export interface TabItem {
  id: string;
  label: string;
  icon?: IconName;
  content: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultActiveTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
  variant?: 'underline' | 'pill';
}

export interface TabsComponentProps {
  items: TabItem[];
  className?: string;
  variant?: 'underline' | 'pill';
  activeTab: string;
  activeContent: React.ReactNode;
  onTabClick: (tabId: string) => void;
}
