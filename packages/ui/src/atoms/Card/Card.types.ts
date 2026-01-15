export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'bordered' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

export interface CardHeaderProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}
