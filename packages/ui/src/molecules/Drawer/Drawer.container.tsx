import { useEffect } from 'react';

import { DrawerComponent } from './Drawer.component';
import type { DrawerProps } from './Drawer.types';

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  className,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {return;}
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <DrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={footer}
      size={size}
      className={className}
    >
      {children}
    </DrawerComponent>
  );
};

Drawer.displayName = 'Drawer';
