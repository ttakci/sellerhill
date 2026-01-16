export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface BreadcrumbProps {
  pageTitle: string;
  items: BreadcrumbItem[];
  className?: string;
}
