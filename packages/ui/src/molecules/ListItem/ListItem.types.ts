import React from 'react';

export interface ListItemProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}
