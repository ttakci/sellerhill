import { useEffect } from 'react';

import { lockDocumentScroll } from '../../utils/documentScrollLock';

import { DrawerComponent } from './Drawer.component';
import type { DrawerProps } from './Drawer.types';

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  onBack,
  backAriaLabel,
  children,
  primaryAction,
  footer,
  size = 'md',
  className,
}) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    return lockDocumentScroll();
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
      onBack={onBack}
      backAriaLabel={backAriaLabel}
      primaryAction={primaryAction}
      footer={footer}
      size={size}
      className={className}
    >
      {children}
    </DrawerComponent>
  );
};

Drawer.displayName = 'Drawer';
