import '@emotion/react';
import type { AppTheme } from './theme.types';

declare module '@emotion/react' {
  export interface Theme extends AppTheme {}
}