import { type IconName } from '../Icon';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: IconName;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate?: (path: string) => void;
  className?: string;
}
