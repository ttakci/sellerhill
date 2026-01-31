import React from 'react';
import { IconName } from '../../atoms/Icon';

export type SettingsCardVariant = 'section' | 'panel';

export interface SettingsCardHeaderProps {
  icon?: IconName;
  title: string;
  subtitle?: string;
  variant?: SettingsCardVariant;
}

export interface SettingsCardProps {
  variant?: SettingsCardVariant;
  header?: SettingsCardHeaderProps;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}
