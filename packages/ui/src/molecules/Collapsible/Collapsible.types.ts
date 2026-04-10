import React from 'react';

export interface CollapsibleProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  onChange?: (open: boolean) => void;
  className?: string;
}
