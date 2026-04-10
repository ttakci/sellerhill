export type IconButtonVariant = 'ghost' | 'outlined' | 'elevated';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  children: React.ReactNode;
}
