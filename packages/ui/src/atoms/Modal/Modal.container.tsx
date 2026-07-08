import { useEffect } from 'react';

import { ModalComponent } from './Modal.component';
import type { ModalProps } from './Modal.types';

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className,
  showCloseButton = true,
  showDivider = true,
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

  return (
    <ModalComponent
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={footer}
      size={size}
      className={className}
      showCloseButton={showCloseButton}
      showDivider={showDivider}
    >
      {children}
    </ModalComponent>
  );
};

Modal.displayName = 'Modal';
