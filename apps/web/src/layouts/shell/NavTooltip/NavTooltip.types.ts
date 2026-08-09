import type React from 'react';

export interface NavTooltipProps {
  label: React.ReactNode;
  collapsed: boolean;
  children: React.ReactElement;
}
